#!/usr/bin/env bash
# Aggregates local AI coding tool usage into one JSON blob.
# Run standalone: bash ~/.local/bin/freeby.sh | python3 -m json.tool

set -uo pipefail

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

strip_ansi() {
    printf '%s' "$1" | sed -E 's/\x1b\[[0-9;]*[a-zA-Z]//g'
}

strip_box_lines() {
    printf '%s' "$1" \
        | tr -d '│╭╮╰╯─┌┐└┘┼├┤┬┴┏┓┗┛━┃' \
        | sed -E '/^[[:space:]]*$/d' \
        | tr '\n' ' ' \
        | sed -E 's/ +/ /g' \
        | cut -c1-140
}

countdown() {
    python3 -c "
from datetime import datetime, timezone
import sys
raw = sys.stdin.read().strip()
for fmt in ('%Y-%m-%d %H:%M UTC', '%Y-%m-%d %H:%M:%S %Z'):
    try:
        dt = datetime.strptime(raw, fmt).replace(tzinfo=timezone.utc)
        break
    except ValueError:
        continue
else:
    try:
        dt = datetime.fromisoformat(raw.replace('Z', '+00:00'))
    except:
        print('unknown')
        sys.exit()
now = datetime.now(timezone.utc)
diff = dt - now
if diff.total_seconds() <= 0:
    print('now')
elif diff.days > 0:
    h = diff.seconds // 3600
    print(f'in {diff.days}d {h}h')
else:
    h = diff.seconds // 3600
    m = (diff.seconds % 3600) // 60
    print(f'in {h}h {m}m')
" 2>/dev/null
}

# --- codex -------------------------------------------------------------------
codex_available=false
codex_has_remaining=false
codex_summary="not detected"
if [ -f "$HOME/.codex/auth.json" ]; then
    codex_json="$(npx --yes codex-check --auth "$HOME/.codex/auth.json" --json 2>/dev/null)"
    if [ -n "$codex_json" ]; then
        codex_parsed="$(printf '%s' "$codex_json" | python3 -c "
import json, sys
from datetime import datetime, timezone
try:
    data = json.load(sys.stdin)
    if isinstance(data, list):
        data = data[0]
    account = data.get('account', {})
    windows = data.get('windows', {})
    primary = windows.get('primary', {})
    pct = primary.get('percentUsed', 0)
    resets_at = primary.get('resetsAt', '')
    window_label = primary.get('label', 'window')
    if resets_at:
        dt = datetime.fromisoformat(resets_at.replace('Z', '+00:00'))
        now = datetime.now(timezone.utc)
        diff = dt - now
        if diff.total_seconds() <= 0:
            countdown = 'now'
        elif diff.days > 0:
            h = diff.seconds // 3600
            countdown = f'in {diff.days}d {h}h'
        else:
            h = diff.seconds // 3600
            m = (diff.seconds % 3600) // 60
            countdown = f'in {h}h {m}m'
    else:
        countdown = 'unknown'
    has = 'false' if pct >= 100 else 'true'
    if pct >= 100:
        print(f'limit reached, resets {countdown}')
    else:
        print(f'{pct}% used, resets {countdown}')
    print(has)
except Exception as e:
    print(f'parse error: {e}')
    print('false')
" 2>/dev/null)"
        if [ -n "$codex_parsed" ]; then
            codex_summary="$(echo "$codex_parsed" | head -1)"
            codex_has_remaining="$(echo "$codex_parsed" | tail -1)"
            codex_available=true
        else
            codex_summary="unexpected response"
        fi
    else
        codex_summary="auth.json found, codex-check produced no output"
    fi
fi

# --- cursor ------------------------------------------------------------------
cursor_available=false
cursor_has_remaining=false
cursor_summary="not detected"
cursor_auth_file="$HOME/.config/cursor/auth.json"
if [ -f "$cursor_auth_file" ]; then
    cursor_token="$(python3 -c "import json; d=json.load(open('$cursor_auth_file')); print(d.get('accessToken',''))" 2>/dev/null)"
    if [ -n "$cursor_token" ]; then
        cursor_resp="$(curl -s -w '\n%{http_code}' \
            -X POST 'https://api2.cursor.sh/aiserver.v1.DashboardService/GetCurrentPeriodUsage' \
            -H "Authorization: Bearer $cursor_token" \
            -H 'Content-Type: application/json' \
            -H 'Connect-Protocol-Version: 1' \
            -d '{}' 2>/dev/null)"
        cursor_http="$(printf '%s' "$cursor_resp" | tail -1)"
        cursor_body="$(printf '%s' "$cursor_resp" | sed '$d')"

        if [ "$cursor_http" = "401" ]; then
            cursor_summary="token expired, reopen cursor to refresh"
            cursor_available=true
            cursor_has_remaining=false
        elif [ "$cursor_http" = "200" ] && [ -n "$cursor_body" ]; then
            cursor_parsed="$(printf '%s' "$cursor_body" | python3 -c "
