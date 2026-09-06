export function tokens(value) {
    if (!Number.isFinite(value))
        return '—';
    for (const [unit, divisor] of [['B', 1e9], ['M', 1e6], ['K', 1e3]]) {
        if (value >= divisor)
            return `${(value / divisor).toFixed(1)}${unit}`;
    }
    return String(Math.round(value));
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

export function age(time, now = Date.now()) {
    if (!time)
        return 'Never updated';
    const minutes = Math.max(0, Math.floor((now - time) / 60000));
    if (!minutes)
        return 'Updated just now';
    return minutes < 60 ? `Updated ${minutes}m ago` : `Updated ${Math.floor(minutes / 60)}h ago`;
}
