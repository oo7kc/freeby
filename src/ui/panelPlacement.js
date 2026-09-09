import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const CALENDAR_POSITIONS = new Set(['left-of-calendar', 'right-of-calendar']);

export function clearIndicatorPlacement(indicator) {
    const state = indicator?._usageBeamPlacement;
    if (!state)
        return;
    for (const [actor, signal] of state.signals)
        actor.disconnect(signal);
    for (const spacer of state.spacers)
        spacer.destroy();
    delete indicator._usageBeamPlacement;
}

function centerCalendarGap(indicator, calendar, target, position) {
    // GNOME centers the whole box, including actors owned by other extensions.
    // Balance every visible sibling around the calendar/readout boundary.
    const leading = new St.Widget({style_class: 'usagebeam-center-balance'});
    const trailing = new St.Widget({style_class: 'usagebeam-center-balance'});
    const leftIsIndicator = position === 'left-of-calendar';
    const state = {signals: [], spacers: [leading, trailing]};
    const watched = new Map();
    const sync = () => {
        const children = target.get_children().filter(actor => actor.visible);
        const widths = children.map(actor => state.spacers.includes(actor) ? 0 : actor.get_preferred_width(-1)[1]);
        const index = children.indexOf(leftIsIndicator ? indicator.container : calendar);
        if (index < 0)
            return;
        const spacing = target.get_theme_node().get_length('spacing');
        const boundary = widths.slice(0, index + 1).reduce((sum, width) => sum + width, 0) + spacing * (index + 0.5);
        const total = widths.reduce((sum, width) => sum + width, 0) + spacing * Math.max(0, children.length - 1);
        const difference = 2 * boundary - total;
        leading.set_width(Math.max(0, -difference));
        trailing.set_width(Math.max(0, difference));
    };
    const calendarIndex = target.get_children().indexOf(calendar);
    target.insert_child_at_index(leading, calendarIndex);
    target.insert_child_at_index(indicator.container, calendarIndex + (leftIsIndicator ? 1 : 2));
    target.insert_child_at_index(trailing, calendarIndex + 3);
    const observe = () => {
        const children = target.get_children().filter(actor => !state.spacers.includes(actor));
        for (const [actor, signals] of watched) {
            if (children.includes(actor))
                continue;
            for (const signal of signals) {
                actor.disconnect(signal);
                state.signals = state.signals.filter(pair => pair[0] !== actor || pair[1] !== signal);
            }
            watched.delete(actor);
        }
        for (const actor of children) {
            if (watched.has(actor))
                continue;
            const signals = ['notify::width', 'notify::visible'].map(name => actor.connect(name, sync));
            watched.set(actor, signals);
            state.signals.push(...signals.map(signal => [actor, signal]));
        }
        sync();
    };
    for (const signal of ['child-added', 'child-removed'])
        state.signals.push([target, target.connect(signal, observe)]);
    indicator._usageBeamPlacement = state;
    observe();
}

export function placeIndicator(indicator, position) {
    clearIndicatorPlacement(indicator);
    const container = indicator.container;
    const calendar = Main.panel.statusArea.dateMenu?.container;
    const boxes = {left: Main.panel._leftBox, right: Main.panel._rightBox};
    const resolved = CALENDAR_POSITIONS.has(position) || position in boxes
        ? position : 'right-of-calendar';
    indicator.alignPanelContent(resolved);
    const besideCalendar = CALENDAR_POSITIONS.has(resolved);
    const target = besideCalendar ? calendar?.get_parent() ?? Main.panel._centerBox : boxes[resolved];
    container.get_parent()?.remove_child(container);
    if (besideCalendar && calendar) {
        centerCalendarGap(indicator, calendar, target, resolved);
        return;
    }
    const siblings = target.get_children();
    const index = resolved === 'right' ? 0 : siblings.length;
    target.insert_child_at_index(container, index);
}
