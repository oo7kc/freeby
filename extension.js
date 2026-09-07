import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {UsageBeamIndicator} from './src/ui/indicator.js';
import {migrateLegacyInstall} from './src/services/migration.js';
import {UsageService} from './src/services/usageService.js';

export default class UsageBeamExtension extends Extension {
    enable() {
        this._settings = this.getSettings('org.gnome.shell.extensions.usagebeam');
        migrateLegacyInstall(this._settings);
        this._indicator = new UsageBeamIndicator(this._settings, this.path, () => this.openPreferences());
        Main.panel.addToStatusArea(this.uuid, this._indicator, 0, 'center');
        this._placeIndicator();
        this._service = new UsageService(this._settings, this.path, () => this._indicator?.render(), alerts => {
            for (const alert of alerts) {
                const state = alert.threshold === 100 ? 'limit reached' : `reached ${alert.threshold}%`;
                Main.notify('UsageBeam usage alert', `${alert.provider}: ${alert.label} ${state}.`);
            }
        });
        this._indicator.attach(this._service);
        this._settingsIds = [];
        this._settingsIds.push(this._settings.connect('changed::enabled-providers', () => {
            this._service.configure();
            this._indicator.render();
            this._service.refreshAll();
        }));
        this._settingsIds.push(this._settings.connect('changed::default-provider', () => this._indicator.render()));
        this._settingsIds.push(this._settings.connect('changed::panel-position', () => this._placeIndicator()));
        this._settingsIds.push(this._settings.connect('changed::history-retention-days', () =>
            this._service.refreshAll(true)));
        this._service.refreshAll();
    }

    _placeIndicator() {
        const container = this._indicator?.container;
        if (!container)
            return;
        const calendar = Main.panel.statusArea.dateMenu?.container;
        const panelBox = calendar?.get_parent() ?? container.get_parent();
        if (!panelBox)
            return;
        const parent = container.get_parent();
        if (parent)
            parent.remove_child(container);
        const siblings = panelBox.get_children();
        const calendarIndex = calendar ? siblings.indexOf(calendar) : -1;
        const side = this._settings.get_string('panel-position');
        const position = calendarIndex < 0
            ? (side === 'left-of-calendar' ? 0 : siblings.length)
            : calendarIndex + (side === 'right-of-calendar' ? 1 : 0);
        panelBox.insert_child_at_index(container, position);
    }

    disable() {
        for (const id of this._settingsIds ?? [])
            this._settings.disconnect(id);
        this._settingsIds = null;
        this._service?.destroy();
        this._service = null;
        this._indicator?.destroy();
        this._indicator = null;
        this._settings = null;
    }
}
