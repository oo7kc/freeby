import test from 'node:test';
import assert from 'node:assert/strict';
import {latestUpdate, periodDays, providerStatus} from '../../src/ui/presentation.js';

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
