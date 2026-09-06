const CURRENT_STATES = new Set(['ready', 'partial']);

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
