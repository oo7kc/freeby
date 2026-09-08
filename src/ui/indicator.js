import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Pango from 'gi://Pango';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {NAMES, recentDates} from '../core/usage.js';
import {age, modelName, tokens} from '../core/format.js';
import {quotaSeverity} from '../core/thresholds.js';
import {initialLayout, nextLayout, pageSlice} from './layoutPolicy.js';
import {historyOverview, latestUpdate, panelQuota, periodDays, providerStatus,
    quotaPresentation} from './presentation.js';
import {actionButton, button, dayChart, disclosureButton, label, meter, modelMeter,
    limitRow, metricLabel, pageControls, providerIcon, separatorDot} from './widgets.js';

const TAB_NAMES = {claude: 'Claude'};
const PROVIDER_MARKS = {codex: '>_', claude: '✦'};

export const UsageBeamIndicator = GObject.registerClass(class UsageBeamIndicator extends PanelMenu.Button {
    _init(settings, extensionPath, openPreferences) {
        super._init(0.5, 'UsageBeam usage monitor');
        this.add_style_class_name('usagebeam-panel-button');
        this._settings = settings;
        this._extensionPath = extensionPath;
        this._openPreferences = openPreferences;
        this._service = null;
        this._detailsExpanded = false;
        this._limitPage = 0;
        this._activityPage = 0;
        this._modelPage = 0;
        this._sectionPage = 0;
        this._panelStatus = new St.BoxLayout({style_class: 'usagebeam-panel-status',
            x_expand: true, x_align: Clutter.ActorAlign.START});
        this._panelIcon = new St.Bin({style_class: 'usagebeam-panel-icon-slot', y_align: Clutter.ActorAlign.CENTER});
        this._panelProvider = label('UsageBeam', 'usagebeam-panel-provider');
        this._panelProvider.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        this._panelValue = metricLabel('—', 'usagebeam-panel-value');
        this._panelReset = metricLabel('—', 'usagebeam-panel-reset');
        this._panelSeparator = separatorDot('usagebeam-panel-separator');
        for (const actor of [this._panelIcon, this._panelProvider, this._panelValue,
            this._panelSeparator, this._panelReset])
            this._panelStatus.add_child(actor);
        this._panelProviderId = null;
        // Reserve stable panel space separately from the naturally sized readout.
        // The unused space belongs on the side away from the calendar.
        this.add_child(new St.Bin({style_class: 'usagebeam-panel-slot', child: this._panelStatus}));
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
        const restyle = () => { this._layout = null; this.render(); };
        Main.layoutManager.connectObject('monitors-changed', restyle, this);
        St.ThemeContext.get_for_stage(global.stage).connectObject('changed', restyle, this);
        this.menu.connect('open-state-changed', (_menu, open) => {
            if (open) {
                this._layout = null;
                this.resize();
                this._service?.refreshAll();
                this.render();
            } else {
                this._detailsExpanded = false;
                this._layout = null;
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
        const work = Main.layoutManager.getWorkAreaForMonitor(monitor.index);
        const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        const availableWidth = Math.max(160, Math.floor(work.width / scale) - 64);
        this._contentBox.style = `width: ${Math.min(392, availableWidth)}px;`;
        // Allow for the native popup frame, panel gap, and our content padding.
        this._contentHeightBudget = Math.max(80, work.height - 48 * scale);
    }

    attach(service) {
        this._service = service;
        this.render();
    }

    alignPanelContent(position) {
        this._panelStatus.x_align = position === 'left-of-calendar'
            ? Clutter.ActorAlign.END : Clutter.ActorAlign.START;
    }

    render() {
        if (!this._contentBox)
            return;
        const focus = global.stage.get_key_focus();
        const restoreName = focus && this._contentBox.contains(focus) ? focus.accessible_name : null;
        const enabled = this._service?.enabledProviders ?? [];
        const requested = this._settings.get_string('default-provider');
        const id = enabled.includes(requested) ? requested : enabled[0];
        const record = this._service?.recordFor(id);
        const busy = this._service?.isRefreshing(id) ?? false;
        if (this._renderedProvider !== id) {
            this._limitPage = this._activityPage = this._modelPage = this._sectionPage = 0;
            this._layout = null;
            this._renderedProvider = id;
        }
        const layoutKey = JSON.stringify([record?.plan, record?.limits.status, record?.limits.message,
            record?.limits.windows.map(window => [window.label, window.unlimited]),
            record?.history.status, record?.history.message,
            record?.history.days.length, record?.history.models.map(model => model.model)]);
        if (this._layoutKey !== layoutKey) {
            this._layoutKey = layoutKey;
            this._layout = null;
            this._limitPage = this._modelPage = this._sectionPage = 0;
        }
        this._renderPanelStatus(id, record);
        this.resize();
        // Keep page sizes stable while navigating, even on a shorter last page.
        // A new opening, provider, theme or monitor starts a fresh measurement.
        this._layout ??= initialLayout();
        // Fit before the next paint. Never rebuild from allocation callbacks,
        // which caused the old bar flicker and recursive growth.
        while (this._layout) {
            this._contentBox.destroy_all_children();
            this._contentBox.style_class = `usagebeam-content${this._layout.compact ? ' usagebeam-compact' : ''}`;
            this._buildContent(enabled, id, record, busy);
            const width = this._contentBox.get_preferred_width(-1)[1];
            if (this._contentBox.get_preferred_height(width)[1] <= this._contentHeightBudget)
                break;
            const next = nextLayout(this._layout, this._detailsExpanded);
            if (!next)
                break;
            this._layout = next;
        }
        this._restoreFocus(restoreName);
    }

    _buildContent(enabled, id, record, busy) {
        this._renderHeader(id, record, busy);
        if (enabled.length > 1)
            this._renderSelector(enabled, id);
        if (record) {
            if (this._layout.splitSections)
                this._contentBox.add_child(pageControls('View', this._sectionPage, 2, value => {
                    this._sectionPage = value;
                    this.render();
                }));
            if (!this._layout.splitSections || this._sectionPage === 0)
                this._renderLimits(record.limits);
            if (!this._layout.splitSections || this._sectionPage === 1)
                this._renderHistory(record.history);
        } else {
            this._message('Choose your providers in preferences to get started.');
        }
        this._renderFooter(record, busy);
    }

    _renderPanelStatus(id, record) {
        const name = TAB_NAMES[id] ?? NAMES[id] ?? 'UsageBeam';
        if (this._panelProviderId !== id) {
            this._panelIcon.get_child()?.destroy();
            this._panelIcon.set_child(providerIcon(id, this._extensionPath, 'usagebeam-panel-icon') ??
                label(PROVIDER_MARKS[id] ?? 'AI', 'usagebeam-panel-mark'));
            this._panelProviderId = id;
        }
        this._panelProvider.text = name;
        const quota = panelQuota(record);
        this._panelValue.text = quota ? `${quota.percent}%` : '—';
        const severity = quotaSeverity(quota?.percent);
        this._panelValue.style_class = `usagebeam-panel-value${severity ? ` usagebeam-${severity}` : ''}`;
        this._panelReset.text = quota?.reset ?? '—';
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
        const plan = label(record?.plan ? String(record.plan).toUpperCase() : 'USAGE MONITOR', 'usagebeam-caption');
        plan.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        identity.add_child(plan);
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
        const page = pageSlice(limits.windows.filter(window => quotaPresentation(window)), this._limitPage, this._layout.limits);
        for (const window of page.items) {
            const box = new St.BoxLayout({vertical: true, style_class: 'usagebeam-window'});
            const view = quotaPresentation(window);
            if (!view)
                continue;
            const severity = quotaSeverity(window.usedPercent);
            box.add_child(limitRow(view.name, view.value, severity));
            if (!window.unlimited) {
                box.add_child(meter(window.usedPercent / 100,
                    `${view.name}: ${view.value} used, ${view.reset.toLowerCase()}`,
                    severity ? `usagebeam-${severity}` : ''));
                box.add_child(label(view.reset, 'usagebeam-limit-reset'));
            }
            this._contentBox.add_child(box);
        }
        if (page.pages > 1)
            this._contentBox.add_child(pageControls('Limits', page.page, page.pages, value => {
                this._limitPage = value;
                this.render();
            }));
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
            this._contentBox.add_child(disclosureButton(this._detailsExpanded, () => {
                this._detailsExpanded = !this._detailsExpanded;
                this._layout = null;
                this._limitPage = this._activityPage = this._modelPage = this._sectionPage = 0;
                this.render();
            }));

            if (this._detailsExpanded)
                this._renderActivity(history);
        }
        if (history.message && history.status !== 'ready')
            this._message(history.message);
    }

    _renderActivity(history) {
        const details = new St.BoxLayout({vertical: true, style_class: 'usagebeam-details', x_expand: true});
        const split = this._layout.splitActivity && history.days.length && history.models.length;
        if (split)
            details.add_child(pageControls('Activity', this._activityPage, 2, value => {
                this._activityPage = value;
                this.render();
            }));
        if (history.days.length && (!split || this._activityPage === 0))
            this._renderDays(history, details);
        if (history.models.length && (!split || this._activityPage === 1))
            this._renderModels(history, details);
        this._contentBox.add_child(details);
    }

    _renderDays(history, parent = this._contentBox) {
        const overview = historyOverview(history);
        this._heading(`LAST ${overview?.days ?? history.days.length} DAYS · ${tokens(overview?.total ?? 0)} TOKENS`, parent);
        const today = recentDates(Date.now(), 1)[0];
        parent.add_child(dayChart(history.days, today));
    }

    _renderModels(history, parent = this._contentBox) {
        const modelScope = history.scope === 'account' ? 'ACCOUNT' : 'LOCAL';
        const days = periodDays(history.period);
        this._heading(`TOKENS BY MODEL${days ? ` · ${days}D` : ''} ${modelScope}`, parent);
        const max = Math.max(1, ...history.models.map(model => model.total));
        const page = pageSlice(history.models, this._modelPage, this._layout.models);
        for (const model of page.items) {
            const displayName = modelName(model.model);
            const cache = model.cacheRead + model.cacheWrite;
            const accessible = `${displayName}, ${model.total} tokens. Input ${model.input}, output ${model.output}, cache ${cache}.`;
            parent.add_child(modelMeter(displayName, tokens(model.total), model.total / max, accessible));
        }
        if (page.pages > 1)
            parent.add_child(pageControls('Models', page.page, page.pages, value => {
                this._modelPage = value;
                this.render();
            }));
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
        const actors = [];
        const visit = actor => { actors.push(actor); actor.get_children().forEach(visit); };
        visit(this._contentBox);
        const opposite = name.startsWith('Next ') ? name.replace('Next ', 'Previous ')
            : name.startsWith('Previous ') ? name.replace('Previous ', 'Next ') : null;
        const target = [name, opposite].filter(Boolean).map(candidate =>
            actors.find(actor => actor.can_focus && actor.accessible_name === candidate)).find(Boolean);
        target?.grab_key_focus();
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
        Main.layoutManager.disconnectObject(this);
        St.ThemeContext.get_for_stage(global.stage).disconnectObject(this);
        this._shellSettings?.disconnectObject(this);
        this._shellSettings = null;
        super.destroy();
    }
});