import json, sys
from datetime import datetime, timezone, timedelta
try:
    d = json.load(sys.stdin)
    pu = d.get('planUsage', {})
    pct = pu.get('totalPercentUsed', 0)
    end_ms = int(d.get('billingCycleEnd', '0'))
    dt = datetime.fromtimestamp(end_ms/1000, tz=timezone.utc)
    now = datetime.now(timezone.utc)
    diff = dt - now
    if diff.total_seconds() <= 0:
        countdown = 'now'
    elif diff.days > 0:
        h = diff.seconds // 3600
        countdown = f'in {diff.days}d {h}h'
    else:
        h = diff.seconds // 3600
        m = (diff.seconds % 3600) // 60
        countdown = f'in {h}h {m}m'
    has = 'true' if pct < 100 else 'false'
    if pct >= 100:
        print(f'limit reached, resets {countdown}')
    else:
        print(f'{pct}% used, resets {countdown}')
    print(has)
except Exception as e:
    print(f'parse error: {e}')
    print('false')
" 2>/dev/null)"
            if [ -n "$cursor_parsed" ]; then
                cursor_summary="$(echo "$cursor_parsed" | head -1)"
                cursor_has_remaining="$(echo "$cursor_parsed" | tail -1)"
                cursor_available=true
            else
                cursor_summary="unexpected response"
            fi
        else
            cursor_summary="API returned HTTP $cursor_http"
        fi
    else
        cursor_summary="auth.json found but no accessToken"
    fi
fi

# --- copilot -----------------------------------------------------------------
copilot_available=false
copilot_has_remaining=false
copilot_summary="not detected"
copilot_token=""

if command -v gh >/dev/null 2>&1; then
    copilot_token="$(gh auth token 2>/dev/null)"
fi

if [ -z "$copilot_token" ] && [ -f "$HOME/.config/freeby/copilot-token" ]; then
    copilot_token="$(cat "$HOME/.config/freeby/copilot-token" 2>/dev/null)"
fi

if [ -n "$copilot_token" ]; then
    copilot_resp="$(curl -s -w '\n%{http_code}' \
        'https://api.github.com/copilot_internal/user' \
        -H "Authorization: Bearer $copilot_token" \
        -H 'Content-Type: application/json' 2>/dev/null)"
    copilot_http="$(printf '%s' "$copilot_resp" | tail -1)"
    copilot_body="$(printf '%s' "$copilot_resp" | sed '$d')"

    if [ "$copilot_http" = "401" ] || [ "$copilot_http" = "403" ]; then
        copilot_summary="auth expired, re-run copilot-setup"
        copilot_available=true
        copilot_has_remaining=false
    elif [ "$copilot_http" = "200" ] && [ -n "$copilot_body" ]; then
        copilot_parsed="$(printf '%s' "$copilot_body" | python3 -c "
import json, sys
from datetime import datetime, timezone, timedelta
try:
    d = json.load(sys.stdin)
    reset_str = d.get('quota_reset_date_utc', '')
    if reset_str:
        dt = datetime.fromisoformat(reset_str.replace('Z', '+00:00'))
    else:
        dt = None
    quota = d.get('quota_snapshots', {})
    chat = quota.get('chat', {})
    completions = quota.get('completions', {})
    q = chat if chat.get('entitlement', 0) > 0 else completions
    remaining = q.get('remaining', 0)
    entitlement = q.get('entitlement', 0)
    used = q.get('credits_used', 0)
    if dt:
        now = datetime.now(timezone.utc)
        diff = dt - now
        if diff.total_seconds() <= 0:
            countdown = 'now'
        elif diff.days > 0:
            h = diff.seconds // 3600
            countdown = f'in {diff.days}d {h}h'
        else:
            h = diff.seconds // 3600
            m = (diff.seconds % 3600) // 60
            countdown = f'in {h}h {m}m'
    else:
        countdown = 'unknown'
    has = 'true' if remaining > 0 else 'false'
    if entitlement == 0:
        print(f'no quota, resets {countdown}')
    elif remaining <= 0:
        print(f'limit reached, resets {countdown}')
    else:
        print(f'{used}/{entitlement} used, resets {countdown}')
    print(has)
except Exception as e:
    print(f'parse error: {e}')
    print('false')
" 2>/dev/null)"
        if [ -n "$copilot_parsed" ]; then
            copilot_summary="$(echo "$copilot_parsed" | head -1)"
            copilot_has_remaining="$(echo "$copilot_parsed" | tail -1)"
            copilot_available=true
        else
            copilot_summary="unexpected response"
        fi
    else
        copilot_summary="API returned HTTP $copilot_http"
    fi
elif [ ! -f "$HOME/.config/freeby/copilot-token" ] && ! command -v gh >/dev/null 2>&1; then
    copilot_summary="run copilot-setup to authenticate"
fi

# --- output ------------------------------------------------------------------
cat <<EOF
{
  "codex":    {"available": $codex_available, "has_remaining": $codex_has_remaining, "summary": "$(json_escape "$codex_summary")"},
  "cursor":   {"available": $cursor_available, "has_remaining": $cursor_has_remaining, "summary": "$(json_escape "$cursor_summary")"},
  "copilot":  {"available": $copilot_available, "has_remaining": $copilot_has_remaining, "summary": "$(json_escape "$copilot_summary")"}
}
EOF
