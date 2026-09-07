import {notificationMilestones} from './thresholds.js';

export function notificationBody(alerts) {
    return [...new Set(alerts.map(alert => {
        const state = alert.threshold >= 100 ? 'limit reached' : `reached ${alert.threshold}%`;
        return `${alert.provider}: ${alert.label} ${state}.`;
    }))].join('\n');
}

export class ThresholdTracker {
    constructor() {
        this.previous = new Map();
    }

    update(record, threshold = 90) {
        if (record.limits.status !== 'ready')
            return [];
        const alerts = [];
        const milestones = notificationMilestones(threshold);
        for (const window of record.limits.windows) {
            if (window.unlimited || !Number.isFinite(window.usedPercent))
                continue;
            const key = `${record.id}:${record.accountKey ?? 'default'}:${window.id}:${window.resetsAt ?? 'unknown'}`;
            const previous = this.previous.get(key);
            const reached = milestones.filter(value => window.usedPercent >= value).at(-1) ?? 0;
            if (previous !== undefined && reached > previous)
                alerts.push({provider: record.name, label: window.label, threshold: reached});
            this.previous.set(key, Math.max(previous ?? 0, reached));
        }
        if (this.previous.size > 200)
            this.previous.delete(this.previous.keys().next().value);
        return alerts;
    }
}
