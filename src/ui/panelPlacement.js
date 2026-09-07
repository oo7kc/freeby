import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export function placeIndicator(indicator, position) {
    const container = indicator.container;
    const calendar = Main.panel.statusArea.dateMenu?.container;
    const boxes = {left: Main.panel._leftBox, center: Main.panel._centerBox, right: Main.panel._rightBox};
    const besideCalendar = position === 'left-of-calendar' || position === 'right-of-calendar';
    const target = besideCalendar ? calendar?.get_parent() ?? boxes.center : boxes[position] ?? boxes.center;
    // Reparent only this extension. GNOME centers the combined calendar/indicator
    // group in its center box; a constant indicator width keeps the clock steady.
    container.get_parent()?.remove_child(container);
    const siblings = target.get_children();
    const calendarIndex = siblings.indexOf(calendar);
    const index = besideCalendar && calendarIndex >= 0
        ? calendarIndex + (position === 'right-of-calendar' ? 1 : 0)
        : position === 'right' ? 0 : siblings.length;
    target.insert_child_at_index(container, index);
}
