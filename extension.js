import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';
import GObject from 'gi://GObject';

import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

const REFRESH_SECONDS = 120;
const PROVIDERS = ['codex', 'cursor', 'copilot'];

const PROVIDER_LABELS = {
    codex: 'Codex',
    cursor: 'Cursor',
    copilot: 'Copilot',
};

const SCRIPT_PATH = GLib.build_filenamev([
    GLib.get_home_dir(),
    '.local', 'bin', 'freeby.sh',
]);

const FreebyIndicator = GObject.registerClass(
class FreebyIndicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, 'Freeby', false);

        this._panelBox = new St.BoxLayout({ style_class: 'panel-status-menu-box freeby-panel' });
        this._label = new St.Label({
            text: 'AI',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'freeby-panel-label',
        });
        this._panelBox.add_child(this._label);
        this.add_child(this._panelBox);

        this.has_tooltip = true;
        this.tooltip_text = 'Loading...';

        this.connect('button-press-event', () => {
            this._refresh();
            return false;
        });

        this._items = {};
        for (const key of PROVIDERS) {
            const box = new St.BoxLayout({ style_class: 'freeby-item-box' });
            const dot = new St.Label({
                text: '\u25CB',
                style_class: 'freeby-dot freeby-dot-off',
                y_align: Clutter.ActorAlign.CENTER,
            });
            const name = new St.Label({
                text: PROVIDER_LABELS[key],
                style_class: 'freeby-item-name',
                y_align: Clutter.ActorAlign.CENTER,
            });
            const summary = new St.Label({
                text: '—',
                style_class: 'freeby-item-summary',
                y_align: Clutter.ActorAlign.CENTER,
            });
            box.add_child(dot);
            box.add_child(name);
            box.add_child(summary);

            const item = new PopupMenu.PopupMenuItem('', { reactive: false, can_focus: false });
            item.add_child(box);
            this.menu.addMenuItem(item);
            this._items[key] = { item, dot, summary };
        }

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._statusItem = new PopupMenu.PopupMenuItem('\u21BB Last checked: never', {
            reactive: true,
            can_focus: false,
        });
        this._statusItem.label.add_style_class_name('freeby-status');
        this._statusItem.connect('activate', () => this._refresh());
        this.menu.addMenuItem(this._statusItem);

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
            this._label.text = 'ai';
            this._label.style_class = 'freeby-panel-label';
            this.tooltip_text = 'Error loading data';
            logError(e, 'freeby: failed to spawn script');
            return;
        }

        proc.communicate_utf8_async(null, null, (proc_, res) => {
            let stdout, stderr;
            try {
                [, stdout, stderr] = proc_.communicate_utf8_finish(res);
            } catch (e) {
                this._label.text = 'ai';
                this._label.style_class = 'freeby-panel-label';
                this.tooltip_text = 'Error loading data';
                logError(e, 'freeby: subprocess communication failed');
                return;
            }

            if (!proc_.get_successful()) {
                this._label.text = 'ai';
                this._label.style_class = 'freeby-panel-label';
                this.tooltip_text = 'Error loading data';
                log(`freeby: script exited with error: ${stderr}`);
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
            this._label.text = 'ai';
            this._label.style_class = 'freeby-panel-label';
            this.tooltip_text = 'Error parsing data';
            log(`freeby: could not parse script output as JSON: ${stdout}`);
            return;
        }

        const activeCount = PROVIDERS.filter(k => data[k]?.has_remaining).length;
        const totalCount = PROVIDERS.filter(k => data[k]?.available).length;

        this._label.text = activeCount > 0 ? `ai\u00B7${activeCount}` : 'ai';

        let panelClass = 'freeby-panel-label';
        if (activeCount === totalCount && totalCount > 0) {
            panelClass += ' freeby-panel-green';
        } else if (activeCount > 0) {
            panelClass += ' freeby-panel-yellow';
        } else if (totalCount > 0) {
            panelClass += ' freeby-panel-red';
        }
        this._label.style_class = panelClass;

        const tooltipParts = [];
        for (const key of PROVIDERS) {
            const d = data[key];
            if (d?.available) {
                const status = d.has_remaining ? 'available' : 'at limit';
                tooltipParts.push(`${PROVIDER_LABELS[key]}: ${status}`);
            }
        }
        this.tooltip_text = tooltipParts.length > 0
            ? tooltipParts.join('\n')
            : 'No providers detected';

        for (const key of PROVIDERS) {
            const d = data[key];
            const { dot, summary } = this._items[key];
            if (!d) {
                dot.text = '\u25CB';
                dot.style_class = 'freeby-dot freeby-dot-off';
                summary.text = 'no data';
                summary.style_class = 'freeby-item-summary';
            } else if (!d.available) {
                dot.text = '\u25CB';
                dot.style_class = 'freeby-dot freeby-dot-off';
                summary.text = d.summary || 'not available';
                summary.style_class = 'freeby-item-summary freeby-dim';
            } else if (d.summary && d.summary.includes('limit reached')) {
                dot.text = '\u25CF';
                dot.style_class = 'freeby-dot freeby-dot-red';
                summary.text = d.summary;
                summary.style_class = 'freeby-item-summary freeby-red';
            } else if (d.summary && (d.summary.includes('expired') || d.summary.includes('parse error'))) {
                dot.text = '\u25CF';
                dot.style_class = 'freeby-dot freeby-dot-yellow';
                summary.text = d.summary;
                summary.style_class = 'freeby-item-summary freeby-yellow';
            } else {
                dot.text = '\u25CF';
                dot.style_class = 'freeby-dot freeby-dot-green';
                summary.text = d.summary;
                summary.style_class = 'freeby-item-summary freeby-green';
            }
        }

        const now = GLib.DateTime.new_now_local().format('%H:%M:%S');
        this._statusItem.label.text = `\u21BB Last checked: ${now}`;
    }

    destroy() {
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = null;
        }
        super.destroy();
    }
});

export default class FreebyExtension extends Extension {
    enable() {
        this._indicator = new FreebyIndicator();
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
    }
}
