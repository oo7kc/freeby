import Atk from 'gi://Atk';
import Clutter from 'gi://Clutter';
import Pango from 'gi://Pango';
import St from 'gi://St';

export function label(text, style = '', expand = false) {
    return new St.Label({text: String(text ?? ''), style_class: style,
        y_align: Clutter.ActorAlign.CENTER, x_expand: expand});
}

export function row(left, right, style = 'freeby-row') {
    const box = new St.BoxLayout({style_class: style, x_expand: true});
    const title = label(left, '', true);
    title.clutter_text.ellipsize = Pango.EllipsizeMode.END;
    box.add_child(title);
    box.add_child(label(right, 'freeby-number'));
    return box;
}

export function meter(fraction, name, style = '') {
    const ratio = Math.max(0, Math.min(1, Number(fraction) || 0));
    const track = new St.Widget({style_class: `freeby-track ${style}`, x_expand: true,
        layout_manager: new Clutter.FixedLayout(), accessible_name: name, accessible_role: Atk.Role.PROGRESS_BAR});
    const fill = new St.Widget({style_class: 'freeby-fill'});
    fill.set_position(0, 0);
    track.add_child(fill);
    track.connect('notify::allocation', () => {
        fill.set_size(Math.round(Math.max(0, track.width) * ratio), Math.max(0, track.height));
    });
    return track;
}

export function modelMeter(left, right, fraction, name) {
    const ratio = Math.max(0, Math.min(1, Number(fraction) || 0));
    const track = new St.Widget({style_class: 'freeby-model-meter', x_expand: true,
        layout_manager: new Clutter.FixedLayout(), accessible_name: name,
        accessible_role: Atk.Role.PROGRESS_BAR});
    const fill = new St.Widget({style_class: 'freeby-model-fill'});
    const content = new St.BoxLayout({style_class: 'freeby-model-content'});
    const title = label(left, 'freeby-model-name', true);
    title.clutter_text.ellipsize = Pango.EllipsizeMode.END;
    content.add_child(title);
    content.add_child(label(right, 'freeby-number'));
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

export function button(text, callback, {active = false, name = text} = {}) {
    const actor = new St.Button({label: text, can_focus: true, reactive: true, track_hover: true,
        accessible_name: name, style_class: 'freeby-button', x_expand: true});
    if (active)
        actor.add_style_pseudo_class('checked');
    actor.connect('clicked', callback);
    return actor;
}
