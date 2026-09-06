import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {aggregateEvents, recentDates, section} from '../core/usage.js';
import {cacheDirectory, fingerprint, join, readJson, writeJson} from './files.js';

function listFiles(root, output, depth = 0) {
    if (depth > 12 || output.length > 20000)
        throw new Error('History directory exceeds scan bounds');
    const file = Gio.File.new_for_path(root);
    if (!file.query_exists(null))
        return false;
    const iterator = file.enumerate_children('standard::name,standard::type,standard::is-symlink,standard::size,time::modified',
        Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);
    try {
        let info;
        while ((info = iterator.next_file(null))) {
            if (info.get_is_symlink())
                continue;
            const path = join(root, info.get_name());
            if (info.get_file_type() === Gio.FileType.DIRECTORY)
                listFiles(path, output, depth + 1);
            else if (info.get_name().endsWith('.jsonl'))
                output.push({path, size: info.get_size(), mtime: info.get_attribute_uint64('time::modified')});
        }
    } finally {
        iterator.close(null);
    }
    return true;
}

export function scanHistory(id, roots, parse, {retention = 30, now = Date.now(), cachePath = null} = {}) {
    const cutoff = recentDates(now, retention)[0];
    const destination = cachePath ?? join(cacheDirectory(), `history-${id}.json`);
    let cached = readJson(destination, {}, 64 * 1024 * 1024);
    const identity = fingerprint(roots.join('\n'));
    if (cached.version !== 2 || cached.identity !== identity || typeof cached.files !== 'object')
        cached = {version: 2, identity, files: {}};
    const files = [];
    let detected = false;
    let partial = false;
    let parsed = 0;
    const started = GLib.get_monotonic_time();
    for (const root of roots) {
        try { detected = listFiles(root, files) || detected; } catch { partial = true; }
    }
    for (const file of files) {
        if ((GLib.get_monotonic_time() - started) / 1000000 > 20) {
            partial = true;
            break;
        }
        const key = fingerprint(file.path);
        let previous = cached.files[key];
        if (previous?.size === file.size && previous?.mtime === file.mtime)
            continue;
        // Changed or truncated files are rebuilt; append-only files resume at the last complete line.
        if (!previous || file.size <= previous.size)
            previous = {offset: 0, state: {session: key}, events: {}};
        let input;
        try {
            input = Gio.File.new_for_path(file.path).read(null);
            input.seek(previous.offset, GLib.SeekType.SET, null);
            let offset = previous.offset;
            let tail = new Uint8Array();
            let stop = false;
            while (!stop) {
                const bytes = input.read_bytes(65536, null).toArray();
                if (!bytes.length)
                    break;
                const buffer = new Uint8Array(tail.length + bytes.length);
                buffer.set(tail);
                buffer.set(bytes, tail.length);
                let start = 0;
                for (let i = 0; i < buffer.length; i++) {
                    if (buffer[i] !== 10)
                        continue;
                    const line = buffer.subarray(start, i);
                    offset += i - start + 1;
                    start = i + 1;
                    try {
                        const oldSession = previous.state.session;
                        const event = parse(JSON.parse(new TextDecoder().decode(line)), previous.state);
                        // Provider session identifiers are useful only for
                        // deduplication. Hash them before either parser state or
                        // derived events reach Freeby's private cache.
                        if (previous.state.session !== oldSession)
                            previous.state.session = fingerprint(`${id}:${previous.state.session}`);
                        if (event && event.date >= cutoff) {
                            const sanitized = {...event,
                                id: fingerprint(`${id}:${event.id}`),
                                session: fingerprint(`${id}:${event.session ?? event.id}`)};
                            previous.events[sanitized.id] = sanitized;
                        }
                    } catch { partial = true; }
                }
                tail = buffer.slice(start);
                if (tail.length > 4 * 1024 * 1024 || (GLib.get_monotonic_time() - started) / 1000000 > 20) {
                    partial = true;
                    stop = true;
                }
            }
            previous.offset = offset;
            // A time-limited scan must resume even if the source file has not changed.
            previous.size = stop ? -1 : file.size;
            previous.mtime = file.mtime;
            cached.files[key] = previous;
            parsed++;
        } catch { partial = true; } finally { input?.close(null); }
    }
    const events = [];
    for (const [key, file] of Object.entries(cached.files)) {
        if (!file.events || typeof file.events !== 'object') {
            delete cached.files[key];
            partial = true;
            continue;
        }
        for (const [eventKey, event] of Object.entries(file.events)) {
            if (event.date < cutoff)
                delete file.events[eventKey];
            else
                events.push(event);
        }
    }
    try { writeJson(destination, cached); } catch { partial = true; }
    const result = {...section(detected ? partial ? 'partial' : 'ready' : 'unsupported',
        partial ? 'Some local records could not be read. Totals may be incomplete.' :
            detected ? 'Local records only; activity on other devices is not included.' : 'No local usage records found.'),
    updatedAt: detected ? now : null, scope: 'local', source: `${id} local usage records`,
    ...aggregateEvents(events, now), scannedFiles: parsed};
    if (!detected && !events.length) {
        result.days = [];
        result.models = [];
        result.period = null;
    }
    return result;
}
