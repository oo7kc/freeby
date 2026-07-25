#!/usr/bin/env bash
# ai-usage.sh — aggregates local AI coding tool usage into one JSON blob
# for the "AI Usage" GNOME Shell extension.
#
# Run it standalone to test/debug:
#   bash ~/.local/bin/ai-usage.sh | python3 -m json.tool
#
# Status per provider:
#
#   codex     - reads ~/.codex/auth.json via the `codex-check` npm tool.
#   cursor    - reads ~/.config/cursor/auth.json, hits api2.cursor.sh.
#   copilot   - reads token from ~/.config/freeby/copilot-token or gh CLI,
#               hits api.github.com/copilot_internal/user.
#
# opencode was dropped: `opencode stats` only reports lifetime usage
# (sessions/cost/tokens), never a remaining-quota or reset value, so it
# had nothing actionable to show here.
#
# Each provider block outputs: {"available": bool, "summary": "short string"}
# "available": false just means "no reader wired up yet", not "not installed".

set -uo pipefail

json_escape() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//\"/\\\"}"
    s="${s//$'\n'/ }"
    s="${s//$'\t'/ }"
    s="${s//$'\r'/ }"
    # Final safety net: drop any raw control characters that slipped through
    # (e.g. ANSI codes not caught by strip_ansi below) so JSON never breaks.
    s="$(printf '%s' "$s" | tr -d '[:cntrl:]')"
    printf '%s' "$s"
}

# Removes ANSI color/style escape sequences (e.g. from tools that colorize
# output even when piped). Must run before any field-grep parsing, since
# a color code can otherwise land in the middle of a value.
strip_ansi() {
    printf '%s' "$1" | sed -E 's/\x1b\[[0-9;]*[a-zA-Z]//g'
}

# Fallback for any provider: strip box-drawing borders and blank lines,
# join what's left, cap length. Used when field-specific parsing below
# doesn't match (e.g. output format changed).
strip_box_lines() {
    printf '%s' "$1" \
        | tr -d '│╭╮╰╯─┌┐└┘┼├┤┬┴┏┓┗┛━┃' \
        | sed -E '/^[[:space:]]*$/d' \
        | tr '\n' ' ' \
        | sed -E 's/ +/ /g' \
        | cut -c1-140
}

# ---------------------------------------------------------------------------
# codex — parses codex-check's real field labels:
#   "Limit Reached: YES/NO", "5h limit: NN.N%", "5h resets: <date>"
# ---------------------------------------------------------------------------
codex_available=false
codex_summary="not detected"
if [ -f "$HOME/.codex/auth.json" ]; then
    codex_raw="$(npx --yes codex-check --auth "$HOME/.codex/auth.json" 2>/dev/null)"
    codex_raw="$(strip_ansi "$codex_raw")"
    if [ -n "$codex_raw" ]; then
        limit_reached="$(printf '%s' "$codex_raw" | grep -oP 'Limit Reached\s*:\s*\K\S+')"
        five_h_pct="$(printf '%s' "$codex_raw" | grep -oP '5h limit\s*:\s*\K[0-9.]+%')"
        five_h_resets="$(printf '%s' "$codex_raw" | grep -oP '5h resets\s*:\s*\K[^│]+' | xargs)"

        if [ "$limit_reached" = "YES" ]; then
            codex_summary="LIMIT REACHED — resets ${five_h_resets:-unknown}"
        elif [ -n "$five_h_pct" ]; then
            codex_summary="5h: ${five_h_pct} used, resets ${five_h_resets:-unknown}"
        else
            codex_summary="$(strip_box_lines "$codex_raw")"
        fi
        codex_available=true
    else
        codex_summary="auth.json found, codex-check produced no output"
    fi
fi

# ---------------------------------------------------------------------------
# cursor — reads ~/.config/cursor/auth.json, hits api2.cursor.sh
# ---------------------------------------------------------------------------
cursor_available=false
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
            cursor_summary="token expired — open Cursor to refresh"
            cursor_available=true
        elif [ "$cursor_http" = "200" ] && [ -n "$cursor_body" ]; then
            cursor_parsed="$(printf '%s' "$cursor_body" | python3 -c "
import json, sys
from datetime import datetime, timezone
try:
    d = json.load(sys.stdin)
    pu = d.get('planUsage', {})
    pct = pu.get('totalPercentUsed', 0)
    end_ms = int(d.get('billingCycleEnd', '0'))
    reset = datetime.fromtimestamp(end_ms/1000, tz=timezone.utc).strftime('%b %d')
    msg = d.get('displayMessage', '')
    if pct >= 100:
        print(f'LIMIT REACHED — resets {reset}')
    elif msg:
        print(f'{msg}, resets {reset}')
    else:
        print(f'{pct}% used, resets {reset}')
except Exception as e:
    print(f'parse error: {e}')
" 2>/dev/null)"
            if [ -n "$cursor_parsed" ]; then
                cursor_summary="$cursor_parsed"
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

# ---------------------------------------------------------------------------
# copilot — reads token from ~/.config/freeby/copilot-token or gh CLI
# ---------------------------------------------------------------------------
copilot_available=false
copilot_summary="not detected"
copilot_token=""

# Try gh CLI first
if command -v gh >/dev/null 2>&1; then
    copilot_token="$(gh auth token 2>/dev/null)"
fi

# Fallback to saved token file
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
        copilot_summary="auth expired — re-run copilot-setup"
        copilot_available=true
    elif [ "$copilot_http" = "200" ] && [ -n "$copilot_body" ]; then
        copilot_parsed="$(printf '%s' "$copilot_body" | python3 -c "
import json, sys
from datetime import datetime, timezone
try:
    d = json.load(sys.stdin)
    quota = d.get('quota_snapshots', {})
    premium = quota.get('premium_interactions', {})
    remaining = premium.get('remaining', '?')
    total = premium.get('total', '?')
    resets = premium.get('resets_at', '')
    if resets:
        reset_date = datetime.fromisoformat(resets.replace('Z', '+00:00')).strftime('%b %d')
    else:
        reset_date = 'unknown'
    if remaining == 0:
        print(f'LIMIT REACHED — resets {reset_date}')
    else:
        used = int(total) - int(remaining) if isinstance(total, int) and isinstance(remaining, int) else '?'
        print(f'{used}/{total} premium used, resets {reset_date}')
except Exception as e:
    print(f'parse error: {e}')
" 2>/dev/null)"
        if [ -n "$copilot_parsed" ]; then
            copilot_summary="$copilot_parsed"
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

# ---------------------------------------------------------------------------
cat <<EOF
{
  "codex":    {"available": $codex_available,    "summary": "$(json_escape "$codex_summary")"},
  "cursor":   {"available": $cursor_available,    "summary": "$(json_escape "$cursor_summary")"},
  "copilot":  {"available": $copilot_available,   "summary": "$(json_escape "$copilot_summary")"}
}
EOF
