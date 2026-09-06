import {number, record, section, windowUsage} from '../core/usage.js';

export async function collectCursor(io) {
    const result = record('cursor');
    result.capabilities.limits = true;
    const token = await io.token('cursor');
    if (!token) {
        result.limits = {...result.limits, ...section('missing-auth', 'Sign in to Cursor to read usage.')};
        return result;
    }
    const {status, data} = await io.http('https://api2.cursor.sh/aiserver.v1.DashboardService/GetCurrentPeriodUsage',
        {method: 'POST', headers: {Authorization: `Bearer ${token}`, 'Connect-Protocol-Version': '1'}, body: {}});
    if (status !== 200 || !data || typeof data !== 'object') {
        result.limits = {...result.limits, ...section([401, 403].includes(status) ? 'missing-auth' : 'unavailable',
            [401, 403].includes(status) ? 'Reconnect Cursor to read usage.' : `Usage endpoint unavailable (HTTP ${status}).`)};
        return result;
    }
    const noPlan = number(data.spendLimitUsage?.overallLimit) === 0;
    const percent = noPlan ? null : number(data.planUsage?.totalPercentUsed);
    const window = windowUsage({id: 'plan', label: 'Included usage', usedPercent: percent,
        resetsAt: number(data.billingCycleEnd)});
    if (window)
        result.limits.windows.push(window);
    result.limits = {...result.limits, ...section(result.limits.windows.length ? 'ready' : 'unavailable',
        result.limits.windows.length ? '' : 'No supported allowance was reported. Check the Cursor dashboard.'),
    updatedAt: result.limits.windows.length ? Date.now() : null};
    result.accountKey = io.fingerprint(token);
    return result;
}
