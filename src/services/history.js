import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {aggregateEvents, recentDates, section} from '../core/usage.js';
import {cacheDirectory, fingerprint, join, readJson, writeJson} from './files.js';

const CACHE_VERSION = 4;
const MAX_DEPTH = 12;
const MAX_FILES = 20000;
const MAX_LINE_BYTES = 4 * 1024 * 1024;
const MAX_MODELS = 128;
const SCAN_SECONDS = 20;

function fileStamp(info) {
    const modified = info.get_attribute_uint64('time::modified');
    const modifiedUsec = info.get_attribute_uint32('time::modified-usec');
    const changed = info.get_attribute_uint64('time::changed');
    const changedUsec = info.get_attribute_uint32('time::changed-usec');
    return `${modified}:${modifiedUsec}:${changed}:${changedUsec}`;
}

function listFiles(root, output, deadline, depth = 0) {
    if (depth > MAX_DEPTH || output.length >= MAX_FILES || GLib.get_monotonic_time() > deadline)
        throw new Error('History directory exceeds scan bounds');
    const file = Gio.File.new_for_path(root);
    if (!file.query_exists(null))
        return false;
    const iterator = file.enumerate_children('standard::name,standard::type,standard::is-symlink,standard::size,' +
        'time::modified,time::modified-usec,time::changed,time::changed-usec,id::file',
        Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);
    try {
        let info;
        while ((info = iterator.next_file(null))) {
            if (GLib.get_monotonic_time() > deadline)
                throw new Error('History directory scan timed out');
            if (info.get_is_symlink())
                continue;
            const path = join(root, info.get_name());
            if (info.get_file_type() === Gio.FileType.DIRECTORY)
                listFiles(path, output, deadline, depth + 1);
            else if (info.get_file_type() === Gio.FileType.REGULAR && info.get_name().endsWith('.jsonl')) {
                if (output.length >= MAX_FILES)
                    throw new Error('History directory exceeds scan bounds');
                output.push({path, size: info.get_size(), stamp: fileStamp(info),
                    fileId: info.get_attribute_string('id::file') ?? ''});
            }
        }
    } finally {
        iterator.close(null);
    }
    return true;
}

function privateIdentity(provider, value) {
    const text = String(value ?? '');
    return /^h:[a-f0-9]{64}$/.test(text) ? text : `h:${fingerprint(`${provider}:${text}`)}`;
}

function parserState(value, fallbackSession) {
    const session = typeof value?.session === 'string' && /^h:[a-f0-9]{64}$/.test(value.session)
        ? value.session
        : fallbackSession;
    const state = {session};
    if (typeof value?.model === 'string' && value.model.trim() && value.model.length <= 160 &&
        !/[\u0000-\u001f\u007f]/.test(value.model))
        state.model = value.model;
    if (numberValue(value?.cumulativeEpoch) !== null)
        state.cumulativeEpoch = numberValue(value.cumulativeEpoch);
    if (value?.cumulative && typeof value.cumulative === 'object') {
        const fields = ['total_tokens', 'input_tokens', 'output_tokens', 'cached_input_tokens', 'cache_write_input_tokens'];
        if (fields.every(field => numberValue(value.cumulative[field]) !== null))
            state.cumulative = Object.fromEntries(fields.map(field => [field, numberValue(value.cumulative[field])]));
    }
    return state;
}

