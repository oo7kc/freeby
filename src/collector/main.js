import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GLibUnix from 'gi://GLibUnix';
import System from 'system';
import {record, section, validateRecord} from '../core/usage.js';
import {collectClaude} from '../providers/claude.js';
import {collectCodex} from '../providers/codex.js';
import {collectCopilot} from '../providers/copilot.js';
import {collectCursor} from '../providers/cursor.js';
import {commandSpec, findCommand} from '../services/commands.js';
import {fingerprint, join, readJson, readText} from '../services/files.js';
import {scanHistory} from '../services/history.js';
import {requestJson} from '../services/http.js';
import {RpcClient, runCommand} from '../services/process.js';

const COLLECTORS = Object.freeze({codex: collectCodex, claude: collectClaude,
    cursor: collectCursor, copilot: collectCopilot});
const HISTORY_ROOTS = {
    codex: GLib.getenv('CODEX_HOME') || join(GLib.get_home_dir(), '.codex'),
    claude: GLib.getenv('CLAUDE_CONFIG_DIR') || join(GLib.get_home_dir(), '.claude'),
};
const token = value => typeof value === 'string' && value.trim().length <= 8192 &&
    !/[\u0000-\u001f\u007f]/.test(value.trim()) ? value.trim() : null;
const id = ARGV[0];
if (!Object.prototype.hasOwnProperty.call(COLLECTORS, id)) {
    printerr('Usage: gjs -m src/collector/main.js <codex|claude|cursor|copilot> [retention-days]');
    System.exit(2);
}
const retentionText = ARGV[1] ?? '';
const requestedRetention = /^\d+$/.test(retentionText) ? Number(retentionText) : 30;
const retention = Math.max(7, Math.min(90, Number.isSafeInteger(requestedRetention) ? requestedRetention : 30));
const cancellable = new Gio.Cancellable();
const loop = new GLib.MainLoop(null, false);
let signal = GLibUnix.signal_add(GLib.PRIORITY_DEFAULT, 15, () => {
    signal = 0;
    cancellable.cancel();
    return GLib.SOURCE_REMOVE;
});
const io = {
    fingerprint,
    now: () => Date.now(),
    hasCommand(name) {
        try { findCommand(name); return true; } catch { return false; }
    },
    scan(provider, suffixes, parser) {
        const root = HISTORY_ROOTS[provider];
        if (!root)
            throw new Error(`Unsupported local history provider: ${provider}`);
        return scanHistory(provider, suffixes.map(suffix => join(root, suffix)), parser, {retention});
    },
    credentials(provider) {
        if (provider === 'claude')
            return readJson(join(HISTORY_ROOTS.claude, '.credentials.json'), null, 1024 * 1024);
        return null;
    },
    codexClient: () => new RpcClient(commandSpec('codex', ['app-server'], {runtimes: ['node']}), cancellable),
    http: (url, options) => requestJson(url, {...options, cancellable}),
    async token(provider) {
        if (provider === 'cursor') {
            const auth = readJson(join(GLib.get_user_config_dir(), 'cursor', 'auth.json'), null, 1024 * 1024);
            return token(auth?.accessToken);
        }
        if (provider !== 'copilot')
            return null;
        try {
            const value = await runCommand(commandSpec('gh', ['auth', 'token']),
                {timeout: 5000, cancellable, maxOutputBytes: 64 * 1024});
            const cleaned = token(value);
            if (cleaned)
                return cleaned;
        } catch { /* Standalone setup token is also supported. */ }
        return token(readText(join(GLib.get_user_config_dir(), 'freeby', 'copilot-token'), null, 64 * 1024));
    },
};

(async () => {
    try {
        const result = validateRecord(await COLLECTORS[id](io), id);
        if (!cancellable.is_cancelled())
            print(JSON.stringify(result));
    } catch {
        const result = record(id);
        result.limits = {...result.limits, ...section('unavailable', 'Could not collect usage. Retry or check provider sign-in.')};
        result.history = {...result.history, ...section('unavailable', 'Could not collect local history.')};
        if (!cancellable.is_cancelled())
            print(JSON.stringify(result));
    } finally {
        if (signal)
            GLib.source_remove(signal);
        loop.quit();
    }
})();
loop.run();
