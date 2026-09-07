export function tokens(value) {
    if (!Number.isFinite(value))
        return '—';
    for (const [unit, divisor] of [['B', 1e9], ['M', 1e6], ['K', 1e3]]) {
        if (value >= divisor)
            return `${(value / divisor).toFixed(1)}${unit}`;
    }
    return String(Math.round(value));
}

export function compactTokens(value) {
    return tokens(value).replace(/\.0(?=[BMK]$)/, '');
}

export function dateRange(period, locale = undefined) {
    const start = new Date(`${period?.start ?? ''}T12:00:00`);
    const end = new Date(`${period?.end ?? ''}T12:00:00`);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start)
        return 'Dates unavailable';
    const formatter = new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
    return typeof formatter.formatRange === 'function'
        ? formatter.formatRange(start, end)
        : `${formatter.format(start)} – ${formatter.format(end)}`;
}

export function resetTime(time, now = Date.now()) {
    if (!Number.isFinite(time) || time <= 0)
        return 'Reset time unavailable';
    const minutes = Math.ceil((time - now) / 60000);
    if (minutes <= 0)
        return 'Reset due · awaiting update';
    if (minutes >= 1440)
        return `Resets in ${Math.floor(minutes / 1440)}d ${Math.floor(minutes % 1440 / 60)}h`;
    if (minutes >= 60)
        return `Resets in ${Math.floor(minutes / 60)}h ${minutes % 60}m`;
    return `Resets in ${minutes}m`;
}

export function resetCountdown(time, now = Date.now()) {
    const value = resetTime(time, now);
    if (value.startsWith('Resets in '))
        return value.slice('Resets in '.length);
    if (value.startsWith('Reset due'))
        return 'due';
    return null;
}

export function age(time, now = Date.now()) {
    if (!time)
        return 'Never updated';
    const minutes = Math.max(0, Math.floor((now - time) / 60000));
    if (!minutes)
        return 'Updated just now';
    if (minutes < 60)
        return `Updated ${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return hours < 24 ? `Updated ${hours}h ago` : `Updated ${Math.floor(hours / 24)}d ago`;
}

export function modelName(value) {
    const acronyms = new Map([['gpt', 'GPT'], ['api', 'API']]);
    return String(value || 'Unknown model').replaceAll(/[-_/]+/g, ' ').split(/\s+/).filter(Boolean)
        .map(word => acronyms.get(word.toLowerCase()) ?? word[0].toUpperCase() + word.slice(1)).join(' ');
}
