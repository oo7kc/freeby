# Changelog

All notable changes are documented here. UsageBeam uses semantic prerelease versions
while version 2 is developed on the `dev` branch.

## Unreleased

### Changed

- Renamed the product from Freeby to UsageBeam and adopted the permanent GNOME
  extension UUID `usagebeam@oo7kc.github.io` and settings schema
  `org.gnome.shell.extensions.usagebeam` ahead of alpha.3.
- Migrate recognized derived state, incremental history caches, and explicitly
  changed preferences from the former alpha identity without moving credentials
  or overwriting values already set for UsageBeam.
- Split command discovery from private file storage and launch discovered CLIs
  with a process-local environment, explicit deadlines, cancellation reasons,
  and output limits.
- Upgraded the provider-neutral usage record to schema version 2 with strict
  source, freshness, quota, date, token-component, and collection-bound checks.
- Decomposed panel rendering into focused limit, daily activity, model activity,
  status, and footer paths backed by unit-testable presentation decisions.
- Hardened deterministic packaging to reject symlinked or out-of-tree inputs and
  verify the archive against its exact runtime allowlist.
- Reworked the popup into a compact, theme-integrated usage panel based on the
  supplied Omarchy references, with equal-width `Claude`/`Codex` tabs, visible
  provider status, and filled model-usage rows.
- Inherit the user's Shell font and accent color, with a restrained accent on
  the popup's actual perimeter instead of a nested hard-coded blue frame.
- Keep limits and freshness visible in the default view while placing seven-day
  and model activity behind an accessible disclosure control; the complete view
  now expands naturally without a nested scrollbar.
- Consolidate freshness, refresh, and settings into a single compact footer.
- Replace the generic panel label with a single active-provider readout showing
  its supplied icon, short name, highest current quota, and reset countdown.
- Place quota reset countdowns inline, display Codex reserve usage as `Weekly
  reserve`, and render daily token history as a softly colored seven-column chart.
- Add native preferences for immediate placement directly left or right of the
  Shell calendar.
- Refine the interface into an accent-tinted slate surface with an explicit
  perimeter, mixed system/monospace typography, stronger hierarchy, and a
  bordered activity disclosure in both light and dark Shell color schemes.
- Consolidated agent rules, the active roadmap, archived planning notes, and
  visual implementation references under `.AGENTS/`, with a minimal root
  `AGENTS.md` discovery entrypoint.
- Added documentation indexes and a runtime architecture guide; historical v1
  screenshots now live under `docs/assets/screenshots/v1/`.
- Split the temporary combined provider module into dedicated Cursor and Copilot
  adapters without changing their preview behavior.

### Fixed

- Keep one stable private session identity across incremental history scans,
  preventing resumed Codex records from inflating session counts.
- Detect cumulative-token resets, same-size history replacements, stale source
  removal, invalid cached events, and bounded directory-scan failures without
  silently presenting incorrect totals.
- Require HTTPS for provider requests, bound response sizes, and repair private
  cache directory/file permissions on every atomic write.
- Distinguish live account data, local-only activity, cached data, active sync,
  and setup states while safely truncating long provider/model labels.
- Discover Codex installed through fnm, nvm, mise, asdf, Volta, and common
  user-local binary directories even when GNOME Shell starts with a minimal
  `PATH`.
- Launch version-managed Codex installations with their matching sibling Node
  runtime, restoring live account quota reads on systems without `/usr/bin/node`.
- Anchor daily and model fills to the left edge and render human-readable model
  names instead of centered or malformed bars.
- Preserve the user's Shell typeface while strengthening text contrast and
  hierarchy for cleaner rendering.
- Allocate daily chart bars explicitly so non-zero days always receive visible
  width and bottom-aligned height.
- Center the popup on the active-provider panel indicator instead of anchoring
  its left edge to the trigger.
- Align limit percentages, separators, and reset countdowns in fixed tabular
  columns, and format activity periods as concise locale-aware date ranges.

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
