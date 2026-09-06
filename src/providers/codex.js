import {localDate, number, record, section, windowUsage} from '../core/usage.js';

export function codexLimits(response, now = Date.now()) {
    const buckets = response?.rateLimitsByLimitId && typeof response.rateLimitsByLimitId === 'object'
        ? Object.entries(response.rateLimitsByLimitId)
        : [['codex', response?.rateLimits]];
    const windows = [];
    for (const [bucketId, bucket] of buckets) {
        for (const key of ['primary', 'secondary']) {
            const w = bucket?.[key];
            if (!w)
                continue;
            const mins = number(w.windowDurationMins);
            const duration = mins === 10080 ? 'Weekly' : mins === 300 ? 'Session · 5 hours'
                : mins ? `${mins >= 60 ? `${mins / 60} hours` : `${mins} minutes`}` : key === 'primary' ? 'Primary window' : 'Secondary window';
            const item = windowUsage({id: `${bucketId}:${key}`,
                label: buckets.length > 1 ? `${bucket.limitName || bucketId} · ${duration}` : duration,
                usedPercent: w.usedPercent, durationMinutes: mins,
                resetsAt: number(w.resetsAt) ? Number(w.resetsAt) * 1000 : null});
            if (item)
                windows.push(item);
        }
    }
    return windows.length
        ? {...section('ready'), updatedAt: now, scope: 'account', windows}
        : {...section('unavailable', 'Codex did not report quota windows for this account.'), scope: 'account', windows: []};
}

export function parseCodexEvent(entry, state) {
    if (entry?.type === 'session_meta')
        state.session = entry.payload?.id || state.session;
    if (entry?.type === 'turn_context')
        state.model = entry.payload?.model || entry.payload?.model_slug || state.model;
    const payload = entry?.payload;
    if (payload?.type !== 'token_count' || !payload.info)
        return null;
    const cumulative = payload.info.total_token_usage;
    let usage = payload.info.last_token_usage;
    let identity;
    if (cumulative && number(cumulative.total_tokens) !== null) {
        const total = Number(cumulative.total_tokens);
        if (state.cumulative && total <= state.cumulative.total_tokens)
            return null;
        const previous = state.cumulative ?? {};
        usage = Object.fromEntries(['input_tokens', 'output_tokens', 'cached_input_tokens', 'cache_write_input_tokens']
            .map(k => [k, Math.max(0, (number(cumulative[k]) ?? 0) - (number(previous[k]) ?? 0))]));
        state.cumulative = cumulative;
        identity = `total:${total}`;
    } else {
        identity = `${entry.timestamp}:${JSON.stringify(usage)}`;
    }
    if (!usage || !localDate(entry.timestamp))
        return null;
    const input = number(usage.input_tokens) ?? 0;
    const cacheRead = Math.min(input, number(usage.cached_input_tokens) ?? 0);
    const cacheWrite = Math.min(input - cacheRead, number(usage.cache_write_input_tokens) ?? 0);
    return {id: `${state.session}:${identity}`, session: state.session, date: localDate(entry.timestamp),
        model: state.model || 'Unknown model', input: input - cacheRead - cacheWrite,
        output: number(usage.output_tokens) ?? 0, cacheRead, cacheWrite};
}

export async function collectCodex(io) {
    const result = record('codex');
    result.capabilities = {limits: true, history: true, models: true};
    result.history = io.scan('codex', ['sessions', 'archived_sessions'], parseCodexEvent);
    let rpc;
    try {
        rpc = io.codexClient();
        await rpc.request('initialize', {clientInfo: {name: 'freeby', version: '2.0.0'}, capabilities: {experimentalApi: false}});
        rpc.notify('initialized', {});
        const account = await rpc.request('account/read', {refreshToken: false});
        if (!account?.account) {
            result.limits = {...result.limits, ...section('missing-auth', 'Sign in with codex login to read account limits.')};
            return result;
        }
        result.plan = account.account.planType ?? account.account.type ?? null;
        result.accountKey = io.fingerprint(account.account.email || account.account.chatgptAccountId || result.plan);
        const limits = await rpc.request('account/rateLimits/read', {});
        result.limits = {...codexLimits(limits), source: 'Codex app-server'};
        result.plan = limits?.rateLimits?.planType ?? result.plan;
    } catch (error) {
        result.limits = {...result.limits, ...section(error.code === 'NOT_FOUND' ? 'unsupported' : 'unavailable',
            error.code === 'NOT_FOUND' ? 'Install the Codex CLI to read account limits.' : 'Could not read Codex limits. Check CLI sign-in and compatibility.')};
    } finally {
        rpc?.close();
    }
    return result;
}
