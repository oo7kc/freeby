import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

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

function outputSize(value) {
    return new TextEncoder().encode(value ?? '').length;
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
        const stdout = await new Promise((resolve, reject) => {
            proc.communicate_utf8_async(input, local, (p, result) => {
                try {
                    const [, output] = p.communicate_utf8_finish(result);
                    completed = true;
                    resolve(output ?? '');
                } catch (error) {
                    reject(error);
                }
            });
        });
        if (!proc.get_successful())
            throw new ProcessError('FAILED', 'Command exited unsuccessfully');
        if (outputSize(stdout) > maxOutputBytes)
            throw new ProcessError('OUTPUT_LIMIT', 'Command output exceeded the configured limit');
        return stdout;
    } catch (error) {
        if (cancellation === 'TIMED_OUT')
            throw new ProcessError('TIMED_OUT', 'Command timed out');
        if (cancellation === 'CANCELLED')
            throw new ProcessError('CANCELLED', 'Command was cancelled');
        throw error;
    } finally {
        // Give managed collectors time to cancel and reap their own CLI child.
        if (local.is_cancelled()) {
            proc.send_signal(15);
            await new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
                resolve();
                return GLib.SOURCE_REMOVE;
            }));
        }
        if (!completed)
            proc.force_exit();
        proc.wait_async(null, (p, result) => { try { p.wait_finish(result); } catch { /* Reap best effort. */ } });
        if (timer)
            GLib.source_remove(timer);
        if (externalId)
            cancellable.disconnect(externalId);
    }
}

export class RpcClient {
    constructor(spec, cancellable, timeout = 8000) {
        if (!Number.isSafeInteger(timeout) || timeout <= 0 || timeout > MAX_TIMEOUT_MS)
            throw new ProcessError('INVALID_OPTIONS', 'RPC timeout is outside the supported range');
        this.proc = spawn(spec, Gio.SubprocessFlags.STDIN_PIPE | Gio.SubprocessFlags.STDOUT_PIPE |
            Gio.SubprocessFlags.STDERR_SILENCE);
        this.input = new Gio.DataInputStream({base_stream: this.proc.get_stdout_pipe()});
        this.cancellable = new Gio.Cancellable();
        this.parent = cancellable;
        this.timeout = timeout;
        this.nextId = 0;
        this.pending = new Map();
        this.closed = false;
        this.parentId = cancellable?.connect(() => this.close()) ?? 0;
        if (!this.closed)
            this.read();
    }

    send(value) {
        if (this.closed)
            throw new Error('RPC closed');
        this.proc.get_stdin_pipe().write_all(new TextEncoder().encode(`${JSON.stringify(value)}\n`), this.cancellable);
    }

    notify(method, params) {
        this.send({method, params});
    }

    request(method, params = {}) {
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

    read() {
        this.input.read_line_async(GLib.PRIORITY_DEFAULT, this.cancellable, (stream, result) => {
            try {
                const [bytes] = stream.read_line_finish(result);
                if (bytes === null)
                    throw new Error('RPC exited');
                const value = JSON.parse(new TextDecoder().decode(bytes));
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
                if (!this.closed)
                    this.read();
            } catch {
                this.close();
            }
        });
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
