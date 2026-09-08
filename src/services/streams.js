import GLib from 'gi://GLib';

const CHUNK_BYTES = 65536;

export function readBytes(stream, cancellable) {
    return new Promise((resolve, reject) => {
        stream.read_bytes_async(CHUNK_BYTES, GLib.PRIORITY_DEFAULT, cancellable, (input, result) => {
            try { resolve(input.read_bytes_finish(result).toArray()); } catch (error) { reject(error); }
        });
    });
}

export async function readText(stream, maxBytes, cancellable, limitError) {
    const parts = [];
    let size = 0;
    while (true) {
        const bytes = await readBytes(stream, cancellable);
        if (!bytes.length)
            break;
        size += bytes.length;
        if (size > maxBytes)
            throw limitError();
        parts.push(bytes);
    }
    // GJS does not support TextDecoder's streaming option. Decode only after
    // joining the already-bounded bytes so split multibyte characters survive.
    const output = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) {
        output.set(part, offset);
        offset += part.length;
    }
    return new TextDecoder('utf-8', {fatal: true}).decode(output);
}

// RPC lines are bounded before decoding or parsing, including unterminated lines.
export async function* readLines(stream, maxBytes, cancellable, limitError) {
    let tail = new Uint8Array();
    while (true) {
        const bytes = await readBytes(stream, cancellable);
        if (!bytes.length) {
            if (tail.length)
                throw new Error('Incomplete RPC message');
            return;
        }
        const buffer = new Uint8Array(tail.length + bytes.length);
        buffer.set(tail);
        buffer.set(bytes, tail.length);
        let start = 0;
        for (let i = 0; i < buffer.length; i++) {
            if (i - start > maxBytes)
                throw limitError();
            if (buffer[i] === 10) {
                yield new TextDecoder('utf-8', {fatal: true}).decode(buffer.subarray(start, i));
                start = i + 1;
            }
        }
        tail = buffer.slice(start);
        if (tail.length > maxBytes)
            throw limitError();
    }
}

export function writeText(stream, text, cancellable) {
    return new Promise((resolve, reject) => {
        stream.write_all_async(new TextEncoder().encode(text), GLib.PRIORITY_DEFAULT, cancellable,
            (output, result) => {
                try { output.write_all_finish(result); resolve(); } catch (error) { reject(error); }
            });
    });
}

export function waitProcess(proc, cancellable = null) {
    return new Promise((resolve, reject) => {
        proc.wait_async(cancellable, (child, result) => {
            try { child.wait_finish(result); resolve(); } catch (error) { reject(error); }
        });
    });
}
