import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {UsageBeamIndicator} from './src/ui/indicator.js';
import {migrateLegacyInstall} from './src/services/migration.js';
import {UsageService} from './src/services/usageService.js';

export default class UsageBeamExtension extends Extension {
    enable() {
        this._settings = this.getSettings('org.gnome.shell.extensions.usagebeam');
        migrateLegacyInstall(this._settings);
        this._indicator = new UsageBeamIndicator(this._settings, () => this.openPreferences());
        Main.panel.addToStatusArea(this.uuid, this._indicator);
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
        this._settingsIds.push(this._settings.connect('changed::history-retention-days', () =>
            this._service.refreshAll(true)));
        this._service.refreshAll();
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
