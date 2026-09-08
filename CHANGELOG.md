# Changelog

All notable UsageBeam changes are documented here.

## Unreleased

### Added

- UsageBeam product identity with the permanent extension UUID
  `usagebeam@oo7kc.github.io` and settings schema
  `org.gnome.shell.extensions.usagebeam`.
- Active-provider panel readout with provider icon, highest current quota, and
  reset countdown.
- Left area, right area, left-of-calendar, and right-of-calendar placement.
- Expandable seven-day activity chart and compact per-model token totals.
- Native preferences for placement, refresh interval, and notifications.
- Explicit quota severity states: caution at 80%, warning at 90%, and exhausted
  at 100%.

### Changed

- Rebuilt the popup as a compact, accent-aware GNOME surface with SF Pro
  typography when available, aligned quota metrics, and stable panel geometry.
- Account limits, local activity, and cached results now expose their scope and
  freshness independently.
- Codex discovery supports common user-local and Node version-manager layouts.
- Provider records use a strict versioned contract with bounded collection,
  typed quota states, source attribution, and private derived storage.
- Recognized Freeby alpha settings and derived data migrate without copying
  credentials or overwriting existing UsageBeam data.

### Fixed

- Calendar-side readouts anchor toward the clock on both sides, keeping reserved
  width outside the visible gap when provider names and countdowns change.
- Each quota now shows its reset countdown below the bar as `Resets in …`, with
  its percentage right-aligned above the bar.
- Daily chart columns allocate visible bottom-aligned bars for non-zero activity.
- Model fills remain compact and stable across repeated layout passes.
- Calendar placement remains fixed while providers and quota values change.
- Reset values, percentages, and separator dots retain consistent alignment.
- The active-provider readout uses compact internal and calendar-side spacing,
  while retaining a fixed width across provider changes.
- Seven-day activity emphasizes its local/account scope without repeating a
  date range already represented by the chart.
- The activity disclosure now shows only its title and chevron; period, totals,
  and source remain in the expanded content where they are needed.
- Usage alerts now progress through configured, warning, and exhausted milestones
  once per quota period and combine simultaneous crossings into one notification.
- Quota labels use compact `5H Session` and `Weekly Reserve` names, while expanded
  activity keeps scope implicit and gives the chart more breathing room.
- Expired quota windows are not presented as current cached data.
- Empty, malformed, or unavailable provider responses are never shown as zero
  usage.

### Removed

- Unverified Cursor and Copilot preview adapters. Providers now ship only after
  their data sources and failure states have completed validation.
- Superseded runtime scripts and historical UI artifacts that were not part of
  the product.

## 2.0.0-alpha.2 - 2026-09-06

### Added

- Claude Code installation and saved OAuth sign-in detection.
- Supported 5-hour, weekly, and model-scoped Claude quota windows.
- Incremental Claude Code activity with per-model input, output, cache-read, and
  cache-write totals.
- Shared provider switching between Codex and Claude Code.

### Fixed

- Expired cached quota windows are discarded after their reset time.
- Missing, absent, and expired Claude authentication remain distinct states.

### Verification scope

- Claude Code 2.1.218 installation detection and missing-authentication behavior
  were exercised locally.
- Quota payloads, expired authentication, duplicate messages, and cache-token
  semantics were verified with deterministic fixtures.
- A signed-in Claude account was not available for a live quota probe.

## 2.0.0-alpha.1 - 2026-09-06

### Added

- Provider-neutral usage contract with explicit capabilities, source scope,
  freshness, quota state, reset timestamp, and token categories.
- Bounded Codex app-server collection for account rate limits.
- Incremental local Codex history with seven-day and model aggregates.
- Private XDG state/cache persistence, stale-data recovery, and refresh backoff.
- Deterministic packaging and isolated GNOME lifecycle verification.

### Fixed

- Refresh occurs after resume instead of before suspend.
- Provider jobs do not overlap or update a destroyed interface.
- Notifications require a verified threshold crossing and deduplicate per
  account, quota window, and reset period.
- Runtime package downloads and unbounded collection processes were removed.

## 1.0.2 - 2026-04-27

- Added GNOME 49 and 50 metadata compatibility and removed deprecated extension
  version metadata.
- Kept the dropdown open after manual refresh and fixed an invalid popup
  accessibility property.

Earlier history remains available in the repository's Git tags and releases.
