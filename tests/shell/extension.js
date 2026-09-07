// Loaded only by tools/smoke-shell.py in its isolated, synthetic desktop.
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const UUID = 'usagebeam@oo7kc.github.io';
const descendants = actor => [actor, ...actor.get_children().flatMap(descendants)];
const matching = (actor, style) => descendants(actor).filter(child => child.has_style_class_name?.(style));
const bounds = actor => {
    const [x, y] = actor.get_transformed_position();
    const [width, height] = actor.get_transformed_size();
    return {x, y, width, height};
};
const assert = (condition, message) => {
    if (!condition)
        throw new Error(message);
};

export default class UsageBeamUITest extends Extension {
    enable() {
        this._timers = new Map();
        this._output = GLib.getenv('USAGEBEAM_TEST_OUTPUT');
        if (!this._output)
            throw new Error('UI tests require a private test output directory');
        this._run().then(result => this._save({ok: true, ...result})).catch(async error => {
            try {
                await this._screenshot('failure');
            } finally {
                this._save({ok: false, error: `${error}\n${error.stack ?? ''}`});
            }
        });
    }

    _save(result) {
        GLib.file_set_contents(`${this._output}/ui-results.json`, JSON.stringify(result, null, 2));
    }

    _wait(milliseconds = 150) {
        return new Promise((resolve, reject) => {
            const id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, milliseconds, () => {
                this._timers.delete(id);
                resolve();
                return GLib.SOURCE_REMOVE;
            });
            this._timers.set(id, reject);
        });
    }

    async _screenshot(name) {
        const file = Gio.File.new_for_path(`${this._output}/${name}.png`);
        const stream = file.replace(null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
        try {
            await new Shell.Screenshot().screenshot(false, stream);
        } finally {
            stream.close(null);
        }
    }

    _displayCall(method, parameters = null) {
        return new Promise((resolve, reject) => Gio.DBus.session.call('org.gnome.Mutter.DisplayConfig',
            '/org/gnome/Mutter/DisplayConfig', 'org.gnome.Mutter.DisplayConfig', method,
            parameters, null, Gio.DBusCallFlags.NONE, 5000, null, (connection, result) => {
                try {
                    resolve(connection.call_finish(result).deep_unpack());
                } catch (error) {
                    reject(error);
                }
            }));
    }

    async _run() {
        let indicator;
        for (let attempt = 0; attempt < 80 && !indicator; attempt++) {
            await this._wait();
            indicator = Main.panel.statusArea[UUID];
        }
        assert(indicator, 'UsageBeam did not appear in the panel');
        indicator._service.destroy();
        const [, fixture] = GLib.file_get_contents(`${this._output}/ui-fixtures.json`);
        const records = JSON.parse(new TextDecoder().decode(fixture));
        indicator.attach({enabledProviders: ['codex', 'claude'], recordFor: id => records[id],
            isRefreshing: () => false, refreshAll: () => {}});
        const settings = indicator._settings;
        const calendar = Main.panel.statusArea.dateMenu.container;
        const positions = ['left', 'right', 'left-of-calendar', 'right-of-calendar'];
        const placement = [];
        Main.overview.hide();
        await this._wait(500);
        // Configure only this private virtual monitor, temporarily. Setting just
        // St's scale factor would scale lengths without updating the font DPI.
        const expectedScale = Number(GLib.getenv('USAGEBEAM_TEST_SCALE') ?? 1);
        if (expectedScale !== 1) {
            const [serial, monitors] = await this._displayCall('GetCurrentState');
            const [[connector], modes] = monitors[0];
            const [mode] = modes.find(item => item[5].includes(expectedScale)) ?? [];
            assert(mode, `Virtual monitor does not support scale ${expectedScale}`);
            await this._displayCall('ApplyMonitorsConfig', new GLib.Variant('(uua(iiduba(ssa{sv}))a{sv})',
                [serial, 1, [[0, 0, expectedScale, 0, true, [[connector, mode, {}]]]], {}]));
            await this._wait(500);
        }
        const [, , logicalMonitors] = await this._displayCall('GetCurrentState');
        const monitorScale = logicalMonitors[0][2];
        assert(monitorScale === expectedScale, `Expected monitor scale ${expectedScale}, got ${monitorScale}`);
        for (const position of positions) {
            settings.set_string('panel-position', position);
            settings.set_string('default-provider', 'codex');
            await this._wait();
            const parent = position === 'left' ? Main.panel._leftBox : position === 'right'
                ? Main.panel._rightBox : Main.panel._centerBox;
            assert(indicator.container.get_parent() === parent, `${position}: wrong panel area`);
            const before = bounds(indicator.container);
            const clockBefore = bounds(calendar);
            // Check both a different provider and unavailable quota text.
            const original = records.claude;
            for (const available of [true, false]) {
                records.claude = available ? original : {...original,
                    limits: {...original.limits, windows: []}};
                settings.set_string('default-provider', 'claude');
                indicator.render();
                await this._wait();
                assert(Math.abs(bounds(calendar).x - clockBefore.x) <= 1,
                    `${position}: calendar moved on provider change`);
                assert(Math.abs(bounds(indicator.container).width - before.width) <= 1,
                    `${position}: indicator width changed`);
                assert(!indicator._panelProvider.clutter_text.get_layout().is_ellipsized(),
                    `${position}: panel provider name clipped: ${JSON.stringify({
                        status: indicator._panelStatus.width,
                        children: indicator._panelStatus.get_children().map(actor =>
                            ({style: actor.style_class, width: actor.width, preferred: actor.get_preferred_width(-1)})),
                    })}`);
            }
            records.claude = original;
            if (position.includes('calendar')) {
                const children = parent.get_children();
                const offset = children.indexOf(indicator.container) - children.indexOf(calendar);
                assert(offset === (position === 'left-of-calendar' ? -1 : 1), 'Calendar adjacency lost');
            }
            if (position.includes('calendar')) {
                const left = position === 'left-of-calendar' ? before : clockBefore;
                const right = position === 'left-of-calendar' ? clockBefore : before;
                const panel = bounds(Main.panel);
                const gapCenter = (left.x + left.width + right.x) / 2;
                assert(Math.abs(gapCenter - (panel.x + panel.width / 2)) <= 1,
                    `${position}: calendar/indicator gap is not centered (${gapCenter})`);
            }
            placement.push({position, indicator: before, calendar: clockBefore});
        }
        settings.set_string('default-provider', 'codex');
        indicator.menu.open(0);
        await this._wait();
        await this._screenshot('collapsed');
        matching(indicator._contentBox, 'usagebeam-disclosure')[0].emit('clicked', 1);
        await this._wait();
        assert(indicator._detailsExpanded, 'Activity button did not expand');
        const content = indicator._contentBox;
        const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        const interfaceSettings = new Gio.Settings({schema_id: 'org.gnome.desktop.interface'});
        const textScale = interfaceSettings.get_double('text-scaling-factor');
        const initial = bounds(indicator.menu.actor);
        assert(initial.height / scale < 680 * textScale, `Expanded menu too tall: ${initial.height / scale}`);
        assert(!descendants(content).some(actor => actor instanceof St.ScrollView), 'Activity is scrollable');
        const models = matching(content, 'usagebeam-model-meter');
        assert(models.length === 3, 'Expected three synthetic models');
        for (const actor of models) {
            assert(actor.height / scale >= 27 && actor.height / scale <= 40 * textScale,
                `Model row height is not compact: ${actor.height / scale}`);
            assert(actor._fill.width > 0 && actor._fill.height > 0, 'Model fill is empty');
        }
        const plots = matching(content, 'usagebeam-chart-plot');
        assert(plots.length === 7, 'Expected seven chart columns');
        for (const plot of plots) {
            assert(plot.height / scale === 52, `Unexpected chart height: ${plot.height / scale}`);
            assert(plot._fill.visible === (plot._fraction > 0), 'Incorrect zero/nonzero bar visibility');
            if (plot._fraction > 0)
                assert(plot._fill.width > 0 && plot._fill.height > 0, 'Daily bar has no area');
        }
        for (const style of ['usagebeam-limit-percent', 'usagebeam-limit-reset']) {
            const actors = matching(content, style);
            for (const actor of actors) {
                const text = actor.get_child();
                assert(!text.clutter_text.get_layout().is_ellipsized(), `${style}: clipped text`);
                assert(Math.abs(bounds(actor).x - bounds(actors[0]).x) <= 1, `${style}: misaligned column`);
                const edge = bounds(text).x + text.width;
                const firstText = actors[0].get_child();
                assert(Math.abs(edge - bounds(firstText).x - firstText.width) <= 1,
                    `${style}: numbers are not right aligned (${edge} vs ${bounds(firstText).x + firstText.width})`);
            }
        }
        const dots = [indicator._panelSeparator, ...matching(content, 'usagebeam-separator-dot')];
        for (const dot of dots) {
            const dotBounds = bounds(dot);
            const coreBounds = bounds(dot.get_child());
            assert(Math.abs(coreBounds.x + coreBounds.width / 2 - (dotBounds.x + dotBounds.width / 2)) <= 1 &&
                Math.abs(coreBounds.y + coreBounds.height / 2 - (dotBounds.y + dotBounds.height / 2)) <= 1,
            'Separator dot is not optically centered');
        }
        const valueBounds = bounds(indicator._panelValue);
        const separatorBounds = bounds(indicator._panelSeparator);
        const resetBounds = bounds(indicator._panelReset);
        assert(Math.abs(separatorBounds.x - (valueBounds.x + valueBounds.width) -
            (resetBounds.x - separatorBounds.x - separatorBounds.width)) <= 1,
        'Panel separator does not have equal spacing');
        const limitName = matching(content, 'usagebeam-limit-name')[0];
        const limitValue = matching(content, 'usagebeam-limit-percent')[0].get_child();
        assert(limitValue.get_theme_node().get_font().get_size() <
            limitName.get_theme_node().get_font().get_size(), 'Limit metrics lack font hierarchy');
        const activityParts = matching(content, 'usagebeam-disclosure-summary');
        assert(activityParts.length === 3, 'Activity summary is not split into semantic parts');
        for (const severity of ['caution', 'warning', 'danger']) {
            const actors = matching(content, `usagebeam-${severity}`);
            assert(actors.some(actor => actor.has_style_class_name('usagebeam-limit-percent')),
                `${severity}: percentage does not expose quota severity`);
            assert(actors.some(actor => actor.has_style_class_name('usagebeam-track')),
                `${severity}: meter does not expose quota severity`);
        }
        assert(indicator._panelValue.has_style_class_name('usagebeam-danger'),
            'Panel indicator does not expose the highest quota severity');
        const modelContent = matching(content, 'usagebeam-model-content')[0];
        const [modelName, modelTotal] = modelContent.get_children();
        assert(modelTotal.get_theme_node().get_font().get_size() <
            modelName.get_theme_node().get_font().get_size(), 'Model row lacks font hierarchy');
        const heights = models.map(actor => actor.height);
        for (let frame = 0; frame < 8; frame++) {
            content.queue_relayout();
            await this._wait(60);
            assert(Math.abs(bounds(indicator.menu.actor).height - initial.height) <= 1,
                'Menu geometry drifts on repeated layout');
            models.forEach((actor, index) => assert(actor.height === heights[index], 'Model row grows on layout'));
        }
        const font = content.get_theme_node().get_font().to_string();
        assert(font.includes('SF Pro Text'), `Requested font family was overridden: ${font}`);
        await this._screenshot('expanded-dark');
        indicator.menu.actor.remove_style_class_name('usagebeam-dark');
        indicator.menu.actor.add_style_class_name('usagebeam-light');
        await this._wait();
        await this._screenshot('expanded-light');
        indicator.menu.close(0);
        return {placement, expanded: initial, modelHeights: heights,
            font, scale, monitorScale, textScale};
    }

    disable() {
        for (const [id, reject] of this._timers) {
            GLib.source_remove(id);
            reject(new Error('UI check disabled before completion'));
        }
        this._timers.clear();
    }
}
