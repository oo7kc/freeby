export const SCHEMA_VERSION = 1;
export const NAMES = {codex: 'Codex', claude: 'Claude Code', cursor: 'Cursor', copilot: 'Copilot'};
export const STATES = new Set(['loading', 'ready', 'partial', 'stale', 'missing-auth', 'unsupported', 'unavailable']);
export const WINDOW_STATES = new Set(['active', 'exhausted', 'unlimited']);

export function number(value) {
    if (value === null || value === undefined || value === '' || typeof value === 'boolean')
        return null;
    const result = Number(value);
    return Number.isFinite(result) && result >= 0 ? result : null;
}

export function section(status = 'loading', message = '') {
    return {status, message, updatedAt: null};
}

export function record(id) {
    return {
        schemaVersion: SCHEMA_VERSION, id, name: NAMES[id] ?? id, plan: null, accountKey: null,
        capabilities: {limits: false, history: false, models: false},
        limits: {...section(), scope: 'account', windows: []},
        history: {...section('unsupported', 'This provider does not expose local token history.'),
            scope: 'local', period: null, days: [], models: [], source: null},
    };
}

export function windowUsage({id, label, usedPercent, used, limit, unit = 'percent', durationMinutes = null,
    resetsAt = null, unlimited = false}) {
    let percent = number(usedPercent);
    used = number(used);
    limit = number(limit);
    if (percent === null && used !== null && limit > 0)
        percent = used / limit * 100;
    if (percent === null && !unlimited)
        return null;
    const normalizedPercent = unlimited ? null : percent;
    return {id, label, usedPercent: normalizedPercent, used, limit, unit, unlimited,
        state: unlimited ? 'unlimited' : normalizedPercent >= 100 ? 'exhausted' : 'active',
        durationMinutes: number(durationMinutes), resetsAt: validTime(resetsAt)};
}

export function validTime(value) {
    if (value === null || value === undefined || value === '')
        return null;
    const numeric = typeof value === 'number' || /^\d+(\.\d+)?$/.test(String(value).trim()) ? Number(value) : null;
    const ms = numeric !== null ? (numeric < 1e12 ? numeric * 1000 : numeric) : Date.parse(value);
    return Number.isFinite(ms) && ms > 0 ? ms : null;
}

export function validateRecord(value, expectedId) {
    if (!value || value.schemaVersion !== SCHEMA_VERSION || value.id !== expectedId || !NAMES[value.id])
        throw new Error('Unsupported usage record');
    if (!value.capabilities || ['limits', 'history', 'models'].some(name => typeof value.capabilities[name] !== 'boolean'))
        throw new Error('Invalid provider capabilities');
    for (const name of ['limits', 'history']) {
        if (!value[name] || !STATES.has(value[name].status))
            throw new Error(`Invalid ${name} state`);
    }
    if (!Array.isArray(value.limits.windows) || !Array.isArray(value.history.days) || !Array.isArray(value.history.models))
        throw new Error('Invalid usage arrays');
    for (const item of value.limits.windows) {
        if (typeof item.id !== 'string' || typeof item.label !== 'string' || !WINDOW_STATES.has(item.state) ||
            (!item.unlimited && number(item.usedPercent) === null))
            throw new Error('Invalid quota window');
    }
    for (const item of [...value.history.days, ...value.history.models]) {
        if (number(item.total) === null)
            throw new Error('Invalid token count');
    }
    return value;
}

export function mergeRecord(previous, next) {
    if (!previous || (previous.accountKey && next.accountKey && previous.accountKey !== next.accountKey))
        return next;
    const result = {...next};
    for (const key of ['limits', 'history']) {
        const old = previous[key];
        const current = next[key];
        if (['unavailable', 'missing-auth'].includes(current.status) && old?.updatedAt &&
            ['ready', 'partial', 'stale'].includes(old.status)) {
            const preserved = key === 'limits'
                ? {...old, windows: old.windows.filter(window => !window.resetsAt || window.resetsAt > Date.now())}
                : old;
            if (key !== 'limits' || preserved.windows.length)
                result[key] = {...preserved, status: 'stale', message: current.message};
        }
    }
    result.plan ??= previous.plan;
    result.accountKey ??= previous.accountKey;
    return result;
}

export function highestUsage(value) {
    if (!value || value.limits.status !== 'ready')
        return null;
    const values = value.limits.windows.filter(w => !w.unlimited && number(w.usedPercent) !== null).map(w => w.usedPercent);
    return values.length ? Math.max(...values) : null;
}

export function localDate(time) {
    const d = new Date(time);
    if (!Number.isFinite(d.getTime()))
        return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function recentDates(now, count = 7) {
    const today = new Date(now);
    today.setHours(12, 0, 0, 0);
    return Array.from({length: count}, (_, i) => {
        const day = new Date(today);
        day.setDate(day.getDate() - (count - 1 - i));
        return localDate(day);
    });
}

export function aggregateEvents(events, now = Date.now(), count = 7) {
    const dates = recentDates(now, count);
    const days = new Map(dates.map(date => [date, {date, total: 0, sessions: 0, events: 0}]));
    const models = new Map();
    const seen = new Set();
    const sessions = new Map(dates.map(date => [date, new Set()]));
    for (const event of events) {
        const day = days.get(event.date);
        if (!day || seen.has(event.id))
            continue;
        seen.add(event.id);
        const tokens = ['input', 'output', 'cacheRead', 'cacheWrite'].map(k => number(event[k]) ?? 0);
        const total = tokens.reduce((a, b) => a + b, 0);
        if (!total)
            continue;
        const model = String(event.model || 'Unknown model');
        const bucket = models.get(model) ?? {model, total: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0};
        ['input', 'output', 'cacheRead', 'cacheWrite'].forEach((k, i) => { bucket[k] += tokens[i]; });
        bucket.total += total;
        models.set(model, bucket);
        day.total += total;
        day.events++;
        sessions.get(event.date).add(event.session);
        day.sessions = sessions.get(event.date).size;
    }
    return {period: {start: dates[0], end: dates.at(-1)}, days: [...days.values()],
        models: [...models.values()].sort((a, b) => b.total - a.total)};
}
