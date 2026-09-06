import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export async function runCommand(argv, {input = null, timeout = 15000, cancellable = null} = {}) {
    const proc = Gio.Subprocess.new(argv, Gio.SubprocessFlags.STDOUT_PIPE |
        Gio.SubprocessFlags.STDERR_SILENCE | (input === null ? 0 : Gio.SubprocessFlags.STDIN_PIPE));
    const local = new Gio.Cancellable();
    const externalId = cancellable?.connect(() => local.cancel());
    if (cancellable?.is_cancelled())
        local.cancel();
    let timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, timeout, () => {
        timer = 0;
        local.cancel();
        return GLib.SOURCE_REMOVE;
    });
    try {
        const text = await new Promise((resolve, reject) => {
            proc.communicate_utf8_async(input, local, (p, result) => {
                try {
                    const [, stdout] = p.communicate_utf8_finish(result);
                    resolve(stdout);
                } catch (error) {
                    reject(error);
                }
            });
        });
        if (!proc.get_successful())
            throw new Error('Command failed');
        return text;
    } finally {
        // Give managed collectors time to cancel and reap their own CLI child.
        if (local.is_cancelled()) {
            proc.send_signal(15);
            await new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
                resolve();
                return GLib.SOURCE_REMOVE;
            }));
        }
        proc.force_exit();
        proc.wait_async(null, (p, result) => { try { p.wait_finish(result); } catch { /* Reap best effort. */ } });
        if (timer)
            GLib.source_remove(timer);
        if (externalId)
            cancellable.disconnect(externalId);
    }
}

export class RpcClient {
    constructor(argv, cancellable, timeout = 8000) {
        this.proc = Gio.Subprocess.new(argv, Gio.SubprocessFlags.STDIN_PIPE | Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE);
        this.input = new Gio.DataInputStream({base_stream: this.proc.get_stdout_pipe()});
        this.cancellable = new Gio.Cancellable();
        this.parent = cancellable;
        this.parentId = cancellable?.connect(() => this.close());
        this.timeout = timeout;
        this.nextId = 0;
        this.pending = new Map();
        this.closed = false;
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
                reject(new Error('RPC timeout'));
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
                    if (value.error)
                        pending.reject(new Error('RPC request unavailable'));
                    else
                        pending.resolve(value.result);
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
            pending.reject(new Error('RPC closed'));
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
