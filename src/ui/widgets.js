import Atk from 'gi://Atk';
import Clutter from 'gi://Clutter';
import St from 'gi://St';

export function label(text, style = '', expand = false) {
    return new St.Label({text: String(text ?? ''), style_class: style,
        y_align: Clutter.ActorAlign.CENTER, x_expand: expand});
}

export function row(left, right, style = 'freeby-row') {
    const box = new St.BoxLayout({style_class: style, x_expand: true});
    box.add_child(label(left, '', true));
    box.add_child(label(right, 'freeby-number'));
    return box;
}

export function meter(fraction, name, style = '') {
    const ratio = Math.max(0, Math.min(1, Number(fraction) || 0));
    const track = new St.Widget({style_class: `freeby-track ${style}`, x_expand: true,
        layout_manager: new Clutter.BinLayout(), accessible_name: name, accessible_role: Atk.Role.PROGRESS_BAR});
    const fill = new St.Widget({style_class: 'freeby-fill', x_align: Clutter.ActorAlign.START,
        y_expand: true, y_align: Clutter.ActorAlign.FILL});
    track.add_child(fill);
    track.connect('notify::allocation', () => { fill.width = Math.round(track.width * ratio); });
    return track;
}

export function button(text, callback, {active = false, name = text} = {}) {
    const actor = new St.Button({label: text, can_focus: true, reactive: true, track_hover: true,
        accessible_name: name, style_class: 'freeby-button', x_expand: true});
    if (active)
        actor.add_style_pseudo_class('checked');
    actor.connect('clicked', callback);
    return actor;
}
