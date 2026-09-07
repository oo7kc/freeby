import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {NAMES, highestUsage, recentDates} from '../core/usage.js';
import {age, modelName, resetTime, tokens} from '../core/format.js';
import {historyOverview, latestUpdate, periodDays, providerStatus} from './presentation.js';
import {actionButton, button, disclosureButton, label, meter, modelMeter, row} from './widgets.js';

const TAB_NAMES = {claude: 'Claude'};
const PROVIDER_MARKS = {codex: '>_', claude: '✦', cursor: '⌁', copilot: '◆'};

export const UsageBeamIndicator = GObject.registerClass(class UsageBeamIndicator extends PanelMenu.Button {
    _init(settings, openPreferences) {
        super._init(0.0, 'UsageBeam usage monitor');
        this._settings = settings;
        this._openPreferences = openPreferences;
        this._service = null;
        this._detailsExpanded = false;
        this._panelLabel = label('AI', 'usagebeam-panel-label');
        this.add_child(this._panelLabel);
        this.menu.actor.add_style_class_name('usagebeam-menu');
        const section = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(section);
        // `content` is an inherited Clutter.Actor property whose value must be
        // ClutterContent, so keep the menu actor under an unambiguous name.
        this._contentBox = new St.BoxLayout({vertical: true, style_class: 'usagebeam-content', x_expand: true});
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
                const adjustment = this._scroll.vscroll?.adjustment;
                if (adjustment)
                    adjustment.value = 0;
            } else {
                this._detailsExpanded = false;
            }
        });
        this.render();
    }

    resize() {
        const monitor = Main.layoutManager.findMonitorForActor(this) ?? Main.layoutManager.primaryMonitor;
        const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        const availableHeight = Math.max(240, Math.floor(monitor.height / scale) - 96);
        const availableWidth = Math.max(240, Math.floor(monitor.width / scale) - 32);
        this._scroll.style = `max-height: ${Math.min(600, availableHeight)}px;`;
        this._contentBox.style = `width: ${Math.min(348, availableWidth)}px;`;
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
        const enabled = this._service?.enabledProviders ?? [];
        const requested = this._settings.get_string('default-provider');
        const id = enabled.includes(requested) ? requested : enabled[0];
        const record = this._service?.recordFor(id);
        const percent = highestUsage(record);
        const busy = this._service?.isRefreshing(id) ?? false;

        this._panelLabel.text = percent === null ? 'AI' : `AI · ${Math.round(percent)}%`;
        this._panelLabel.style_class = `usagebeam-panel-label${percent >= 100 ? ' usagebeam-danger' : percent >= 90 ? ' usagebeam-warning' : ''}`;
        this.accessible_name = `UsageBeam, ${record?.name ?? 'usage monitor'}${percent === null ? '' : `, ${Math.round(percent)} percent used`}`;

        this._renderHeader(id, record, busy);
        if (enabled.length > 1)
            this._renderSelector(enabled, id);
        if (record) {
            this._renderLimits(record.limits);
            this._renderHistory(record.history);
        } else {
            this._message('Choose your providers in preferences to get started.');
        }
        this._renderFooter(record, busy);
        this._restoreFocus(restoreName);
    }

    _renderHeader(id, record, busy) {
        const header = new St.BoxLayout({style_class: 'usagebeam-header', x_expand: true});
        header.add_child(label(PROVIDER_MARKS[id] ?? 'AI', `usagebeam-provider-mark usagebeam-${id}-mark`));
        const identity = new St.BoxLayout({vertical: true, style_class: 'usagebeam-identity', x_expand: true});
        identity.add_child(label(record?.name ?? 'UsageBeam', 'usagebeam-title'));
        identity.add_child(label(record?.plan ? String(record.plan).toUpperCase() : 'USAGE MONITOR', 'usagebeam-caption'));
        header.add_child(identity);
        const statusText = providerStatus(record, busy);
        header.add_child(label(`● ${statusText}`, `usagebeam-status usagebeam-status-${statusText.toLowerCase()}`));
        this._contentBox.add_child(header);
    }

    _renderSelector(enabled, selected) {
        const selector = new St.Widget({style_class: 'usagebeam-selector', x_expand: true,
            layout_manager: new Clutter.BoxLayout({orientation: Clutter.Orientation.HORIZONTAL,
                homogeneous: true, spacing: 8})});
        for (const provider of enabled) {
            selector.add_child(button(TAB_NAMES[provider] ?? NAMES[provider],
                () => this._settings.set_string('default-provider', provider),
                {active: provider === selected, name: `Show ${NAMES[provider]} usage`}));
        }
        this._contentBox.add_child(selector);
    }

    _renderLimits(limits) {
        this._heading('LIMITS');
        for (const window of limits.windows) {
            const box = new St.BoxLayout({vertical: true, style_class: 'usagebeam-window'});
            const value = window.unlimited ? 'Unlimited' : `${Math.round(window.usedPercent)}%`;
            box.add_child(row(window.label, value));
            if (!window.unlimited) {
                const level = window.usedPercent >= 100 ? 'usagebeam-danger' :
                    window.usedPercent >= 90 ? 'usagebeam-warning' : '';
                box.add_child(meter(window.usedPercent / 100, `${window.label}: ${value} used`, level));
                box.add_child(label(resetTime(window.resetsAt), 'usagebeam-caption'));
            }
            this._contentBox.add_child(box);
        }
        if (limits.status !== 'ready') {
            this._message(limits.message ||
                (limits.status === 'loading' ? 'Checking account limits…' : 'Limits unavailable'));
        }
        if (limits.status === 'stale')
            this._message(`Saved limits · ${age(limits.updatedAt).toLowerCase()}`);
    }

    _renderHistory(history) {
        const overview = historyOverview(history);
        if (overview) {
            const summary = [overview.days ? `${overview.days} days` : null,
                tokens(overview.total), overview.scope].filter(Boolean).join(' · ');
            this._contentBox.add_child(disclosureButton(summary, this._detailsExpanded, () => {
                this._detailsExpanded = !this._detailsExpanded;
                this.render();
            }));

            // Construct the complete view even while collapsed so lifecycle smoke
            // coverage continues to exercise every primary widget.
            const details = new St.BoxLayout({vertical: true, style_class: 'usagebeam-details',
                x_expand: true, visible: this._detailsExpanded});
            if (history.days.length)
                this._renderDays(history, details);
            if (history.models.length)
                this._renderModels(history, details);
            this._contentBox.add_child(details);
        }
        if (history.message && history.status !== 'ready')
            this._message(history.message);
    }

    _renderDays(history, parent = this._contentBox) {
        this._heading('TOKENS BY DAY', parent);
        const scope = history.scope === 'account' ? 'Account activity' : 'This device';
        parent.add_child(label(`${scope} · ${history.period.start} – ${history.period.end}`, 'usagebeam-caption'));
        const max = Math.max(1, ...history.days.map(day => day.total));
        const today = recentDates(Date.now(), 1)[0];
        for (const day of history.days) {
            const line = new St.BoxLayout({style_class: 'usagebeam-day-row', x_expand: true});
            const dayName = day.date === today ? 'Today' :
                new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, {weekday: 'short'});
            line.add_child(label(dayName, 'usagebeam-day'));
            if (day.date === today)
                line.add_style_class_name('usagebeam-today');
            const bar = meter(day.total / max, `${day.date}: ${tokens(day.total)} tokens`);
            bar.y_align = Clutter.ActorAlign.CENTER;
            line.add_child(bar);
            line.add_child(label(tokens(day.total), 'usagebeam-day-total'));
            line.accessible_name = `${dayName}, ${day.total} tokens, ${day.sessions ?? 0} sessions`;
            parent.add_child(line);
        }
    }

    _renderModels(history, parent = this._contentBox) {
        const modelScope = history.scope === 'account' ? 'ACCOUNT' : 'LOCAL';
        const days = periodDays(history.period);
        this._heading(`TOKENS BY MODEL${days ? ` · ${days}D` : ''} ${modelScope}`, parent);
        const max = Math.max(1, ...history.models.map(model => model.total));
        const visibleModels = history.models.slice(0, 4);
        for (const model of visibleModels) {
            const displayName = modelName(model.model);
            const cache = model.cacheRead + model.cacheWrite;
            const accessible = `${displayName}, ${model.total} tokens. Input ${model.input}, output ${model.output}, cache ${cache}.`;
            parent.add_child(modelMeter(displayName, tokens(model.total), model.total / max, accessible));
        }
        if (history.models.length > visibleModels.length)
            parent.add_child(label(`Top ${visibleModels.length} of ${history.models.length} models`, 'usagebeam-caption'));
    }

    _renderFooter(record, busy) {
        const actions = new St.BoxLayout({style_class: 'usagebeam-actions', x_expand: true});
        actions.add_child(label(busy ? 'Refreshing…' : age(latestUpdate(record)), 'usagebeam-caption', true));
        actions.add_child(actionButton('Refresh', () => this._service?.refreshAll(true), 'Refresh usage'));
        actions.add_child(actionButton('Settings', () => { this.menu.close(); this._openPreferences(); },
            'Open extension settings'));
        this._contentBox.add_child(actions);
    }

    _restoreFocus(name) {
        if (!name)
            return;
        const visit = actor => {
            if (actor.can_focus && actor.accessible_name === name)
                actor.grab_key_focus();
            for (const child of actor.get_children())
                visit(child);
        };
        visit(this._contentBox);
    }

    _heading(text, parent = this._contentBox) {
        parent.add_child(label(text, 'usagebeam-section-title'));
    }

    _message(text) {
        const message = label(text, 'usagebeam-message');
        message.clutter_text.line_wrap = true;
        this._contentBox.add_child(message);
    }
});
