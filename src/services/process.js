import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {readLines, readText, waitProcess, writeText} from './streams.js';

const DEFAULT_MAX_OUTPUT_BYTES = 8 * 1024 * 1024;
const MAX_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;

export class ProcessError extends Error {
    constructor(code, message) {
        super(message);
        this.name = 'ProcessError';
        this.code = code;
    }
}

function normalizeSpec(spec) {
    const value = Array.isArray(spec) ? {argv: spec, environment: {}} : spec;
    if (!value || !Array.isArray(value.argv) || !value.argv.length ||
        value.argv.some(argument => typeof argument !== 'string' || !argument))
        throw new ProcessError('INVALID_COMMAND', 'Command arguments must be non-empty strings');
    if (value.environment && (typeof value.environment !== 'object' || Array.isArray(value.environment)))
        throw new ProcessError('INVALID_COMMAND', 'Command environment must be an object');
    for (const [name, entry] of Object.entries(value.environment ?? {})) {
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || typeof entry !== 'string')
            throw new ProcessError('INVALID_COMMAND', 'Command environment entries must be named strings');
    }
    return {argv: value.argv, environment: value.environment ?? {}};
}

function spawn(spec, flags) {
    const {argv, environment} = normalizeSpec(spec);
    const launcher = new Gio.SubprocessLauncher({flags});
    for (const [name, value] of Object.entries(environment))
        launcher.setenv(name, value, true);
    return launcher.spawnv(argv);
}

export async function runCommand(spec, {input = null, timeout = 15000, cancellable = null,
    maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES} = {}) {
    if (!Number.isSafeInteger(timeout) || timeout <= 0 || timeout > MAX_TIMEOUT_MS ||
        !Number.isSafeInteger(maxOutputBytes) || maxOutputBytes <= 0 || maxOutputBytes > MAX_OUTPUT_BYTES)
        throw new ProcessError('INVALID_OPTIONS', 'Process limits are outside the supported range');
    if (input !== null && typeof input !== 'string')
        throw new ProcessError('INVALID_OPTIONS', 'Process input must be text or null');

    const proc = spawn(spec, Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE |
        (input === null ? 0 : Gio.SubprocessFlags.STDIN_PIPE));
    const local = new Gio.Cancellable();
    let completed = false;
    let cancellation = null;
    const externalId = cancellable?.connect(() => {
        cancellation = 'CANCELLED';
        local.cancel();
    });
    if (cancellable?.is_cancelled()) {
        cancellation = 'CANCELLED';
        local.cancel();
    }
    let timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, timeout, () => {
        timer = 0;
        cancellation = 'TIMED_OUT';
        local.cancel();
        return GLib.SOURCE_REMOVE;
    });
    try {
        const writeInput = async () => {
            if (input === null)
                return;
            const stdin = proc.get_stdin_pipe();
            await writeText(stdin, input, local);
            stdin.close(null);
        };
        const [stdout] = await Promise.all([
            readText(proc.get_stdout_pipe(), maxOutputBytes, local,
                () => new ProcessError('OUTPUT_LIMIT', 'Command output exceeded the configured limit')),
            writeInput(),
            waitProcess(proc, local).then(() => { completed = true; }),
        ]);
        if (!proc.get_successful())
            throw new ProcessError('FAILED', 'Command exited unsuccessfully');
        return stdout;
    } catch (error) {
        if (cancellation === 'TIMED_OUT')
            throw new ProcessError('TIMED_OUT', 'Command timed out');
        if (cancellation === 'CANCELLED')
            throw new ProcessError('CANCELLED', 'Command was cancelled');
        throw error;
    } finally {
        if (timer)
            GLib.source_remove(timer);
        if (externalId)
            cancellable.disconnect(externalId);
        // Abort remaining stream operations on every failure, including output overflow.
        local.cancel();
        // Give managed collectors time to cancel and reap their own CLI child.
        if (!completed) {
            try { proc.send_signal(15); } catch { /* The child exited between callbacks. */ }
            let killTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
                killTimer = 0;
                proc.force_exit();
                return GLib.SOURCE_REMOVE;
            });
            let reaped = false;
            try { await waitProcess(proc); reaped = true; } finally {
                if (killTimer)
                    GLib.source_remove(killTimer);
                if (!reaped)
                    proc.force_exit();
            }
        }
    }
}

