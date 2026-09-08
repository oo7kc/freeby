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
    // GNOME centers the entire center box. Balance its outer edge by the width
    // difference so the boundary between these unequal actors lands at 50%.
    const leading = new St.Widget({style_class: 'usagebeam-center-balance'});
    const trailing = new St.Widget({style_class: 'usagebeam-center-balance'});
    const leftIsIndicator = position === 'left-of-calendar';
    const sync = () => {
        const indicatorWidth = indicator.container.get_preferred_width(-1)[1];
        const calendarWidth = calendar.get_preferred_width(-1)[1];
        const difference = indicatorWidth - calendarWidth;
        leading.set_width(Math.max(0, leftIsIndicator ? -difference : difference));
        trailing.set_width(Math.max(0, leftIsIndicator ? difference : -difference));
    };
    const calendarIndex = target.get_children().indexOf(calendar);
    target.insert_child_at_index(leading, calendarIndex);
    target.insert_child_at_index(indicator.container, calendarIndex + (leftIsIndicator ? 1 : 2));
    target.insert_child_at_index(trailing, calendarIndex + 3);
    const signals = [indicator.container, calendar].map(actor =>
        [actor, actor.connect('notify::width', sync)]);
    indicator._usageBeamPlacement = {signals, spacers: [leading, trailing]};
    sync();
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
