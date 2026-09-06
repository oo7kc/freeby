# Changelog

All notable changes are documented here. Freeby uses semantic prerelease versions
while version 2 is developed on the `dev` branch.

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
