import {number, record, section, windowUsage} from '../core/usage.js';

export async function collectLegacy(id, io) {
    const result = record(id);
    result.capabilities.limits = true;
    const token = await io.token(id);
    if (!token) {
        result.limits = {...result.limits, ...section('missing-auth', `Sign in to ${result.name} to read usage.`)};
        return result;
    }
    const response = id === 'cursor'
        ? await io.http('https://api2.cursor.sh/aiserver.v1.DashboardService/GetCurrentPeriodUsage',
            {method: 'POST', headers: {Authorization: `Bearer ${token}`, 'Connect-Protocol-Version': '1'}, body: {}})
        : await io.http('https://api.github.com/copilot_internal/user', {headers: {Authorization: `Bearer ${token}`, Accept: 'application/json'}});
    const {status, data} = response;
    if (status !== 200 || !data || typeof data !== 'object') {
        result.limits = {...result.limits, ...section([401, 403].includes(status) ? 'missing-auth' : 'unavailable',
            [401, 403].includes(status) ? `Reconnect ${result.name} to read usage.` : `Usage endpoint unavailable (HTTP ${status}).`)};
        return result;
    }
    if (id === 'cursor') {
        const noPlan = number(data.spendLimitUsage?.overallLimit) === 0;
        const percent = noPlan ? null : number(data.planUsage?.totalPercentUsed);
        const window = windowUsage({id: 'plan', label: 'Included usage', usedPercent: percent,
            resetsAt: number(data.billingCycleEnd)});
        if (window)
            result.limits.windows.push(window);
    } else {
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
    }
    result.limits = {...result.limits, ...section(result.limits.windows.length ? 'ready' : 'unavailable',
        result.limits.windows.length ? '' : 'No supported allowance was reported. Check the provider dashboard.'),
    updatedAt: result.limits.windows.length ? Date.now() : null};
    result.accountKey = io.fingerprint(token);
    return result;
}
