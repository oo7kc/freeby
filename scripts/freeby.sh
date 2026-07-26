#!/usr/bin/env bash
# Aggregates local AI coding tool usage into one JSON blob.
# Run standalone: bash ~/.local/bin/freeby.sh | python3 -m json.tool

set -uo pipefail

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

json_escape() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//\"/\\\"}"
    s="${s//$'\n'/ }"
    s="${s//$'\t'/ }"
    s="${s//$'\r'/ }"
    s="$(printf '%s' "$s" | tr -d '[:cntrl:]')"
    printf '%s' "$s"
}

# --- codex -------------------------------------------------------------------
fetch_codex() {
    local out="$TMPDIR/codex"
    if [ ! -f "$HOME/.codex/auth.json" ]; then
        echo '{"available":false,"has_remaining":false,"summary":"not detected"}' > "$out"
        return
    fi
    local json
    json="$(npx --yes codex-check --auth "$HOME/.codex/auth.json" --json 2>/dev/null)"
    if [ -z "$json" ]; then
        echo '{"available":true,"has_remaining":false,"summary":"auth.json found, codex-check produced no output"}' > "$out"
        return
    fi
    printf '%s' "$json" | python3 -c "
import json, sys
from datetime import datetime, timezone
try:
    data = json.load(sys.stdin)
    if isinstance(data, list): data = data[0]
    w = data.get('windows', {}).get('primary', {})
    pct = w.get('percentUsed', 0)
    resets_at = w.get('resetsAt', '')
    if resets_at:
        dt = datetime.fromisoformat(resets_at.replace('Z', '+00:00'))
        now = datetime.now(timezone.utc)
        diff = dt - now
        if diff.total_seconds() <= 0: cd = 'now'
        elif diff.days > 0: cd = f'in {diff.days}d {diff.seconds//3600}h'
        else: cd = f'in {diff.seconds//3600}h {(diff.seconds%3600)//60}m'
    else: cd = 'unknown'
    has = 'false' if pct >= 100 else 'true'
    summary = f'limit reached, resets {cd}' if pct >= 100 else f'{pct}% used, resets {cd}'
    print(json.dumps({'available': True, 'has_remaining': has == 'true', 'summary': summary}))
except Exception as e:
    print(json.dumps({'available': True, 'has_remaining': False, 'summary': f'parse error: {e}'}))
" > "$out" 2>/dev/null
}

# --- cursor ------------------------------------------------------------------
fetch_cursor() {
    local out="$TMPDIR/cursor"
    local auth_file="$HOME/.config/cursor/auth.json"
    if [ ! -f "$auth_file" ]; then
        echo '{"available":false,"has_remaining":false,"summary":"not detected"}' > "$out"
        return
    fi
    local token
    token="$(python3 -c "import json; print(json.load(open('$auth_file')).get('accessToken',''))" 2>/dev/null)"
    if [ -z "$token" ]; then
        echo '{"available":true,"has_remaining":false,"summary":"auth.json found but no accessToken"}' > "$out"
        return
    fi
    local resp http body
    resp="$(curl -s -w '\n%{http_code}' \
        -X POST 'https://api2.cursor.sh/aiserver.v1.DashboardService/GetCurrentPeriodUsage' \
        -H "Authorization: Bearer $token" \
        -H 'Content-Type: application/json' \
        -H 'Connect-Protocol-Version: 1' \
        -d '{}' 2>/dev/null)"
    http="$(printf '%s' "$resp" | tail -1)"
    body="$(printf '%s' "$resp" | sed '$d')"

    if [ "$http" = "401" ]; then
        echo '{"available":true,"has_remaining":false,"summary":"token expired, reopen cursor to refresh"}' > "$out"
    elif [ "$http" = "200" ] && [ -n "$body" ]; then
        printf '%s' "$body" | python3 -c "
import json, sys
from datetime import datetime, timezone
try:
    d = json.load(sys.stdin)
    pct = d.get('planUsage', {}).get('totalPercentUsed', 0)
    end_ms = int(d.get('billingCycleEnd', '0'))
    dt = datetime.fromtimestamp(end_ms/1000, tz=timezone.utc)
    now = datetime.now(timezone.utc)
    diff = dt - now
    if diff.total_seconds() <= 0: cd = 'now'
    elif diff.days > 0: cd = f'in {diff.days}d {diff.seconds//3600}h'
    else: cd = f'in {diff.seconds//3600}h {(diff.seconds%3600)//60}m'
    has = pct < 100
    summary = f'limit reached, resets {cd}' if pct >= 100 else f'{pct}% used, resets {cd}'
    print(json.dumps({'available': True, 'has_remaining': has, 'summary': summary}))
except Exception as e:
    print(json.dumps({'available': True, 'has_remaining': False, 'summary': f'parse error: {e}'}))
" > "$out" 2>/dev/null
    else
        echo "{\"available\":true,\"has_remaining\":false,\"summary\":\"API returned HTTP $http\"}" > "$out"
    fi
}

