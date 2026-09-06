import test from 'node:test';
import assert from 'node:assert/strict';
import {historyOverview, latestUpdate, periodDays, providerStatus} from '../../src/ui/presentation.js';

test('provider status distinguishes live, local, cached and setup data', () => {
    const value = {limits: {status: 'ready'}, history: {status: 'ready'}};
    assert.equal(providerStatus(value), 'LIVE');
    value.limits.status = 'unavailable';
    assert.equal(providerStatus(value), 'LOCAL');
    value.history.status = 'stale';
    assert.equal(providerStatus(value), 'CACHED');
    value.history.status = 'unsupported';
    assert.equal(providerStatus(value), 'SETUP');
    assert.equal(providerStatus(value, true), 'SYNC');
    assert.equal(providerStatus(null, true), 'SYNC');
    value.limits.status = 'ready';
    assert.equal(providerStatus(value, true), 'LIVE');
});

test('presentation helpers derive bounded period and freshness labels', () => {
    assert.equal(latestUpdate({limits: {updatedAt: 10}, history: {updatedAt: 20}}), 20);
    assert.equal(latestUpdate(null), null);
    assert.equal(periodDays({start: '2026-08-31', end: '2026-09-06'}), 7);
    assert.equal(periodDays({start: 'invalid', end: '2026-09-06'}), null);
});

test('history overview summarizes daily activity without double-counting models', () => {
    const history = {
        scope: 'local',
        period: {start: '2026-08-31', end: '2026-09-06'},
        days: [{total: 10}, {total: 20}],
        models: [{total: 30}, {total: 40}],
    };
    assert.deepEqual(historyOverview(history), {days: 7, scope: 'local', total: 30});
    assert.deepEqual(historyOverview({...history, scope: 'account', days: []}),
        {days: 7, scope: 'account', total: 70});
    assert.equal(historyOverview({...history, days: [], models: []}), null);
    assert.equal(historyOverview(null), null);
});
