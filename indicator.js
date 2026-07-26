import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';
import GObject from 'gi://GObject';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

const PROVIDERS = ['codex', 'cursor', 'copilot'];
const LABELS = { codex: 'Codex', cursor: 'Cursor', copilot: 'Copilot' };
const SCRIPT = GLib.build_filenamev([GLib.get_home_dir(), '.local', 'bin', 'freeby.sh']);

export const FreebyIndicator = GObject.registerClass(
class FreebyIndicator extends PanelMenu.Button {
    _init(settings) {
        super._init(0.0, 'Freeby', false);
        this._settings = settings;
        this._prev = {};
        for (const k of PROVIDERS) this._prev[k] = null;
        this._refreshSeq = 0;

        this._panelBox = new St.BoxLayout({ style_class: 'panel-status-menu-box freeby-panel', accessible_name: 'Freeby usage indicator' });
        this._label = new St.Label({ text: 'AI', y_align: Clutter.ActorAlign.CENTER, style_class: 'freeby-panel-label', accessible_name: 'Usage count' });
        this._panelBox.add_child(this._label);
        this.add_child(this._panelBox);
        this.connect('button-press-event', () => { this._refresh(); return false; });

        this._items = {};
        for (const k of PROVIDERS) {
            const box = new St.BoxLayout({ style_class: 'freeby-item-box', accessible_name: `${LABELS[k]} usage` });
            const dot = new St.Label({ text: '\u25CB', style_class: 'freeby-dot freeby-dot-off', y_align: Clutter.ActorAlign.CENTER, accessible_name: `${LABELS[k]} status` });
            const name = new St.Label({ text: LABELS[k], style_class: 'freeby-item-name', y_align: Clutter.ActorAlign.CENTER });
            const summary = new St.Label({ text: '\u2014', style_class: 'freeby-item-summary', y_align: Clutter.ActorAlign.CENTER, accessible_name: `${LABELS[k]} summary` });
            box.add_child(dot);
            box.add_child(name);
            box.add_child(summary);
            const item = new PopupMenu.PopupMenuItem('', { reactive: false, can_focus: false });
            item.add_child(box);
            this.menu.addMenuItem(item);
            this._items[k] = { dot, summary };
        }

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._statusItem = new PopupMenu.PopupMenuItem('\u21BB Last checked: never', { reactive: true, can_focus: false, accessible_name: 'Refresh status' });
        this._statusItem.label.add_style_class_name('freeby-status');
        this._statusItem.connect('activate', () => { this._refresh(); this.menu.open(); });
        this.menu.addMenuItem(this._statusItem);

        this._timerId = null;
        this._setupTimer();
        this._refresh();
        this._monitorWake();
    }

    _setupTimer() {
        if (this._timerId) GLib.source_remove(this._timerId);
        const sec = Math.max(30, this._settings.get_int('refresh-interval'));
        this._timerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, sec, () => { this._refresh(); return GLib.SOURCE_CONTINUE; });
    }

    _monitorWake() {
        try {
            this._sleepId = Gio.DBus.system.signal_subscribe(
                'org.freedesktop.login1', 'org.freedesktop.login1.Manager',
                'PrepareForSleep', '/org/freedesktop/login1', null, Gio.DBusSignalFlags.NONE,
                (_, __, ___, ____, _____, params) => {
                    if (params.get_child_value(0).get_boolean()) {
                        log('freeby: woke from sleep, refreshing');
                        this._refresh();
                    }
                });
        } catch (e) { logError(e, 'freeby: could not monitor sleep/wake'); }
    }

    _notify(title, body) {
        if (!this._settings.get_boolean('notifications-enabled')) return;
        try {
            const src = new Main.messageTray.Source('Freeby', 'dialog-information-symbolic');
            Main.messageTray.add(src);
            src.addNotification(new Main.messageTray.Notification({ source: src, title, body }));
        } catch (e) { logError(e, 'freeby: notification failed'); }
    }

    _setError() {
        this._label.text = 'ai';
        this._label.style_class = 'freeby-panel-label';
    }

    _refresh() {
        this._refreshSeq++;
        const seq = this._refreshSeq;
        let proc;
        try { proc = Gio.Subprocess.new(['/bin/bash', SCRIPT], Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE); }
        catch (e) { this._setError(); logError(e, 'freeby: failed to spawn script'); return; }

        proc.communicate_utf8_async(null, null, (p, res) => {
            if (seq !== this._refreshSeq) return;
            let stdout, stderr;
            try { [, stdout, stderr] = p.communicate_utf8_finish(res); }
            catch (e) { this._setError(); logError(e, 'freeby: subprocess failed'); return; }
            if (!p.get_successful()) { this._setError(); log(`freeby: script error: ${stderr}`); return; }
            this._apply(stdout);
        });
    }

    _apply(stdout) {
        let data;
        try { data = JSON.parse(stdout); }
        catch (e) { this._setError(); logError(e, 'freeby: bad JSON'); return; }
        if (!data || typeof data !== 'object') { this._setError(); log('freeby: empty or invalid data'); return; }

        const active = PROVIDERS.filter(k => data[k]?.has_remaining).length;
        const total = PROVIDERS.filter(k => data[k]?.available).length;
        this._label.text = active > 0 ? `ai\u00B7${active}` : 'ai';
        this._label.style_class = 'freeby-panel-label' + (active === total && total > 0 ? ' freeby-panel-green' : active > 0 ? ' freeby-panel-yellow' : total > 0 ? ' freeby-panel-red' : '');

        const hit = PROVIDERS.filter(k => data[k]?.available && !data[k].has_remaining && this._prev[k]?.has_remaining !== false).map(k => LABELS[k]);
        this._prev = {};
        for (const k of PROVIDERS) this._prev[k] = data[k] ? { has_remaining: data[k].has_remaining } : null;
        if (hit.length) this._notify('Usage limit reached', `${hit.join(', ')} ${hit.length === 1 ? 'has' : 'have'} hit their limit`);

        for (const k of PROVIDERS) {
            const d = data[k], { dot, summary } = this._items[k];
            if (!d) { dot.text = '\u25CB'; dot.style_class = 'freeby-dot freeby-dot-off'; summary.text = 'no data'; summary.style_class = 'freeby-item-summary'; }
            else if (!d.available) { dot.text = '\u25CB'; dot.style_class = 'freeby-dot freeby-dot-off'; summary.text = d.summary || 'not available'; summary.style_class = 'freeby-item-summary freeby-dim'; }
            else if (d.summary?.includes('limit reached')) { dot.text = '\u25CF'; dot.style_class = 'freeby-dot freeby-dot-red'; summary.text = d.summary; summary.style_class = 'freeby-item-summary freeby-red'; }
            else if (d.summary?.includes('expired') || d.summary?.includes('parse error')) { dot.text = '\u25CF'; dot.style_class = 'freeby-dot freeby-dot-yellow'; summary.text = d.summary; summary.style_class = 'freeby-item-summary freeby-yellow'; }
            else { dot.text = '\u25CF'; dot.style_class = 'freeby-dot freeby-dot-green'; summary.text = d.summary; summary.style_class = 'freeby-item-summary freeby-green'; }
        }
        this._statusItem.label.text = `\u21BB Last checked: ${GLib.DateTime.new_now_local().format('%H:%M:%S')}`;
    }

    destroy() {
        if (this._timerId) { GLib.source_remove(this._timerId); this._timerId = null; }
        if (this._sleepId) { Gio.DBus.system.signal_unsubscribe(this._sleepId); this._sleepId = null; }
        super.destroy();
    }
});
