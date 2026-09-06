import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregateEvents, highestUsage, mergeRecord, number, recentDates, record, validTime, validateRecord, windowUsage} from '../../src/core/usage.js';
import {resetTime, tokens} from '../../src/core/format.js';
import {ThresholdTracker} from '../../src/core/notifications.js';

test('unknown metrics are not coerced to zero', () => {
    for (const value of [null, undefined, '', false, -1, Infinity, 'bad'])
        assert.equal(number(value), null);
    assert.equal(number(0), 0);
    assert.equal(windowUsage({id: 'plan', label: 'Plan', used: 0, limit: 0}), null);
    assert.equal(highestUsage(record('codex')), null);
});

test('unknown, exhausted and unlimited windows remain distinct', () => {
    const exhausted = windowUsage({id: 'x', label: 'X', used: 12, limit: 10});
    assert.equal(exhausted.usedPercent, 120);
    assert.equal(exhausted.state, 'exhausted');
    const unlimited = windowUsage({id: 'x', label: 'X', unlimited: true});
    assert.equal(unlimited.usedPercent, null);
    assert.equal(unlimited.unlimited, true);
    assert.equal(unlimited.state, 'unlimited');
});

test('contract rejects invalid provider IDs and quota values', () => {
    assert.throws(() => validateRecord(record('codex'), 'cursor'));
    const value = record('codex');
    value.limits.windows.push({id: 'x', label: 'X', state: 'active', usedPercent: null});
    assert.throws(() => validateRecord(value, 'codex'));
});

test('failure preserves last successful values as stale, account change discards them', () => {
    const old = record('codex');
    old.accountKey = 'one';
    old.limits = {status: 'ready', updatedAt: 100, windows: [{usedPercent: 50}]};
    const next = record('codex');
    next.limits.status = 'unavailable';
    next.limits.message = 'Disconnected';
    const merged = mergeRecord(old, next);
    assert.equal(merged.limits.status, 'stale');
    assert.equal(merged.limits.updatedAt, 100);
    assert.equal(merged.limits.windows[0].usedPercent, 50);
    assert.equal(highestUsage(merged), null);
    next.accountKey = 'two';
    assert.equal(mergeRecord(old, next).limits.windows.length, 0);
});

test('stale quota windows are discarded after their reset', () => {
    const old = record('claude');
    old.limits = {status: 'ready', updatedAt: 100, windows: [
        {id: 'expired', resetsAt: 1},
        {id: 'open', resetsAt: Date.now() + 60000},
    ]};
    const next = record('claude');
    next.limits.status = 'unavailable';
    const result = mergeRecord(old, next);
    assert.equal(result.limits.status, 'stale');
    assert.deepEqual(result.limits.windows.map(window => window.id), ['open']);
});

test('daily and model totals use the same period and deduplicate events', () => {
    const event = {id: 'one', session: 'a', model: 'model-a', date: '2026-09-06', input: 20, output: 5, cacheRead: 10, cacheWrite: 0};
    const result = aggregateEvents([event, event, {...event, id: 'older', date: '2026-08-01'}], new Date('2026-09-06T12:00:00').getTime());
    assert.equal(result.days.length, 7);
    assert.equal(result.days.reduce((sum, d) => sum + d.total, 0), 35);
    assert.equal(result.models[0].total, 35);
    assert.equal(result.days.at(-1).sessions, 1);
    assert.equal(result.period.start, '2026-08-31');
});

test('calendar buckets are consecutive across month boundaries', () => {
    assert.deepEqual(recentDates(new Date('2026-03-02T12:00:00').getTime(), 3), ['2026-02-28', '2026-03-01', '2026-03-02']);
    assert.equal(validTime('1800000000'), 1800000000000);
});

test('notifications require a verified crossing and deduplicate warning and limit separately', () => {
    const tracker = new ThresholdTracker();
    const value = record('codex');
    value.limits = {status: 'ready', windows: [{id: 'weekly', label: 'Weekly', usedPercent: 95, resetsAt: 500}]};
    assert.deepEqual(tracker.update(value), []);
    value.limits.windows[0].usedPercent = 100;
    assert.equal(tracker.update(value)[0].threshold, 100);
    assert.deepEqual(tracker.update(value), []);
    value.limits.status = 'unavailable';
    assert.deepEqual(tracker.update(value), []);
    value.limits.status = 'ready';
    value.limits.windows[0].resetsAt = 1000;
    assert.deepEqual(tracker.update(value), []);
});

test('formatting preserves unknown/reset-due states', () => {
    assert.equal(tokens(null), '—');
    assert.equal(tokens(23000000), '23.0M');
    assert.equal(resetTime(null), 'Reset time unavailable');
    assert.match(resetTime(100, 200), /awaiting update/);
});
