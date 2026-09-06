# Freeby v1 planning archive

Preserved from the original local `plan.md` on 2026-09-06. These are historical
investigation notes, not verified descriptions of the current implementation.
Some claims about disabled providers, completed fixes, quota periods, and
packaging differ from the current code. Revalidate any provider-specific
assumptions before using them. The active roadmap is [../roadmap.md](../roadmap.md).

---

# Freeby Plan

## Current state

- **v1.0.2** released and merged to main
- 2 providers: Codex, Copilot (Cursor disabled — see below)
- Panel shows `ai·N` (count of providers with remaining quota)
- Panel text colored green/yellow/red by availability
- Click panel to refresh
- Dropdown shows per-provider usage and reset countdown
- Desktop notifications on limit hit
- Auto-refresh on wake from sleep
- Configurable refresh interval (gsettings)
- Settings UI in Extension Manager
- Parallel provider fetches (~2s)
- Architecture: extension.js (entry) + indicator.js (UI) + prefs.js (settings)
- CI/CD: GitHub Actions (shellcheck, meson build, bats tests)
- Accessibility: screen reader names, theme-aware CSS

## Known limitations

- Codex: uses `codex-check` CLI (npx), can be slow on first run
- Codex: limit is monthly (30 days), not 5h as formatted output suggests
- Codex: uses JSON output (`--json` flag) for reliable parsing
- Copilot: free tier is very limited (200 chat credits/month)
- No persistent storage — usage history not tracked

## Cursor investigation (disabled in v1.0.2)

### Problem
The Cursor API (`GetCurrentPeriodUsage`) only tracks paid plan usage. When `overallLimit == 0` and `remainingBonus == false`, it means:
- No paid subscription (`overallLimit: 0`)
- Free bonus tokens exhausted (`remainingBonus: false`)

The API returns `totalPercentUsed: 0` which is "0% of nothing" — misleading.

### API response when no subscription
```json
{
  "planUsage": { "totalPercentUsed": 0, "remainingBonus": false },
  "spendLimitUsage": { "overallLimit": 0, "pooledLimit": 0 },
  "displayMessage": "You've used 0% of your included usage"
}
```

### Why Cursor CLI shows "get a subscription"
It correctly detects: no paid plan + exhausted free bonus = needs subscription.

### What the user experienced
- Used free bonus tokens recently (worked fine)
- Now bonus is exhausted, Cursor CLI says "get subscription"
- Extension was showing "0% used, resets in 3d" — misleading

### Decision
Disable Cursor for now. Re-enable in v2.0.0 with paid subscription detection:
- `overallLimit > 0` → show usage percentage
- `overallLimit == 0 && remainingBonus == false` → "no subscription"
- `overallLimit == 0 && remainingBonus == true` → "free tier, bonus remaining"

## Things to watch out for

### API changes
- Cursor API is unofficial — could break without notice
- GitHub Copilot API could change endpoints or auth
- Codex API format might change in new `codex-check` versions (but JSON output is more stable)

### Auth expiry
- Copilot tokens via `gh` stay valid as long as `gh auth` is active
- Copilot tokens from `copilot-setup` may expire after ~30 days

### Rate limiting
- Script runs every 2 minutes — shouldn't hit rate limits
- But if user manually refreshes repeatedly, APIs might throttle

### GNOME Shell compatibility
- Currently targets GNOME 45+ (ESM imports)
- New Shell versions may deprecate APIs (already fixed GNOME 50 messageTray change)
- Test on new GNOME releases before claiming support

## Done

- [x] Tooltip on hover — removed (PanelMenu.Button consumes hover events)
- [x] Color panel text — green/yellow/red based on availability
- [x] Click to refresh — panel click triggers refresh
- [x] Notifications — desktop alert on limit hit
- [x] Auto-refresh on wake — monitors systemd PrepareForSleep
- [x] Configurable refresh interval — gsettings (min 30s)
- [x] Settings UI — prefs.js with Extension Manager gear icon
- [x] Parallel fetches — background processes, ~2s total
- [x] Accessibility — screen reader names for all UI elements
- [x] Theme-aware CSS — uses currentColor and opacity
- [x] CI/CD — GitHub Actions with shellcheck, meson build, bats tests
- [x] Documentation — README, CONTRIBUTING, CHANGELOG
- [x] GNOME 50 support — added to shell-version, fixed messageTray API
- [x] Disable Cursor — free tier unsupported, misleading data

## EGO submission (extensions.gnome.org)

### Blocking issues

1. **Scripts must be written in GJS** — Our `freeby.sh` uses bash + curl + python3. The guidelines say scripts "MUST be written in GJS, unless absolutely necessary." Options:
   - **A) Rewrite in GJS** — Use Soup.Session for HTTP, native JSON.parse(). Cleanest for review but significant rewrite (~200 lines GJS replacing ~190 lines bash/python). Still needs subprocess for `npx codex-check`.
   - **B) Keep bash, drop python3** — Replace python3 JSON parsing with grep/sed/awk. Removes one dependency but adds ~150 lines of fragile bash. Strengthens "scripts are necessary" argument.
   - **C) Keep as-is** — Argue bash is necessary because we call system tools (npx, curl). Risky, may be rejected.

2. **Unnecessary files** — EGO zip should only contain extension files. Currently ships tests/, .github/, CONTRIBUTING.md, CHANGELOG.md, meson.build, build-aux/.

### Non-blocking fixes needed

3. **Remove `version` from metadata.json** — Deprecated for EGO (they set it).

4. **Disconnect button-press-event handler** — `this.connect('button-press-event', ...)` in indicator.js not disconnected in destroy().

5. **Cancel subprocess in disable** — If disable called while refresh in-flight, async callback could fire after cleanup.

### Nice-to-have

6. ESLint for code style consistency
7. UI following GNOME HIG more closely

## Future features (v2.0.0+)

### Cursor paid subscription support
- Re-enable Cursor provider
- Detect paid subscription via `overallLimit > 0`
- Show usage percentage for paid users
- Show "no subscription" for free users with exhausted bonus
- Track `remainingBonus` for free tier status

### Larger features
- **Historical usage graph** — store daily snapshots and show a small sparkline in the dropdown
- **More providers** — Windsurf, Gemini, Groq, etc.
- **Flatpak support** — detect if tools are installed via Flatpak (different config paths)
- **Custom provider support** — user-added APIs via config

## Release checklist

- [ ] Update version in metadata.json
- [ ] Test all providers
- [ ] Verify countdown accuracy
- [ ] Check panel indicator updates
- [ ] Take screenshot for README
- [ ] Create GitHub release with tag
