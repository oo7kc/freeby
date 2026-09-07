import Atk from 'gi://Atk';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import Pango from 'gi://Pango';
import St from 'gi://St';
import {compactTokens} from '../core/format.js';
import {UsageBeamBar} from './bar.js';

const PROVIDER_ICONS = new Set(['claude', 'codex']);
const PROVIDER_ICON_FILES = {claude: 'claude.svg', codex: 'codex-symbolic.svg'};

export function label(text, style = '', expand = false) {
    return new St.Label({text: String(text ?? ''), style_class: style,
        y_align: Clutter.ActorAlign.CENTER, x_expand: expand});
}

export function metricLabel(text, style = '', expand = false) {
    const actor = label(text, style, expand);
    actor.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
    return actor;
}

export function separatorDot(style = '') {
    const dot = new St.Widget({style_class: 'usagebeam-separator-dot-core'});
    return new St.Bin({
        child: dot,
        style_class: `usagebeam-separator-dot ${style}`.trim(),
        x_align: Clutter.ActorAlign.CENTER,
        y_align: Clutter.ActorAlign.CENTER,
    });
}

function metricColumn(text, style, alignment = Clutter.ActorAlign.END) {
    const child = metricLabel(text, '', true);
    child.x_align = alignment;
    return new St.Bin({style_class: style, child});
}

export function providerIcon(provider, extensionPath, style = '') {
    if (!PROVIDER_ICONS.has(provider))
        return null;
    return new St.Icon({
        gicon: new Gio.FileIcon({
            file: Gio.File.new_for_path(`${extensionPath}/icons/${PROVIDER_ICON_FILES[provider]}`),
        }),
        style_class: `usagebeam-provider-icon usagebeam-${provider}-icon ${style}`.trim(),
    });
}

export function limitRow(name, value, reset, severity = null) {
    const box = new St.BoxLayout({style_class: 'usagebeam-limit-row', x_expand: true});
    const title = label(name, 'usagebeam-limit-name', true);
    title.clutter_text.ellipsize = Pango.EllipsizeMode.END;
    box.add_child(title);
    const metrics = new St.BoxLayout({style_class: 'usagebeam-limit-metrics'});
    if (reset) {
        metrics.add_child(metricColumn(value,
            `usagebeam-limit-percent${severity ? ` usagebeam-${severity}` : ''}`));
        metrics.add_child(separatorDot('usagebeam-limit-separator'));
        metrics.add_child(metricColumn(reset, 'usagebeam-limit-reset', Clutter.ActorAlign.START));
    } else {
        metrics.add_child(metricColumn(value, 'usagebeam-limit-value'));
    }
    box.add_child(metrics);
    return box;
}

export function meter(fraction, name, style = '') {
    return new UsageBeamBar({fraction, name, style: `usagebeam-track ${style}`, fillStyle: 'usagebeam-fill'});
}

export function modelMeter(left, right, fraction, name) {
    const content = new St.BoxLayout({style_class: 'usagebeam-model-content'});
    const title = label(left, 'usagebeam-model-name', true);
    title.clutter_text.ellipsize = Pango.EllipsizeMode.END;
    content.add_child(title);
    content.add_child(metricLabel(right, 'usagebeam-number'));
    return new UsageBeamBar({fraction, name, content,
        style: 'usagebeam-model-meter', fillStyle: 'usagebeam-model-fill'});
}

export function dayChart(days, today) {
    const values = Array.isArray(days) ? days : [];
    const max = Math.max(1, ...values.map(day => day.total));
    const chart = new St.Widget({
        style_class: 'usagebeam-day-chart',
        x_expand: true,
        layout_manager: new Clutter.BoxLayout({
            homogeneous: true,
            orientation: Clutter.Orientation.HORIZONTAL,
            spacing: 6,
        }),
        accessible_name: 'Daily token activity chart',
        accessible_role: Atk.Role.PANEL,
    });
    for (const day of values) {
        const isToday = day.date === today;
        const weekday = new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, {weekday: 'short'});
        const column = new St.BoxLayout({
            vertical: true,
            style_class: `usagebeam-chart-column${isToday ? ' usagebeam-today' : ''}`,
            x_expand: true,
            accessible_name: `${isToday ? 'Today, ' : ''}${weekday}, ${day.total} tokens, ${day.sessions ?? 0} sessions`,
        });
        column.add_child(label(compactTokens(day.total), 'usagebeam-chart-value'));
        const plot = new UsageBeamBar({
            fraction: day.total / max,
            name: `${day.date}: ${day.total} tokens`,
            style: 'usagebeam-chart-plot',
            fillStyle: 'usagebeam-chart-bar',
            vertical: true,
        });
        column.add_child(plot);
        column.add_child(label(weekday, 'usagebeam-chart-day'));
        chart.add_child(column);
    }
    return chart;
}

export function button(text, callback, {active = false, name = text} = {}) {
    const actor = new St.Button({label: text, can_focus: true, reactive: true, track_hover: true,
        accessible_name: name, style_class: 'usagebeam-button', x_expand: true});
    if (active)
        actor.add_style_pseudo_class('checked');
    actor.connect('clicked', callback);
    return actor;
}

export function disclosureButton(summary, expanded, callback) {
    const actor = new St.Button({
        accessible_name: 'Activity details',
        accessible_role: Atk.Role.TOGGLE_BUTTON,
        can_focus: true,
        checked: expanded,
        reactive: true,
        style_class: 'usagebeam-disclosure',
        toggle_mode: true,
        track_hover: true,
        x_expand: true,
    });
    const content = new St.BoxLayout({style_class: 'usagebeam-disclosure-content', x_expand: true});
    content.add_child(label('Activity', 'usagebeam-disclosure-title', true));
    const meta = new St.BoxLayout({style_class: 'usagebeam-disclosure-meta'});
    summary.forEach(({text, role}, index) => {
        if (index)
            meta.add_child(separatorDot('usagebeam-disclosure-separator'));
        meta.add_child(metricLabel(text,
            `usagebeam-disclosure-summary usagebeam-disclosure-${role}`));
    });
    meta.add_child(new St.Icon({
        icon_name: expanded ? 'pan-up-symbolic' : 'pan-down-symbolic',
        style_class: 'usagebeam-disclosure-icon',
    }));
    content.add_child(meta);
    actor.set_child(content);
    actor.connect('clicked', callback);
    return actor;
}

export function actionButton(text, callback, name = text) {
    const actor = button(text, callback, {name});
    actor.x_expand = false;
    actor.add_style_class_name('usagebeam-action-button');
    return actor;
}
