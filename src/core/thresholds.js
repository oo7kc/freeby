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

export function notificationMilestones(minimum = QUOTA_THRESHOLDS.warning) {
    const floor = Number.isFinite(minimum)
        ? Math.max(0, Math.min(100, Math.round(minimum)))
        : QUOTA_THRESHOLDS.warning;
    return [...new Set([floor, ...Object.values(QUOTA_THRESHOLDS)])]
        .filter(value => value >= floor)
        .sort((left, right) => left - right);
}
