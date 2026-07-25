import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';
import GObject from 'gi://GObject';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

// How often to re-run the aggregator script, in seconds.
// Bumped up from the tighter 30s you'd want for a live dashboard — this
// data doesn't change fast enough to justify spawning a process that often.
const REFRESH_SECONDS = 120;

// Order matters here only for display order in the dropdown.
const PROVIDERS = ['codex', 'cursor', 'copilot'];

const SCRIPT_PATH = GLib.build_filenamev([
    GLib.get_home_dir(),
    '.local', 'bin', 'ai-usage.sh',
]);

const AiUsageIndicator = GObject.registerClass(
class AiUsageIndicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, 'AI Usage', false);

        this._label = new St.Label({
            text: 'AI',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.add_child(this._label);

        this._items = {};
        for (const key of PROVIDERS) {
            const item = new PopupMenu.PopupMenuItem(`${key}: —`, {
                reactive: false,
                can_focus: false,
            });
            this.menu.addMenuItem(item);
            this._items[key] = item;
        }

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._statusItem = new PopupMenu.PopupMenuItem('Last checked: never', {
            reactive: false,
            can_focus: false,
        });
        this._statusItem.label.add_style_class_name('ai-usage-status');
        this.menu.addMenuItem(this._statusItem);

        const refreshItem = new PopupMenu.PopupMenuItem('Refresh now');
        refreshItem.connect('activate', () => this._refresh());
        this.menu.addMenuItem(refreshItem);

        this._timeoutId = null;
        this._refresh();
        this._timeoutId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT, REFRESH_SECONDS,
            () => { this._refresh(); return GLib.SOURCE_CONTINUE; }
        );
    }

    _refresh() {
        let proc;
        try {
            proc = Gio.Subprocess.new(
                ['/bin/bash', SCRIPT_PATH],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            );
        } catch (e) {
            this._label.text = '⚠';
            logError(e, 'ai-usage: failed to spawn script');
            return;
        }

        proc.communicate_utf8_async(null, null, (proc_, res) => {
            let stdout, stderr;
            try {
                [, stdout, stderr] = proc_.communicate_utf8_finish(res);
            } catch (e) {
                this._label.text = '⚠';
                logError(e, 'ai-usage: subprocess communication failed');
                return;
            }

            if (!proc_.get_successful()) {
                this._label.text = '⚠';
                log(`ai-usage: script exited with error: ${stderr}`);
                return;
            }

            this._applyData(stdout);
        });
    }

    _applyData(stdout) {
        let data;
        try {
            data = JSON.parse(stdout);
        } catch (e) {
            this._label.text = '⚠';
            log(`ai-usage: could not parse script output as JSON: ${stdout}`);
            return;
        }

        const activeCount = PROVIDERS.filter(k => data[k]?.available).length;
        this._label.text = activeCount > 0 ? `AI (${activeCount})` : 'AI';

        for (const key of PROVIDERS) {
            const d = data[key];
            const item = this._items[key];
            if (!d) {
                item.label.text = `${key}: no data`;
            } else if (!d.available) {
                item.label.text = `${key}: ${d.summary || 'not wired up yet'}`;
            } else {
                item.label.text = `${key}: ${d.summary}`;
            }
        }

        const now = GLib.DateTime.new_now_local().format('%H:%M:%S');
        this._statusItem.label.text = `Last checked: ${now}`;
    }

    destroy() {
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = null;
        }
        super.destroy();
    }
});

export default class AiUsageExtension extends Extension {
    enable() {
        this._indicator = new AiUsageIndicator();
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
    }
}