# --- copilot -----------------------------------------------------------------
fetch_copilot() {
    local out="$TMPDIR/copilot"
    local token=""
    if command -v gh >/dev/null 2>&1; then
        token="$(gh auth token 2>/dev/null)"
    fi
    if [ -z "$token" ] && [ -f "$HOME/.config/freeby/copilot-token" ]; then
        token="$(cat "$HOME/.config/freeby/copilot-token" 2>/dev/null)"
    fi
    if [ -z "$token" ]; then
        if [ ! -f "$HOME/.config/freeby/copilot-token" ] && ! command -v gh >/dev/null 2>&1; then
            echo '{"available":false,"has_remaining":false,"summary":"run copilot-setup to authenticate"}' > "$out"
        else
            echo '{"available":false,"has_remaining":false,"summary":"not detected"}' > "$out"
        fi
        return
    fi
    local resp http body
    resp="$(curl -s -w '\n%{http_code}' \
        'https://api.github.com/copilot_internal/user' \
        -H "Authorization: Bearer $token" \
        -H 'Content-Type: application/json' 2>/dev/null)"
    http="$(printf '%s' "$resp" | tail -1)"
    body="$(printf '%s' "$resp" | sed '$d')"

    if [ "$http" = "401" ] || [ "$http" = "403" ]; then
        echo '{"available":true,"has_remaining":false,"summary":"auth expired, re-run copilot-setup"}' > "$out"
    elif [ "$http" = "200" ] && [ -n "$body" ]; then
        printf '%s' "$body" | python3 -c "
import json, sys
from datetime import datetime, timezone
try:
    d = json.load(sys.stdin)
    reset_str = d.get('quota_reset_date_utc', '')
    dt = datetime.fromisoformat(reset_str.replace('Z', '+00:00')) if reset_str else None
    q = d.get('quota_snapshots', {}).get('chat', {})
    if q.get('entitlement', 0) == 0:
        q = d.get('quota_snapshots', {}).get('completions', {})
    remaining = q.get('remaining', 0)
    entitlement = q.get('entitlement', 0)
    used = q.get('credits_used', 0)
    if dt:
        now = datetime.now(timezone.utc)
        diff = dt - now
        if diff.total_seconds() <= 0: cd = 'now'
        elif diff.days > 0: cd = f'in {diff.days}d {diff.seconds//3600}h'
        else: cd = f'in {diff.seconds//3600}h {(diff.seconds%3600)//60}m'
    else: cd = 'unknown'
    has = remaining > 0
    if entitlement == 0: summary = f'no quota, resets {cd}'
    elif remaining <= 0: summary = f'limit reached, resets {cd}'
    else: summary = f'{round(used/entitlement*100)}% used, resets {cd}'
    print(json.dumps({'available': True, 'has_remaining': has, 'summary': summary}))
except Exception as e:
    print(json.dumps({'available': True, 'has_remaining': False, 'summary': f'parse error: {e}'}))
" > "$out" 2>/dev/null
    else
        echo "{\"available\":true,\"has_remaining\":false,\"summary\":\"API returned HTTP $http\"}" > "$out"
    fi
}

# --- run all in parallel -----------------------------------------------------
fetch_codex &
fetch_cursor &
fetch_copilot &
wait

# --- output ------------------------------------------------------------------
python3 -c "
import json, sys
result = {}
for name in ('codex', 'cursor', 'copilot'):
    try:
        with open('$TMPDIR/' + name) as f:
            result[name] = json.load(f)
    except:
        result[name] = {'available': False, 'has_remaining': False, 'summary': 'no data'}
print(json.dumps(result))
"
