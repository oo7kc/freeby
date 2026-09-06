import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {NAMES, highestUsage, recentDates} from '../core/usage.js';
import {age, resetTime, tokens} from '../core/format.js';
import {button, label, meter, row} from './widgets.js';

export const FreebyIndicator = GObject.registerClass(class FreebyIndicator extends PanelMenu.Button {
    _init(settings, openPreferences) {
        super._init(0.0, 'Freeby usage monitor');
        this._settings = settings;
        this._openPreferences = openPreferences;
        this._service = null;
        this._panelLabel = label('AI', 'freeby-panel-label');
        this.add_child(this._panelLabel);
        this.menu.actor.add_style_class_name('freeby-menu');
        const section = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(section);
        // `content` is an inherited Clutter.Actor property whose value must be
        // ClutterContent, so keep the menu actor under an unambiguous name.
        this._contentBox = new St.BoxLayout({vertical: true, style_class: 'freeby-content', x_expand: true});
        this._scroll = new St.ScrollView({hscrollbar_policy: St.PolicyType.NEVER, vscrollbar_policy: St.PolicyType.AUTOMATIC,
            overlay_scrollbars: true});
        // St.ScrollView is a Clutter actor in GNOME 50. Its inherited
        // set_child() targets ClutterContent, so add the scrollable actor as a
        // child explicitly.
        this._scroll.add_child(this._contentBox);
        section.box.add_child(this._scroll);
        this.menu.connect('open-state-changed', (_menu, open) => {
            if (open) {
                this.resize();
                this._service?.refreshAll();
                this.render();
            }
        });
        this.render();
    }

    resize() {
        const monitor = Main.layoutManager.findMonitorForActor(this) ?? Main.layoutManager.primaryMonitor;
        const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        this._scroll.style = `max-height: ${Math.max(180, Math.floor(monitor.height / scale) - 120)}px;`;
        this._contentBox.style = `width: ${Math.min(420, Math.floor(monitor.width / scale) - 64)}px;`;
    }

    attach(service) {
        this._service = service;
        this.render();
    }

    render() {
        if (!this._contentBox)
            return;
        const focus = global.stage.get_key_focus();
        const restoreName = focus && this._contentBox.contains(focus) ? focus.accessible_name : null;
        this._contentBox.destroy_all_children();
        const enabled = this._service?.enabled ?? [];
        const requested = this._settings.get_string('default-provider');
        const id = enabled.includes(requested) ? requested : enabled[0];
        const record = this._service?.records[id];
        const percent = highestUsage(record);
        this._panelLabel.text = percent === null ? 'AI' : `AI ${Math.round(percent)}%`;
        this._panelLabel.style_class = `freeby-panel-label${percent >= 100 ? ' freeby-danger' : percent >= 90 ? ' freeby-warning' : ''}`;
        this.accessible_name = `Freeby, ${record?.name ?? 'usage monitor'}${percent === null ? '' : `, ${Math.round(percent)} percent used`}`;
        const header = new St.BoxLayout({vertical: true, style_class: 'freeby-header'});
        header.add_child(label(record?.name ?? 'Freeby', 'freeby-title'));
        header.add_child(label(record?.plan ? String(record.plan).toUpperCase() : 'USAGE MONITOR', 'freeby-caption'));
        this._contentBox.add_child(header);
        if (enabled.length > 1) {
            const selector = new St.BoxLayout({style_class: 'freeby-selector', x_expand: true});
            for (const provider of enabled)
                selector.add_child(button(NAMES[provider], () => this._settings.set_string('default-provider', provider),
                    {active: provider === id, name: `Show ${NAMES[provider]} usage`}));
            this._contentBox.add_child(selector);
        }
        if (!record) {
            this._contentBox.add_child(label('Choose your providers in preferences to get started.', 'freeby-message'));
        } else {
            this.heading('LIMITS');
            for (const window of record.limits.windows) {
                const box = new St.BoxLayout({vertical: true, style_class: 'freeby-window'});
                const value = window.unlimited ? 'Unlimited' : `${Math.round(window.usedPercent)}%`;
                box.add_child(row(window.label, value));
                if (!window.unlimited)
                    box.add_child(meter(window.usedPercent / 100, `${window.label}: ${value} used`,
                        window.usedPercent >= 100 ? 'freeby-danger' : window.usedPercent >= 90 ? 'freeby-warning' : ''));
                box.add_child(label(resetTime(window.resetsAt), 'freeby-caption'));
                this._contentBox.add_child(box);
            }
            if (record.limits.status !== 'ready')
                this.message(record.limits.message || (record.limits.status === 'loading' ? 'Checking account limits…' : 'Limits unavailable'));
            if (record.limits.status === 'stale')
                this.message(`Saved limits · ${age(record.limits.updatedAt).toLowerCase()}`);
            if (record.history.days.length) {
                this.heading('TOKENS BY DAY');
                this._contentBox.add_child(label(`${record.history.scope === 'account' ? 'Account activity' : 'This device'} · ${record.history.period.start} – ${record.history.period.end}`, 'freeby-caption'));
                const max = Math.max(1, ...record.history.days.map(day => day.total));
                const today = recentDates(Date.now(), 1)[0];
                for (const day of record.history.days) {
                    const line = new St.BoxLayout({style_class: 'freeby-day-row', x_expand: true});
                    const dayName = day.date === today ? 'Today' : new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, {weekday: 'short'});
                    line.add_child(label(dayName, 'freeby-day'));
                    const bar = meter(day.total / max, `${day.date}: ${tokens(day.total)} tokens`);
                    bar.y_align = Clutter.ActorAlign.CENTER;
                    line.add_child(bar);
                    line.add_child(label(tokens(day.total), 'freeby-day-total'));
                    line.accessible_name = `${dayName}, ${day.total} tokens, ${day.sessions ?? 0} sessions`;
                    this._contentBox.add_child(line);
                }
            }
            if (record.history.models.length) {
                this.heading('TOKENS BY MODEL');
                this._contentBox.add_child(label('Same period as daily activity', 'freeby-caption'));
                const max = Math.max(1, ...record.history.models.map(model => model.total));
                for (const model of record.history.models) {
                    const box = new St.BoxLayout({vertical: true, style_class: 'freeby-model'});
                    box.add_child(row(model.model, tokens(model.total)));
                    box.add_child(meter(model.total / max, `${model.model}: ${model.total} tokens`));
                    box.add_child(label(`Input ${tokens(model.input)} · Output ${tokens(model.output)} · Cache ${tokens(model.cacheRead + model.cacheWrite)}`, 'freeby-caption'));
                    this._contentBox.add_child(box);
                }
            }
            if (record.history.message)
                this.message(record.history.message);
        }
        this.heading('');
        const busy = this._service?.jobs.has(id);
        this._contentBox.add_child(label(busy ? 'Refreshing…' : age(record?.limits.updatedAt || record?.history.updatedAt), 'freeby-caption'));
        const actions = new St.BoxLayout({style_class: 'freeby-selector'});
        actions.add_child(button('Refresh', () => this._service?.refreshAll(true), {name: 'Refresh usage'}));
        actions.add_child(button('Preferences', () => { this.menu.close(); this._openPreferences(); }));
        this._contentBox.add_child(actions);
        if (restoreName) {
            const restore = actor => {
                if (actor.can_focus && actor.accessible_name === restoreName)
                    actor.grab_key_focus();
                for (const child of actor.get_children())
                    restore(child);
            };
            restore(this._contentBox);
        }
    }

    heading(text) {
        this._contentBox.add_child(label(text, 'freeby-section-title'));
    }

    message(text) {
        const message = label(text, 'freeby-message');
        message.clutter_text.line_wrap = true;
        this._contentBox.add_child(message);
    }
});
