import {localDate, number, record, section, validTime, windowUsage} from '../core/usage.js';

const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';

function planLabel(tier, subscription) {
    const match = String(tier || '').match(/max_(\d+x)/i);
    if (match)
        return `Max ${match[1]}`;
    const value = String(subscription || '').trim();
    return value ? value[0].toUpperCase() + value.slice(1) : null;
}

export function claudeLogin(credentials) {
    const login = credentials?.claudeAiOauth;
    if (!login || typeof login !== 'object')
        return {token: null, expiresAt: null, plan: null};
    return {token: String(login.accessToken || '') || null,
        expiresAt: number(login.expiresAt),
        plan: planLabel(login.rateLimitTier, login.subscriptionType)};
}

function rawUtilization(value) {
    if (value === null || value === undefined || value === '')
        return null;
    const result = Number(String(value).trim().replace('%', ''));
    return Number.isFinite(result) && result >= 0 ? result : null;
}

function utilization(value, percentScale) {
    const result = rawUtilization(value);
    if (result === null)
        return null;
    return Math.min(100, percentScale || result > 1 ? result : result * 100);
}

function scopedDuration(kind) {
    const value = String(kind || '').toLowerCase();
    if (value.includes('month'))
        return {label: 'Monthly', minutes: 43200};
    if (value.includes('week') || value.includes('day'))
        return {label: 'Weekly', minutes: 10080};
    if (value.includes('hour') || value.includes('session'))
        return {label: 'Session', minutes: 300};
    return {label: '', minutes: null};
}

export function claudeLimits(payload, now = Date.now()) {
    if (!payload || typeof payload !== 'object')
        return {...section('unavailable', 'Claude did not report any quota windows.'), scope: 'account', windows: []};
    const session = payload.five_hour;
    const weekly = payload.seven_day_oauth_apps ?? payload.seven_day;
    const scoped = Array.isArray(payload.limits) ? payload.limits : [];
    const raw = [session?.utilization, weekly?.utilization,
        ...scoped.map(item => item?.percent)].map(rawUtilization).filter(value => value !== null);
    const percentScale = raw.some(value => value >= 1);
    const windows = [];
    const add = (id, label, bucket, durationMinutes) => {
        if (!bucket || typeof bucket !== 'object')
            return;
        const item = windowUsage({id, label, usedPercent: utilization(bucket.utilization, percentScale),
            durationMinutes, resetsAt: validTime(bucket.resets_at)});
        if (item)
            windows.push(item);
    };
    add('five-hour', 'Session · 5 hours', session, 300);
    add('weekly', 'Weekly', weekly, 10080);
    const seen = new Set();
    for (const item of scoped) {
        const model = item?.scope?.model;
        const name = String(model?.display_name || model?.id || '').trim();
        const kind = String(item?.kind || '').trim();
        const key = `${name}:${kind}`;
        if (!name || seen.has(key))
            continue;
        const duration = scopedDuration(kind);
        const value = windowUsage({id: `scoped:${key}`, label: `${name}${duration.label ? ` · ${duration.label}` : ''}`,
            usedPercent: utilization(item.percent, percentScale), durationMinutes: duration.minutes,
            resetsAt: validTime(item.resets_at)});
        if (value) {
            seen.add(key);
            windows.push(value);
        }
    }
    return windows.length
        ? {...section('ready'), updatedAt: now, scope: 'account', source: 'Anthropic OAuth usage', windows}
        : {...section('unavailable', 'Claude did not report any supported quota windows.'), scope: 'account', windows: []};
}

export function parseClaudeEvent(entry, state) {
    const message = entry?.message && typeof entry.message === 'object' ? entry.message : {};
    if (entry?.type !== 'assistant' && message.role !== 'assistant')
        return null;
    const usage = message.usage ?? entry.usage;
    if (!usage || typeof usage !== 'object')
        return null;
    if (entry.sessionId)
        state.session = entry.sessionId;
    const timestamp = entry.timestamp ?? message.timestamp;
    const date = localDate(timestamp);
    if (!date)
        return null;
    const input = number(usage.input_tokens ?? usage.inputTokens) ?? 0;
    const output = number(usage.output_tokens ?? usage.outputTokens) ?? 0;
    const cacheRead = number(usage.cache_read_input_tokens ?? usage.cacheReadInputTokens) ?? 0;
    const cacheWrite = number(usage.cache_creation_input_tokens ?? usage.cacheCreationInputTokens) ?? 0;
    if (input + output + cacheRead + cacheWrite === 0)
        return null;
    const model = message.model ?? entry.model ?? state.model ?? 'Unknown model';
    state.model = model;
    const identity = message.id ?? entry.messageId ?? entry.uuid ?? entry.requestId ?? `${timestamp}:${JSON.stringify(usage)}`;
    return {id: `${state.session}:${identity}`, session: state.session, date, model,
        input, output, cacheRead, cacheWrite};
}

export async function collectClaude(io) {
    const result = record('claude');
    result.capabilities = {limits: true, history: true, models: true};
    result.history = io.scan('claude', ['projects'], parseClaudeEvent);
    const login = claudeLogin(io.credentials('claude'));
    result.plan = login.plan;
    if (!login.token) {
        const installed = io.hasCommand?.('claude') !== false;
        result.limits = {...result.limits, ...section(installed ? 'missing-auth' : 'unsupported',
            installed ? 'Run claude auth login to read account limits.' : 'Install Claude Code, then sign in to read account limits.')};
        return result;
    }
    result.accountKey = io.fingerprint(login.token);
    if (login.expiresAt && login.expiresAt <= Date.now()) {
        result.limits = {...result.limits, ...section('missing-auth', 'Claude Code sign-in expired. Start Claude Code or run claude auth login.')};
        return result;
    }
    try {
        const response = await io.http(USAGE_URL, {headers: {
            Authorization: `Bearer ${login.token}`,
            'anthropic-beta': 'oauth-2025-04-20',
            Accept: 'application/json',
        }});
        if (response.status === 200) {
            result.limits = claudeLimits(response.data);
        } else {
            result.limits = {...result.limits, ...section([401, 403].includes(response.status) ? 'missing-auth' : 'unavailable',
                [401, 403].includes(response.status) ? 'Reconnect Claude Code to read account limits.' :
                    response.status === 429 ? 'Anthropic is rate limiting usage checks. Local history is still available.' :
                        `Claude usage endpoint unavailable (HTTP ${response.status}).`)};
        }
    } catch {
        result.limits = {...result.limits, ...section('unavailable', 'Could not reach Claude usage. Local history is still available.')};
    }
    return result;
}