function numberValue(value) {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function cachedFile(value, fallbackSession) {
    if (!value || typeof value !== 'object' || !value.events || typeof value.events !== 'object' ||
        Array.isArray(value.events))
        return null;
    const offset = numberValue(value.offset);
    const size = value.size === -1 ? -1 : numberValue(value.size);
    if (offset === null || size === null || typeof value.stamp !== 'string' || typeof value.fileId !== 'string')
        return null;
    return {offset, size, stamp: value.stamp, fileId: value.fileId,
        state: parserState(value.state, fallbackSession), events: value.events, partial: value.partial === true};
}

function validDate(value) {
    const parsed = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? Date.parse(`${value}T00:00:00Z`)
        : NaN;
    return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
}

function sanitizedEvent(event, provider, stored = false) {
    if (!event || typeof event !== 'object' || typeof event.id !== 'string' || !event.id ||
        typeof event.session !== 'string' || !event.session || typeof event.model !== 'string' ||
        !event.model.trim() || event.model.length > 160 || event.id.length > 2048 || event.session.length > 2048 ||
        /[\u0000-\u001f\u007f]/.test(event.model) || !validDate(event.date) ||
        (stored && (!/^h:[a-f0-9]{64}$/.test(event.id) || !/^h:[a-f0-9]{64}$/.test(event.session))))
        return null;
    const values = Object.fromEntries(['input', 'output', 'cacheRead', 'cacheWrite']
        .map(field => [field, numberValue(event[field])]));
    if (Object.values(values).some(value => value === null))
        return null;
    return {...values, date: event.date, model: event.model,
        id: stored ? event.id : privateIdentity(provider, event.id),
        session: stored ? event.session : privateIdentity(provider, event.session)};
}

export function scanHistory(id, roots, parse, {retention = 30, now = Date.now(), cachePath = null} = {}) {
    if (!Number.isSafeInteger(retention) || retention < 7 || retention > 90 ||
        !Number.isSafeInteger(now) || now <= 0 || !Array.isArray(roots) || !roots.length ||
        roots.some(root => typeof root !== 'string' || !root) || typeof parse !== 'function' ||
        (cachePath !== null && (typeof cachePath !== 'string' || !cachePath)))
        throw new Error('Invalid history scan options');
    const cutoff = recentDates(now, retention)[0];
    const destination = cachePath ?? join(cacheDirectory(), `history-${id}.json`);
    let cached = readJson(destination, {}, 64 * 1024 * 1024);
    const identity = fingerprint(JSON.stringify(roots));
    if (cached.version !== CACHE_VERSION || cached.identity !== identity || typeof cached.files !== 'object' ||
        Array.isArray(cached.files))
        cached = {version: CACHE_VERSION, identity, files: {}, updatedAt: null};
    const files = [];
    let detected = false;
    let partial = false;
    let parsed = 0;
    const started = GLib.get_monotonic_time();
    const deadline = started + SCAN_SECONDS * 1000000;
    for (const root of roots) {
        try { detected = listFiles(root, files, deadline) || detected; } catch { partial = true; }
    }
    files.sort((a, b) => a.path.localeCompare(b.path));
    const currentKeys = new Set(files.map(file => fingerprint(file.path)));
    for (const file of files) {
        if ((GLib.get_monotonic_time() - started) / 1000000 > SCAN_SECONDS) {
            partial = true;
            break;
        }
        const key = fingerprint(file.path);
        const fallbackSession = privateIdentity(id, key);
        let previous = cachedFile(cached.files[key], fallbackSession);
        if (previous?.size === file.size && previous.stamp === file.stamp && previous.fileId === file.fileId) {
            partial ||= previous.partial;
            continue;
        }
        // Changed or truncated files are rebuilt; append-only files resume at the last complete line.
        if (!previous || file.fileId !== previous.fileId || file.size < previous.size || previous.offset > file.size)
            previous = {offset: 0, size: 0, stamp: '', fileId: file.fileId,
                state: {session: fallbackSession}, events: {}, partial: false};
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
                        const text = new TextDecoder().decode(line);
                        if (!text.trim())
                            continue;
                        const oldSession = previous.state.session;
                        const event = parse(JSON.parse(text), previous.state);
                        // Provider session identifiers are useful only for
                        // deduplication. Hash them before either parser state or
                        // derived events reach Freeby's private cache.
                        if (previous.state.session !== oldSession)
                            previous.state.session = privateIdentity(id, previous.state.session);
                        if (event) {
                            const sanitized = sanitizedEvent(event, id);
                            if (!sanitized)
                                previous.partial = true;
                            else if (sanitized.date >= cutoff)
                                previous.events[sanitized.id] = sanitized;
                        }
                    } catch {
                        previous.partial = true;
                    }
                }
                tail = buffer.slice(start);
                if (tail.length > MAX_LINE_BYTES ||
                    (GLib.get_monotonic_time() - started) / 1000000 > SCAN_SECONDS) {
                    partial = true;
                    stop = true;
                }
            }
            previous.offset = offset;
            // A time-limited scan must resume even if the source file has not changed.
            previous.size = stop ? -1 : Math.max(file.size, offset);
            previous.stamp = file.stamp;
            previous.fileId = file.fileId;
            previous.state = parserState(previous.state, fallbackSession);
            cached.files[key] = previous;
            partial ||= previous.partial;
            parsed++;
        } catch { partial = true; } finally { input?.close(null); }
    }
    const events = [];
    for (const [key, file] of Object.entries(cached.files)) {
        const normalized = cachedFile(file, privateIdentity(id, key));
        if (!normalized) {
            delete cached.files[key];
            partial = true;
            continue;
        }
        cached.files[key] = normalized;
        partial ||= normalized.partial;
        for (const [eventKey, event] of Object.entries(normalized.events)) {
            const valid = sanitizedEvent(event, id, true);
            if (!valid || event.date < cutoff) {
                delete normalized.events[eventKey];
                partial ||= !valid;
            } else {
                if (eventKey !== valid.id) {
                    delete normalized.events[eventKey];
                    partial = true;
                }
                normalized.events[valid.id] = valid;
                events.push(valid);
            }
        }
        if (!currentKeys.has(key) && !Object.keys(normalized.events).length)
            delete cached.files[key];
    }
    if (files.length)
        cached.updatedAt = now;
    try { writeJson(destination, cached); } catch { partial = true; }
    const sourceAvailable = files.length > 0;
    const hasCachedEvents = !sourceAvailable && events.length > 0;
    const status = sourceAvailable ? partial ? 'partial' : 'ready' : hasCachedEvents ? 'stale' : 'unsupported';
    const result = {...section(status,
        partial ? 'Some local records could not be read. Totals may be incomplete.' :
            sourceAvailable ? 'Local records only; activity on other devices is not included.' :
                hasCachedEvents ? 'Showing saved local activity; source records are currently unavailable.' :
                    detected ? 'No local usage records found yet.' : 'No local usage records found.'),
    updatedAt: sourceAvailable ? now : hasCachedEvents ? numberValue(cached.updatedAt) : null,
    scope: 'local', source: `${id} local usage records`,
    ...aggregateEvents(events, now), scannedFiles: parsed};
    if (result.models.length > MAX_MODELS) {
        result.models = result.models.slice(0, MAX_MODELS);
        result.status = 'partial';
        result.message = 'Model totals were truncated to keep local history bounded.';
    }
    if ((!sourceAvailable || partial) && !events.length) {
        result.days = [];
        result.models = [];
        result.period = null;
    }
    return result;
}
