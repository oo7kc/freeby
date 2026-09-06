# Changelog

All notable changes are documented here. Freeby uses semantic prerelease versions
while version 2 is developed on the `dev` branch.

## Unreleased

### Changed

- Reworked the popup into a compact, sharp-edged, monospaced usage panel based
  on the supplied Omarchy references, with equal-width `Claude`/`Codex` tabs,
  visible provider status, and filled model-usage rows.
- Reduced vertical density so the normal two-provider view fits the monitor;
  scrolling remains an automatic fallback for smaller displays or extra data.
- Consolidated agent rules, the active roadmap, archived planning notes, and
  visual implementation references under `.AGENTS/`, with a minimal root
  `AGENTS.md` discovery entrypoint.
- Added documentation indexes and a runtime architecture guide; historical v1
  screenshots now live under `docs/assets/screenshots/v1/`.
- Split the temporary combined provider module into dedicated Cursor and Copilot
  adapters without changing their preview behavior.

### Fixed

- Discover Codex installed through fnm, nvm, mise, asdf, Volta, and common
  user-local binary directories even when GNOME Shell starts with a minimal
  `PATH`.
- Launch version-managed Codex installations with their matching sibling Node
  runtime, restoring live account quota reads on systems without `/usr/bin/node`.
- Anchor daily and model fills to the left edge and render human-readable model
  names instead of centered or malformed bars.
- Reset the popup to its top edge whenever it opens.

### Removed

- Removed the superseded v1 indicator, Bash collector/setup scripts, and their
  obsolete Bats suite. These files were no longer installed after alpha.1.

## 2.0.0-alpha.2 - 2026-09-06

### Added

- Claude Code detection and saved OAuth sign-in handling, including explicit
  missing, absent, and expired authentication states.
- Anthropic 5-hour, weekly, and model-scoped quota parsing with both current
  percentage and older fractional utilization normalization.
- Incremental Claude Code transcript scanning with message deduplication and
  per-model input, output, cache-read, and cache-write totals.
- Provider switching between Codex and Claude Code using the shared native UI.

### Changed

- New installations enable Codex and Claude Code by default.
- Expired cached quota windows are discarded instead of being displayed as stale
  after their reset time.

### Verification limits

- Claude Code 2.1.218 detection and the unauthenticated path were exercised on
  this machine. Quota responses, expired authentication, duplicates, and cache
  semantics were verified with synthetic fixtures against the current upstream
  interface; no signed-in Claude account was available for a live quota probe.

## 2.0.0-alpha.1 - 2026-09-06

### Added

- Versioned provider-neutral usage contract with explicit capabilities, source
  scope, freshness, quota states, reset timestamps, and token categories.
- Bounded Codex app-server collection for account rate limits.
- Incremental local Codex history scanning with seven-day and model aggregates.
- Private XDG state/cache persistence, stale-data recovery, and refresh backoff.
- Native provider header, quota meters, daily activity, model totals, status
  footer, setup/error states, and accessible controls.
- Deterministic archive packaging, unit tests, GJS integration tests, and an
  isolated headless GNOME lifecycle smoke test.

### Fixed

- Refresh now occurs after resume rather than before suspend.
- Provider jobs no longer overlap or update destroyed UI.
- Notifications require a verified threshold crossing and are deduplicated per
  account, quota window, and reset period.
- Missing or empty provider responses are no longer reported as zero usage.
- Runtime `npx` downloads and unbounded collection processes were removed.
- Schemas install inside the extension and uninstall no longer requires deleting
  a shared compiled schema file.

### Known limitations

- GNOME Shell 50 is the only compatibility target verified for alpha.1.
- Codex activity is local to this device. Account quota limits and local token
  history intentionally remain separate scopes.
- Cursor and Copilot adapters are preview-only until alpha.3 and alpha.4.
- Claude Code support is scheduled for alpha.2.

## 1.0.2 - 2026-04-27

- Added GNOME 49 and 50 metadata compatibility and removed deprecated extension
  version metadata.
- Kept the dropdown open after manual refresh and fixed an invalid popup
  accessibility property.

Earlier release history remains available in the repository's Git tags and
GitHub releases.
