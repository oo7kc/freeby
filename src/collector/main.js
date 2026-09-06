import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GLibUnix from 'gi://GLibUnix';
import System from 'system';
import {record, section} from '../core/usage.js';
import {collectCodex} from '../providers/codex.js';
import {collectLegacy} from '../providers/legacy.js';
import {fingerprint, findCommand, join, readJson} from '../services/files.js';
import {scanHistory} from '../services/history.js';
import {requestJson} from '../services/http.js';
import {RpcClient, runCommand} from '../services/process.js';

const id = ARGV[0];
if (!['codex', 'cursor', 'copilot'].includes(id)) {
    printerr('Usage: gjs -m src/collector/main.js <codex|cursor|copilot> [retention-days]');
    System.exit(2);
}
const retention = Math.max(7, Math.min(90, Number(ARGV[1]) || 30));
const cancellable = new Gio.Cancellable();
const loop = new GLib.MainLoop(null, false);
const signal = GLibUnix.signal_add(GLib.PRIORITY_DEFAULT, 15, () => {
    cancellable.cancel();
    return GLib.SOURCE_CONTINUE;
});
const io = {
    fingerprint,
    scan(provider, suffixes, parser) {
        const root = GLib.getenv('CODEX_HOME') || join(GLib.get_home_dir(), '.codex');
        return scanHistory(provider, suffixes.map(suffix => join(root, suffix)), parser, {retention});
    },
    codexClient: () => new RpcClient([findCommand('codex'), 'app-server'], cancellable),
    http: (url, options) => requestJson(url, {...options, cancellable}),
    async token(provider) {
        if (provider === 'cursor') {
            const auth = readJson(join(GLib.get_user_config_dir(), 'cursor', 'auth.json'));
            return auth?.accessToken || null;
        }
        try {
            const value = await runCommand([findCommand('gh'), 'auth', 'token'], {timeout: 5000, cancellable});
            if (value.trim())
                return value.trim();
        } catch { /* Standalone setup token is also supported. */ }
        try {
            const [, bytes] = Gio.File.new_for_path(join(GLib.get_user_config_dir(), 'freeby', 'copilot-token')).load_contents(null);
            return new TextDecoder().decode(bytes).trim();
        } catch { return null; }
    },
};

(async () => {
    try {
        const result = id === 'codex' ? await collectCodex(io) : await collectLegacy(id, io);
        if (!cancellable.is_cancelled())
            print(JSON.stringify(result));
    } catch {
        const result = record(id);
        result.limits = {...result.limits, ...section('unavailable', 'Could not collect usage. Retry or check provider sign-in.')};
        if (!cancellable.is_cancelled())
            print(JSON.stringify(result));
    } finally {
        GLib.source_remove(signal);
        loop.quit();
    }
})();
loop.run();
