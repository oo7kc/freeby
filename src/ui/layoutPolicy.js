// Progressively reduce simultaneous content, never the user's font size.
export function initialLayout() {
    return {limits: 3, models: 4, splitActivity: false, compact: false, splitSections: false};
}

export function nextLayout(layout, expanded) {
    if (expanded && !layout.splitActivity)
        return {...layout, splitActivity: true};
    if (layout.limits > 1)
        return {...layout, limits: layout.limits - 1};
    if (!layout.compact)
        return {...layout, compact: true};
    if (expanded && layout.models > 1)
        return {...layout, models: layout.models - 1};
    if (expanded && !layout.splitSections)
        return {...layout, splitSections: true};
    return null;
}

export function pageSlice(items, requested, size) {
    const pages = Math.max(1, Math.ceil(items.length / size));
    const page = Math.max(0, Math.min(pages - 1, requested));
    return {items: items.slice(page * size, (page + 1) * size), page, pages};
}
