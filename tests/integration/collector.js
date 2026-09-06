import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import System from 'system';
import {scanHistory} from '../../src/services/history.js';
import {parseCodexEvent} from '../../src/providers/codex.js';
import {readJson, writeJson, join} from '../../src/services/files.js';
import {runCommand} from '../../src/services/process.js';

function assert(value, message) {
    if (!value)
        throw new Error(message);
}
const scratch = GLib.dir_make_tmp('freeby-integration-XXXXXX');
const sessions = join(scratch, 'sessions');
GLib.mkdir_with_parents(sessions, 0o700);
const fixture = join(sessions, 'synthetic.jsonl');
const cachePath = join(scratch, 'cache.json');
const now = new Date('2026-09-06T12:00:00').getTime();
const event = total => JSON.stringify({type: 'event_msg', timestamp: '2026-09-06T10:00:00Z', payload: {type: 'token_count',
    info: {total_token_usage: {input_tokens: total, output_tokens: 0, cached_input_tokens: 0, total_tokens: total}}}});
const text = `${JSON.stringify({type: 'session_meta', payload: {id: 'synthetic'}})}\n${event(100)}\n`;
GLib.file_set_contents(fixture, text);
const first = scanHistory('codex', [sessions], parseCodexEvent, {now, cachePath});
assert(first.days.at(-1).total === 100, 'initial scan');
const second = scanHistory('codex', [sessions], parseCodexEvent, {now, cachePath});
assert(second.scannedFiles === 0 && second.days.at(-1).total === 100, 'unchanged file must reuse cache');
GLib.file_set_contents(fixture, `${text}${event(180)}\n{"partial":`);
const third = scanHistory('codex', [sessions], parseCodexEvent, {now, cachePath});
assert(third.days.at(-1).total === 180, 'append must count delta only');
const cache = readJson(cachePath);
assert(cache.version === 2, 'versioned cache');
assert(!JSON.stringify(cache).includes('synthetic'), 'session identity must be sanitized in cache');
writeJson(join(scratch, 'record.json'), {safe: true});
assert(readJson(join(scratch, 'record.json')).safe, 'atomic JSON roundtrip');
print('PASS: GJS history initial scan, cached scan, append, partial line, and private JSON cache');

const loop = new GLib.MainLoop(null, false);
let failed = false;
(async () => {
    try {
        assert((await runCommand(['/bin/echo', 'fixture'])).trim() === 'fixture', 'subprocess output');
        let timedOut = false;
        try { await runCommand(['/bin/sleep', '5'], {timeout: 50}); } catch { timedOut = true; }
        assert(timedOut, 'subprocess timeout');
        print('PASS: GJS subprocess communication, deadline and termination');
    } catch (error) {
        printerr(error.message);
        failed = true;
    } finally {
        loop.quit();
    }
})();
loop.run();
function remove(file) {
    if (file.query_file_type(Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null) === Gio.FileType.DIRECTORY) {
        const entries = file.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);
        let entry;
        while ((entry = entries.next_file(null)))
            remove(file.get_child(entry.get_name()));
        entries.close(null);
    }
    file.delete(null);
}
remove(Gio.File.new_for_path(scratch));
System.exit(failed ? 1 : 0);
