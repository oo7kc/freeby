import {number, record, section, windowUsage} from '../core/usage.js';

export async function collectCopilot(io) {
    const result = record('copilot');
    result.capabilities.limits = true;
    const token = await io.token('copilot');
    if (!token) {
        result.limits = {...result.limits, ...section('missing-auth', 'Sign in to GitHub CLI to read Copilot usage.')};
        return result;
    }
    result.accountKey = io.fingerprint(token);
    let status;
    let data;
    try {
        ({status, data} = await io.http('https://api.github.com/copilot_internal/user',
            {headers: {Authorization: `Bearer ${token}`, Accept: 'application/json'}}));
    } catch {
        result.limits = {...result.limits, ...section('unavailable', 'Could not reach GitHub Copilot usage. Retry later.')};
        return result;
    }
    if (status !== 200 || !data || typeof data !== 'object') {
        result.limits = {...result.limits, ...section([401, 403].includes(status) ? 'missing-auth' : 'unavailable',
            [401, 403].includes(status) ? 'Reconnect GitHub CLI to read Copilot usage.' : `Usage endpoint unavailable (HTTP ${status}).`)};
        return result;
    }
    for (const [key, quota] of Object.entries(data.quota_snapshots ?? {})) {
        const limit = number(quota.entitlement);
        const remaining = number(quota.remaining);
        const item = windowUsage({id: key, label: key.replaceAll('_', ' '), unit: 'requests', limit,
            used: limit !== null && remaining !== null ? Math.max(0, limit - remaining) : null,
            unlimited: quota.unlimited === true, resetsAt: data.quota_reset_date_utc});
        if (item)
            result.limits.windows.push(item);
    }
    result.plan = data.copilot_plan ?? null;
    result.limits = {...result.limits, ...section(result.limits.windows.length ? 'ready' : 'unavailable',
        result.limits.windows.length ? '' : 'No supported allowance was reported. Check the GitHub Copilot dashboard.'),
    updatedAt: result.limits.windows.length ? io.now?.() ?? Date.now() : null,
    source: result.limits.windows.length ? 'GitHub Copilot entitlement' : null};
    return result;
}
