import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {NAMES, recentDates} from '../core/usage.js';
import {age, dateRange, modelName, tokens} from '../core/format.js';
import {historyOverview, latestUpdate, panelQuota, periodDays, providerStatus,
    quotaPresentation} from './presentation.js';
import {actionButton, button, dayChart, disclosureButton, label, meter, modelMeter,
    limitRow, providerIcon} from './widgets.js';

const TAB_NAMES = {claude: 'Claude'};
const PROVIDER_MARKS = {codex: '>_', claude: '✦', cursor: '⌁', copilot: '◆'};

export const UsageBeamIndicator = GObject.registerClass(class UsageBeamIndicator extends PanelMenu.Button {
    _init(settings, extensionPath, openPreferences) {
        super._init(0.5, 'UsageBeam usage monitor');
        this._settings = settings;
        this._extensionPath = extensionPath;
        this._openPreferences = openPreferences;
        this._service = null;
        this._detailsExpanded = false;
        this._panelStatus = new St.BoxLayout({style_class: 'usagebeam-panel-status'});
        this.add_child(this._panelStatus);
        this.menu.actor.add_style_class_name('usagebeam-menu');
        this._shellSettings = St.Settings.get();
        this._shellSettings.connectObject(
            'notify::color-scheme', () => this._syncColorScheme(),
            'notify::shell-color-scheme', () => this._syncColorScheme(), this);
        this._syncColorScheme();
        const section = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(section);
        // `content` is an inherited Clutter.Actor property whose value must be
        // ClutterContent, so keep the menu actor under an unambiguous name.
        this._contentBox = new St.BoxLayout({vertical: true, style_class: 'usagebeam-content', x_expand: true});
        section.box.add_child(this._contentBox);
        this.menu.connect('open-state-changed', (_menu, open) => {
            if (open) {
                this.resize();
                this._service?.refreshAll();
                this.render();
            } else {
                this._detailsExpanded = false;
            }
        });
        this.render();
    }

    _syncColorScheme() {
        const {colorScheme, shellColorScheme} = this._shellSettings;
        const light = shellColorScheme === 'prefer-light' ||
            (shellColorScheme !== 'prefer-dark' && colorScheme === St.SystemColorScheme.PREFER_LIGHT);
        this.menu.actor.remove_style_class_name(light ? 'usagebeam-dark' : 'usagebeam-light');
        this.menu.actor.add_style_class_name(light ? 'usagebeam-light' : 'usagebeam-dark');
    }

    resize() {
        const monitor = Main.layoutManager.findMonitorForActor(this) ?? Main.layoutManager.primaryMonitor;
        const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        const availableWidth = Math.max(240, Math.floor(monitor.width / scale) - 32);
        this._contentBox.style = `width: ${Math.min(392, availableWidth)}px;`;
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
        const busy = this._service?.isRefreshing(id) ?? false;

        this._renderPanelStatus(id, record);

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

    _renderPanelStatus(id, record) {
        this._panelStatus.destroy_all_children();
        const name = TAB_NAMES[id] ?? NAMES[id] ?? 'UsageBeam';
        const icon = providerIcon(id, this._extensionPath, 'usagebeam-panel-icon');
        if (icon)
            this._panelStatus.add_child(icon);
        else
            this._panelStatus.add_child(label(PROVIDER_MARKS[id] ?? 'AI', 'usagebeam-panel-mark'));
        this._panelStatus.add_child(label(name, 'usagebeam-panel-provider'));
        const quota = panelQuota(record);
        if (quota) {
            this._panelStatus.add_child(label(`${quota.percent}%`,
                `usagebeam-panel-value${quota.percent >= 100 ? ' usagebeam-danger' :
                    quota.percent >= 90 ? ' usagebeam-warning' : ''}`));
            if (quota.reset) {
                this._panelStatus.add_child(label('·', 'usagebeam-panel-separator'));
                this._panelStatus.add_child(label(quota.reset, 'usagebeam-panel-reset'));
            }
        }
        const resetDescription = quota?.reset === 'due' ? ', reset due' :
            quota?.reset ? `, resets in ${quota.reset}` : '';
        this.accessible_name = `UsageBeam, ${name}${quota ? `, ${quota.percent} percent used${resetDescription}` : ''}`;
    }

    _renderHeader(id, record, busy) {
        const header = new St.BoxLayout({style_class: 'usagebeam-header', x_expand: true});
        const icon = providerIcon(id, this._extensionPath, 'usagebeam-header-icon');
        if (icon)
            header.add_child(icon);
        else
            header.add_child(label(PROVIDER_MARKS[id] ?? 'AI', 'usagebeam-provider-mark'));
        const identity = new St.BoxLayout({vertical: true, style_class: 'usagebeam-identity', x_expand: true});
        identity.add_child(label(TAB_NAMES[id] ?? record?.name ?? 'UsageBeam', 'usagebeam-title'));
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
            const view = quotaPresentation(window);
            if (!view)
                continue;
            box.add_child(limitRow(view.name, view.value, view.reset));
            if (!window.unlimited) {
                const level = window.usedPercent >= 100 ? 'usagebeam-danger' :
                    window.usedPercent >= 90 ? 'usagebeam-warning' : '';
                const resetDescription = view.reset === 'due' ? ', reset due' :
                    view.reset ? `, resets in ${view.reset}` : '';
                box.add_child(meter(window.usedPercent / 100,
                    `${view.name}: ${view.value} used${resetDescription}`, level));
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
        const overview = historyOverview(history);
        this._heading(`LAST ${overview?.days ?? history.days.length} DAYS · ${tokens(overview?.total ?? 0)} TOKENS`, parent);
        const scope = history.scope === 'account' ? 'Account activity' : 'This device';
        parent.add_child(label(`${scope} · ${dateRange(history.period)}`, 'usagebeam-caption'));
        const today = recentDates(Date.now(), 1)[0];
        parent.add_child(dayChart(history.days, today));
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

    destroy() {
        this._shellSettings?.disconnectObject(this);
        this._shellSettings = null;
        super.destroy();
    }
});
