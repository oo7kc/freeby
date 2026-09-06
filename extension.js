import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {FreebyIndicator} from './src/ui/indicator.js';
import {UsageService} from './src/services/usageService.js';

export default class FreebyExtension extends Extension {
    enable() {
        this._settings = this.getSettings('org.gnome.shell.extensions.freeby');
        this._indicator = new FreebyIndicator(this._settings, () => this.openPreferences());
        Main.panel.addToStatusArea(this.uuid, this._indicator);
        this._service = new UsageService(this._settings, this.path, () => this._indicator?.render(), alerts => {
            for (const alert of alerts)
                Main.notify('Freeby usage alert', `${alert.provider}: ${alert.label} ${alert.threshold === 100 ? 'limit reached' : `reached ${alert.threshold}%`}.`);
        });
        this._indicator.attach(this._service);
        this._settingsId = this._settings.connect('changed', () => {
            this._service.configure();
            this._indicator.render();
            this._service.refreshAll();
        });
        this._service.refreshAll();
    }
    disable() {
        if (this._settingsId) { this._settings.disconnect(this._settingsId); this._settingsId = null; }
        this._service?.destroy();
        this._service = null;
        this._indicator?.destroy();
        this._indicator = null;
        this._settings = null;
    }
}