export class RpcClient {
    constructor(spec, cancellable, timeout = 8000) {
        if (!Number.isSafeInteger(timeout) || timeout <= 0 || timeout > MAX_TIMEOUT_MS)
            throw new ProcessError('INVALID_OPTIONS', 'RPC timeout is outside the supported range');
        this.proc = spawn(spec, Gio.SubprocessFlags.STDIN_PIPE | Gio.SubprocessFlags.STDOUT_PIPE |
            Gio.SubprocessFlags.STDERR_SILENCE);
        this.input = this.proc.get_stdout_pipe();
        this.cancellable = new Gio.Cancellable();
        this.parent = cancellable;
        this.timeout = timeout;
        this.nextId = 0;
        this.pending = new Map();
        this.closed = false;
        this._writes = Promise.resolve();
        this._queuedBytes = 0;
        this._queuedMessages = 0;
        this.parentId = cancellable?.connect(() => this.close()) ?? 0;
        if (!this.closed)
            this.read();
    }

    send(value) {
        if (this.closed)
            throw new Error('RPC closed');
        const text = `${JSON.stringify(value)}\n`;
        const size = new TextEncoder().encode(text).length;
        if (this._queuedMessages >= 64 || this._queuedBytes + size > DEFAULT_MAX_OUTPUT_BYTES)
            throw new ProcessError('OUTPUT_LIMIT', 'RPC request exceeded the configured limit');
        this._queuedBytes += size;
        this._queuedMessages++;
        this._writes = this._writes.then(() => {
            if (!this.closed)
                return writeText(this.proc.get_stdin_pipe(), text, this.cancellable);
        }).catch(() => this.close()).finally(() => {
            this._queuedBytes -= size;
            this._queuedMessages--;
        });
    }

    notify(method, params) {
        this.send({method, params});
    }

    request(method, params = {}) {
        if (this.closed || this.pending.size >= 64)
            return Promise.reject(new ProcessError('RPC_CLOSED', 'RPC unavailable or too many pending requests'));
        return new Promise((resolve, reject) => {
            const id = ++this.nextId;
            const timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this.timeout, () => {
                this.pending.delete(id);
                reject(new ProcessError('RPC_TIMEOUT', `RPC request timed out: ${method}`));
                return GLib.SOURCE_REMOVE;
            });
            this.pending.set(id, {resolve, reject, timer});
            try {
                this.send({id, method, params});
            } catch (error) {
                this.pending.delete(id);
                GLib.source_remove(timer);
                reject(error);
            }
        });
    }

    async read() {
        try {
            for await (const line of readLines(this.input, DEFAULT_MAX_OUTPUT_BYTES, this.cancellable,
                () => new ProcessError('OUTPUT_LIMIT', 'RPC response exceeded the configured limit'))) {
                if (this.closed)
                    return;
                const value = JSON.parse(line);
                const pending = this.pending.get(value.id);
                if (pending) {
                    this.pending.delete(value.id);
                    GLib.source_remove(pending.timer);
                    if (value.error) {
                        const message = String(value.error.message || 'RPC request unavailable').slice(0, 240);
                        const error = new ProcessError('RPC_ERROR', message);
                        error.rpcCode = value.error.code ?? null;
                        pending.reject(error);
                    } else {
                        pending.resolve(value.result);
                    }
                }
            }
        } catch {
            // Malformed, oversized and interrupted streams all close pending work.
        } finally {
            this.close();
        }
    }

    close() {
        if (this.closed)
            return;
        this.closed = true;
        for (const pending of this.pending.values()) {
            GLib.source_remove(pending.timer);
            pending.reject(new ProcessError('RPC_CLOSED', 'RPC connection closed'));
        }
        this.pending.clear();
        this.cancellable.cancel();
        this.proc.force_exit();
        this.proc.wait_async(null, (p, result) => { try { p.wait_finish(result); } catch { /* Reap best effort. */ } });
        // Disconnecting inside a Gio.Cancellable callback deadlocks; defer it.
        if (this.parentId) {
            const id = this.parentId;
            this.parentId = 0;
            GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                this.parent.disconnect(id);
                return GLib.SOURCE_REMOVE;
            });
        }
    }
}
