import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class UsageBeamPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings('org.gnome.shell.extensions.usagebeam');

        const page = new Adw.PreferencesPage();
        window.add(page);

        const group = new Adw.PreferencesGroup({title: 'General'});
        page.add(group);

        const positions = ['left', 'center', 'right', 'left-of-calendar', 'right-of-calendar'];
        const positionRow = new Adw.ComboRow({
            title: 'Panel position',
            subtitle: 'Choose a panel area or place usage beside the calendar',
            model: Gtk.StringList.new(['Left panel', 'Center panel', 'Right panel',
                'Left of calendar', 'Right of calendar']),
        });
        const syncPosition = () => {
            const selected = positions.indexOf(settings.get_string('panel-position'));
            positionRow.selected = selected >= 0 ? selected : 4;
        };
        syncPosition();
        positionRow.connect('notify::selected', () =>
            settings.set_string('panel-position', positions[positionRow.selected]));
        settings.connect('changed::panel-position', syncPosition);
        group.add(positionRow);

        const intervalRow = new Adw.SpinRow({
            title: 'Refresh interval',
            subtitle: 'How often to check usage (seconds, min 30)',
            adjustment: new Gtk.Adjustment({lower: 30, upper: 3600, step_increment: 10, page_increment: 60}),
        });
        settings.bind('refresh-interval', intervalRow, 'value', 0);
        group.add(intervalRow);

        const notifyRow = new Adw.SwitchRow({
            title: 'Notifications',
            subtitle: 'Alert when a provider hits its limit',
        });
        settings.bind('notifications-enabled', notifyRow, 'active', 0);
        group.add(notifyRow);
    }
}
