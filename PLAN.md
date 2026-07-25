# Implementation Plan: Freeby GNOME Extension

## Problem

The extension doesn't appear in GNOME Extensions Manager. Two root causes:

1. Files were never copied to `~/.local/share/gnome-shell/extensions/freeby@kelvin.local/`
2. `metadata.json` lists shell versions `["45","46","47","48"]` but system runs GNOME Shell 50.1 — Shell refuses to load extensions that don't claim compatibility

Additionally, Cursor and Copilot providers are stubbed out.

## Phases

### Phase 1: Fix installation and version compatibility

- `metadata.json` — add `"50"` to `shell-version`, remove "OpenCode" from description
- `meson.build` (new) — builds and installs to the correct user-local paths
- `.gitignore` (new)

### Phase 2: Meson build system

Single `meson.build` at project root. No submodules, no abstraction.

- `meson install` copies `extension.js`, `metadata.json`, `stylesheet.css` → `~/.local/share/gnome-shell/extensions/freeby@kelvin.local/`
- Copies `scripts/freeby.sh` → `~/.local/bin/freeby.sh`
- `meson setup build --prefix=$HOME/.local && meson install -C build` workflow

### Phase 3: Cursor provider (real implementation)

**API:** `POST https://api2.cursor.sh/aiserver.v1.DashboardService/GetCurrentPeriodUsage`

Auth token in `~/.config/cursor/auth.json` (`accessToken` + `refreshToken`).

Response:
```json
{
  "planUsage": {
    "remaining": 2000,
    "limit": 2000,
    "totalPercentUsed": 0
  },
  "billingCycleEnd": "1785206703000",
  "displayMessage": "You've used 0% of your included usage"
}
```

Implementation in `ai-usage.sh`:
- Read `accessToken` from `~/.config/cursor/auth.json` via `python3 -c`
- `curl -s` the API with Bearer auth
- Parse response with `python3 -c` (no jq)
- On 401: show "token expired — reopen Cursor to refresh"
- Summary: `"85% used, 300 remaining, resets Jan 15"` or `"LIMIT REACHED"`

Caveats:
- Access token is short-lived; Cursor refreshes it on login. If expired, user must open Cursor once.
- API is unofficial but stable — used by the Cursor client itself.
- No refresh logic in the shell script (keeps it simple).

### Phase 4: Copilot provider (real implementation)

**API:** `GET https://api.github.com/copilot_internal/user`

Returns `quota_snapshots.premium_interactions` with remaining/limit/reset.

**Auth:** `~/.config/github-copilot/auth.db` stores encrypted OAuth tokens. Can't read directly.

Two fallback approaches:
1. Try `gh auth token` if `gh` CLI is installed
2. Read from `~/.config/freeby/copilot-token` (plain JSON, user creates once)

Implementation in `ai-usage.sh`:
- Try `gh auth token` first (if available)
- Fallback to `~/.config/freeby/copilot-token`
- `curl -s` the API with Bearer auth
- Parse `quota_snapshots.premium_interactions` with `python3 -c`
- Summary: `"45/1000 premium used, resets Jul 30"` or `"LIMIT REACHED"`

New file: `scripts/copilot-setup.sh` — one-time device flow auth helper that saves token.

### Phase 5: Update README and commit

- Update provider status table (all three working)
- Document `meson setup build && meson install -C build` workflow
- Document Copilot setup (`scripts/copilot-setup.sh`)
- Git init, first commit

## Rules of engagement

| Rule | Detail |
|------|--------|
| No abstraction | Each provider is a flat section in `ai-usage.sh`. No functions that take callbacks, no provider registry, no config files with dynamic loading. |
| Simple logic | `if/elif/else` per provider. JSON output via heredoc. No complex data structures. |
| Separation of concern | `extension.js` = GNOME UI only. `ai-usage.sh` = data fetching/parsing only. No GNOME API calls in bash, no HTTP calls in JS. |
| Commit messages | Conventional commits: `fix:`, `feat:`, `chore:`. One logical change per commit. No "WIP" or "stuff". |
| Version control | `git init` on first commit. `.gitignore` from the start. |
| Dependencies | Only `bash`, `curl`, `python3` (for JSON parsing). No `jq`, no Node.js beyond what codex-check already needs. |
| Error handling | Every provider section is self-contained. If one fails, the others still run. The extension always shows something. |

## File changes

| File | Action | Phase |
|------|--------|-------|
| `metadata.json` | Edit: add shell-version "50", fix description | 1 |
| `.gitignore` | New: build/, *.swp, etc. | 1 |
| `meson.build` | New: install extension + script | 2 |
| `scripts/freeby.sh` | Edit: implement cursor + copilot sections | 3, 4 |
| `scripts/copilot-setup.sh` | New: one-time Copilot auth helper | 4 |
| `extension.js` | No changes needed | — |
| `stylesheet.css` | No changes needed | — |
| `README.md` | Edit: update all sections | 5 |
| `PLAN.md` | This file | — |

## System info

- GNOME Shell: 50.1
- GJS: 1.88.0
- Cursor: 3.13.10 (installed at `/usr/bin/cursor`)
- Cursor auth: `~/.config/cursor/auth.json` (accessToken + refreshToken)
- Copilot auth: `~/.config/github-copilot/auth.db` (encrypted, unreadable)
- No `gh` CLI installed
