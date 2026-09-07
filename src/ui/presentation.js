import {resetCountdown} from '../core/format.js';

const CURRENT_STATES = new Set(['ready', 'partial']);

export const QUOTA_THRESHOLDS = Object.freeze({
    caution: 80,
    warning: 90,
    danger: 100,
});

export function quotaSeverity(percent) {
    if (!Number.isFinite(percent))
        return null;
    if (percent >= QUOTA_THRESHOLDS.danger)
        return 'danger';
    if (percent >= QUOTA_THRESHOLDS.warning)
        return 'warning';
    if (percent >= QUOTA_THRESHOLDS.caution)
        return 'caution';
    return null;
}

export function providerStatus(record, refreshing = false) {
    if (CURRENT_STATES.has(record?.limits?.status))
        return 'LIVE';
    if (CURRENT_STATES.has(record?.history?.status))
        return 'LOCAL';
    if (record?.limits?.status === 'stale' || record?.history?.status === 'stale')
        return 'CACHED';
    return refreshing ? 'SYNC' : 'SETUP';
}

export function latestUpdate(record) {
    const timestamps = [record?.limits?.updatedAt, record?.history?.updatedAt]
        .filter(value => Number.isFinite(value) && value > 0);
    return timestamps.length ? Math.max(...timestamps) : null;
}

export function periodDays(period) {
    const start = Date.parse(`${period?.start ?? ''}T00:00:00Z`);
    const end = Date.parse(`${period?.end ?? ''}T00:00:00Z`);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start)
        return null;
    return Math.round((end - start) / 86400000) + 1;
}

export function historyOverview(history) {
    const days = Array.isArray(history?.days) ? history.days : [];
    const models = Array.isArray(history?.models) ? history.models : [];
    const values = days.length ? days : models;
    if (!values.length)
        return null;

    const total = values.reduce((sum, item) => sum +
        (Number.isFinite(item?.total) ? item.total : 0), 0);
    return {
        days: periodDays(history.period),
        scope: history.scope === 'account' ? 'account' : 'local',
        total,
    };
}

export function quotaName(window) {
    const source = `${window?.id ?? ''} ${window?.label ?? ''}`.toLowerCase();
    if (source.includes('reserve') &&
        (source.includes('weekly') || window?.durationMinutes === 10080))
        return 'Weekly reserve';
    return String(window?.label ?? 'Usage limit');
}

export function quotaPresentation(window, now = Date.now()) {
    if (!window)
        return null;
    if (window.unlimited)
        return {name: quotaName(window), value: 'Unlimited', reset: null};
    if (!Number.isFinite(window.usedPercent))
        return null;
    return {
        name: quotaName(window),
        value: `${Math.round(window.usedPercent)}%`,
        reset: resetCountdown(window.resetsAt, now),
    };
}

export function panelQuota(record, now = Date.now()) {
    if (!CURRENT_STATES.has(record?.limits?.status))
        return null;
    const candidates = record.limits.windows
        .filter(window => !window.unlimited && Number.isFinite(window.usedPercent))
        .sort((left, right) => right.usedPercent - left.usedPercent);
    const window = candidates[0];
    if (!window)
        return null;
    return {
        percent: Math.round(window.usedPercent),
        reset: resetCountdown(window.resetsAt, now),
    };
}

export function chartBarGeometry(value, maximum, width, height, inset = 4) {
    const availableWidth = Math.max(0, width - inset * 2);
    const availableHeight = Math.max(0, height);
    const ratio = maximum > 0 && value > 0 ? Math.min(1, value / maximum) : 0;
    const barHeight = ratio && availableHeight
        ? Math.min(availableHeight, Math.max(3, Math.round(availableHeight * ratio)))
        : 0;
    return {
        x: inset,
        y: availableHeight - barHeight,
        width: availableWidth,
        height: barHeight,
    };
}
