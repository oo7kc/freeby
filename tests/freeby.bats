#!/usr/bin/env bats

SCRIPT="$BATS_TEST_DIRNAME/../scripts/freeby.sh"

@test "outputs valid JSON" {
    run bash "$SCRIPT"
    [ "$status" -eq 0 ]
    echo "$output" | python3 -c "import json,sys; json.load(sys.stdin)"
}

@test "JSON contains codex, cursor, copilot keys" {
    run bash "$SCRIPT"
    echo "$output" | python3 -c "
import json,sys
d = json.load(sys.stdin)
assert 'codex' in d, 'missing codex'
assert 'cursor' in d, 'missing cursor'
assert 'copilot' in d, 'missing copilot'
"
}

@test "each provider has required fields" {
    run bash "$SCRIPT"
    echo "$output" | python3 -c "
import json,sys
d = json.load(sys.stdin)
for k in ('codex','cursor','copilot'):
    p = d[k]
    assert 'available' in p, f'{k} missing available'
    assert 'has_remaining' in p, f'{k} missing has_remaining'
    assert 'summary' in p, f'{k} missing summary'
    assert isinstance(p['available'], bool), f'{k} available not bool'
    assert isinstance(p['has_remaining'], bool), f'{k} has_remaining not bool'
"
}

@test "script cleans up temp directory" {
    before=$(ls /tmp | grep -c 'tmp\.' || true)
    run bash "$SCRIPT"
    after=$(ls /tmp | grep -c 'tmp\.' || true)
    [ "$after" -le "$before" ]
}
