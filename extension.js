import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { FreebyIndicator } from './indicator.js';

export default class FreebyExtension extends Extension {
    enable() {
        this._settings = this.getSettings('org.gnome.shell.extensions.freeby');
        this._settingsId = this._settings.connect('changed::refresh-interval', () => this._indicator?._setupTimer());
        this._indicator = new FreebyIndicator(this._settings);
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }
    disable() {
        if (this._settingsId) { this._settings.disconnect(this._settingsId); this._settingsId = null; }
        this._indicator?.destroy();
        this._indicator = null;
        this._settings = null;
    }
}
