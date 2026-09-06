import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class FreebyPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings('org.gnome.shell.extensions.freeby');

        const page = new Adw.PreferencesPage();
        window.add(page);

        const group = new Adw.PreferencesGroup({title: 'General'});
        page.add(group);

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
