import test from 'node:test';
import assert from 'node:assert/strict';
import {codexLimits, collectCodex, parseCodexEvent} from '../../src/providers/codex.js';

const tokenEvent = (input, output, cache, total) => ({timestamp: '2026-09-06T12:00:00Z', type: 'event_msg', payload: {type: 'token_count',
    info: {total_token_usage: {input_tokens: input, output_tokens: output, cached_input_tokens: cache, total_tokens: total}}}});

test('reads all quota buckets and derives labels from real window durations', () => {
    const result = codexLimits({rateLimitsByLimitId: {codex: {primary: {usedPercent: 10, windowDurationMins: 300, resetsAt: 1800000000},
        secondary: {usedPercent: 100, windowDurationMins: 10080}}}}, 100);
    assert.equal(result.windows.length, 2);
    assert.equal(result.windows[0].resetsAt, 1800000000000);
    assert.equal(result.windows[0].durationMinutes, 300);
    assert.equal(result.windows[1].label, 'Weekly');
    assert.equal(result.windows[1].usedPercent, 100);
    assert.equal(result.status, 'ready');
});

test('empty Codex response is unavailable, not zero usage', () => {
    assert.equal(codexLimits({}).status, 'unavailable');
    assert.equal(codexLimits({rateLimits: {primary: {}}}).windows.length, 0);
});

test('cumulative token deltas and cached input are counted once', () => {
    const state = {session: 'session-1', model: 'model-a'};
    const first = parseCodexEvent(tokenEvent(100, 20, 40, 120), state);
    assert.equal(first.input, 60);
    assert.equal(first.cacheRead, 40);
    assert.equal(parseCodexEvent(tokenEvent(100, 20, 40, 120), state), null);
    const second = parseCodexEvent(tokenEvent(180, 35, 60, 215), state);
    assert.equal(second.input + second.output + second.cacheRead, 95);
});

test('record parsing tracks model and stable session identity', () => {
    const state = {session: 'file-hash'};
    parseCodexEvent({type: 'session_meta', payload: {id: 'native-session'}}, state);
    parseCodexEvent({type: 'turn_context', payload: {model: 'model-b'}}, state);
    const event = parseCodexEvent(tokenEvent(10, 2, 0, 12), state);
    assert.equal(event.model, 'model-b');
    assert.equal(event.session, 'native-session');
});

test('local history survives missing account authentication and closes RPC', async () => {
    let closed = false;
    const history = {status: 'ready', days: [], models: []};
    const result = await collectCodex({scan: () => history,
        codexClient: () => ({request: async method => method === 'account/read' ? {account: null} : {},
            notify: () => {}, close: () => { closed = true; }})});
    assert.equal(result.limits.status, 'missing-auth');
    assert.equal(result.history, history);
    assert.equal(closed, true);
});
