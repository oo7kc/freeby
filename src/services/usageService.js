import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {NAMES, mergeRecord, record, section, validateRecord} from '../core/usage.js';
import {ThresholdTracker} from '../core/notifications.js';
import {findCommand, join, readJson, stateDirectory, writeJson} from './files.js';
import {runCommand} from './process.js';

export class UsageService {
    constructor(settings, directory, changed, alerts) {
        this.settings = settings;
        this.directory = directory;
        this.changed = changed;
        this.alerts = alerts;
        this.records = {};
        this.jobs = new Map();
        this.attempts = new Map();
        this.failures = new Map();
        this.thresholds = new ThresholdTracker();
        this.closed = false;
        this.enabled = [];
        this.configure();
        this.timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 15, () => {
            for (const id of this.enabled)
                this.refresh(id);
            return GLib.SOURCE_CONTINUE;
        });
        this.sleepId = Gio.DBus.system.signal_subscribe('org.freedesktop.login1', 'org.freedesktop.login1.Manager',
            'PrepareForSleep', '/org/freedesktop/login1', null, Gio.DBusSignalFlags.NONE,
            (_connection, _sender, _path, _interface, _signal, params) => {
                if (!params.get_child_value(0).get_boolean())
                    this.refreshAll(true);
            });
    }

    configure() {
        this.enabled = [...new Set(this.settings.get_strv('enabled-providers'))].filter(id => NAMES[id]);
        for (const [id, job] of this.jobs) {
            if (!this.enabled.includes(id)) {
                job.cancel();
                this.jobs.delete(id);
            }
        }
        for (const id of this.enabled) {
            if (this.records[id])
                continue;
            try {
                const cached = validateRecord(readJson(join(stateDirectory(), `${id}.json`)), id);
                for (const key of ['limits', 'history']) {
                    if (cached[key].updatedAt)
                        cached[key] = {...cached[key], ...section('stale', 'Showing saved usage while refreshing.'), updatedAt: cached[key].updatedAt};
                }
                this.records[id] = cached;
            } catch { this.records[id] = record(id); }
        }
    }

    refreshAll(force = false) {
        for (const id of this.enabled)
            this.refresh(id, force);
    }

    async refresh(id, force = false) {
        if (this.closed || !this.enabled.includes(id) || this.jobs.has(id))
            return;
        const now = Date.now();
        const elapsed = now - (this.attempts.get(id) ?? 0);
        const wait = Math.min(3600, this.settings.get_int('refresh-interval') * 2 ** (this.failures.get(id) ?? 0));
        if (elapsed >= 0 && elapsed < (force ? 15000 : wait * 1000))
            return;
        const job = new Gio.Cancellable();
        this.jobs.set(id, job);
        this.attempts.set(id, now);
        this.changed();
        try {
            const stdout = await runCommand([findCommand('gjs'), '-m', join(this.directory, 'src', 'collector', 'main.js'),
                id, String(this.settings.get_int('history-retention-days'))], {cancellable: job, timeout: 45000});
            if (this.closed || job.is_cancelled() || this.jobs.get(id) !== job)
                return;
            const result = validateRecord(JSON.parse(stdout), id);
            const failed = ['unavailable', 'missing-auth'].includes(result.limits.status);
            this.failures.set(id, failed ? Math.min(4, (this.failures.get(id) ?? 0) + 1) : 0);
            const alerts = this.thresholds.update(result, this.settings.get_int('notification-threshold'));
            this.records[id] = mergeRecord(this.records[id], result);
            try { writeJson(join(stateDirectory(), `${id}.json`), this.records[id]); } catch { /* Cache failure must not hide current usage. */ }
            if (this.settings.get_boolean('notifications-enabled') && alerts.length)
                this.alerts(alerts);
        } catch {
            if (!this.closed && !job.is_cancelled()) {
                const failed = record(id);
                failed.limits = {...failed.limits, ...section('unavailable', 'Collection failed or timed out. Retry from the panel.')};
                failed.history = {...failed.history, ...section('unavailable', 'History could not be refreshed.')};
                this.records[id] = mergeRecord(this.records[id], failed);
                this.failures.set(id, Math.min(4, (this.failures.get(id) ?? 0) + 1));
            }
        } finally {
            if (this.jobs.get(id) === job)
                this.jobs.delete(id);
            if (!this.closed)
                this.changed();
        }
    }

    destroy() {
        this.closed = true;
        if (this.timer)
            GLib.source_remove(this.timer);
        if (this.sleepId)
            Gio.DBus.system.signal_unsubscribe(this.sleepId);
        for (const job of this.jobs.values())
            job.cancel();
        this.jobs.clear();
        this.changed = () => {};
        this.alerts = () => {};
    }
}
