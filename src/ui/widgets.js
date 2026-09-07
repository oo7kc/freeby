import Atk from 'gi://Atk';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import Pango from 'gi://Pango';
import St from 'gi://St';
import {compactTokens} from '../core/format.js';

const PROVIDER_ICONS = new Set(['claude', 'codex']);
const PROVIDER_ICON_FILES = {claude: 'claude.svg', codex: 'codex-symbolic.svg'};

export function label(text, style = '', expand = false) {
    return new St.Label({text: String(text ?? ''), style_class: style,
        y_align: Clutter.ActorAlign.CENTER, x_expand: expand});
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

export function row(left, right, style = 'usagebeam-row') {
    const box = new St.BoxLayout({style_class: style, x_expand: true});
    const title = label(left, '', true);
    title.clutter_text.ellipsize = Pango.EllipsizeMode.END;
    box.add_child(title);
    box.add_child(label(right, 'usagebeam-number'));
    return box;
}

export function meter(fraction, name, style = '') {
    const ratio = Math.max(0, Math.min(1, Number(fraction) || 0));
    const track = new St.Widget({style_class: `usagebeam-track ${style}`, x_expand: true,
        layout_manager: new Clutter.FixedLayout(), accessible_name: name, accessible_role: Atk.Role.PROGRESS_BAR});
    const fill = new St.Widget({style_class: 'usagebeam-fill'});
    fill.set_position(0, 0);
    track.add_child(fill);
    track.connect('notify::allocation', () => {
        fill.set_size(Math.round(Math.max(0, track.width) * ratio), Math.max(0, track.height));
    });
    return track;
}

export function modelMeter(left, right, fraction, name) {
    const ratio = Math.max(0, Math.min(1, Number(fraction) || 0));
    const track = new St.Widget({style_class: 'usagebeam-model-meter', x_expand: true,
        layout_manager: new Clutter.FixedLayout(), accessible_name: name,
        accessible_role: Atk.Role.PROGRESS_BAR});
    const fill = new St.Widget({style_class: 'usagebeam-model-fill'});
    const content = new St.BoxLayout({style_class: 'usagebeam-model-content'});
    const title = label(left, 'usagebeam-model-name', true);
    title.clutter_text.ellipsize = Pango.EllipsizeMode.END;
    content.add_child(title);
    content.add_child(label(right, 'usagebeam-number'));
    track.add_child(fill);
    track.add_child(content);
    track.connect('notify::allocation', () => {
        const width = Math.max(0, track.width);
        const height = Math.max(0, track.height);
        fill.set_position(0, 0);
        fill.set_size(Math.round(width * ratio), height);
        content.set_position(0, 0);
        content.set_size(width, height);
    });
    return track;
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
        const plot = new St.Widget({
            style_class: 'usagebeam-chart-plot',
            x_expand: true,
            layout_manager: new Clutter.BinLayout(),
        });
        const bar = new St.Widget({
            style_class: 'usagebeam-chart-bar',
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.END,
            visible: day.total > 0,
            height: Math.max(3, Math.round(day.total / max * 58)),
        });
        plot.add_child(bar);
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
    content.add_child(label(summary, 'usagebeam-disclosure-summary'));
    content.add_child(new St.Icon({
        icon_name: expanded ? 'pan-up-symbolic' : 'pan-down-symbolic',
        style_class: 'usagebeam-disclosure-icon',
    }));
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
