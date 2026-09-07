# Architecture

UsageBeam is a GNOME Shell extension with a small trusted UI process and short-lived
collector subprocesses. Provider code never creates GNOME actors, and UI code
never reads provider credentials or transcript formats.

## Runtime flow

1. `extension.js` creates the indicator and `UsageService`.
2. `UsageService` loads cached provider records, schedules independent refreshes,
   and starts one bounded GJS collector per enabled provider. Command discovery
   is isolated in `src/services/commands.js`, including user-local and supported
   version-manager paths that may be absent from GNOME Shell's environment.
3. `src/collector/main.js` supplies shared file, HTTP, authentication, and process
   capabilities to one adapter under `src/providers/`.
4. The adapter returns a versioned record from `src/core/usage.js` with limits and
   history represented as independent sections.
5. The service validates and merges the record, stores derived metadata, evaluates
   notification crossings, and asks the indicator to render typed data.

## Boundaries

- `src/core/` owns the provider-neutral contract, aggregation, formatting, and
  threshold state.
- `src/providers/` owns one adapter per external provider.
- `src/services/` owns scheduling, process lifetimes, HTTP, history scanning, and
  private XDG storage.
- `src/ui/` owns Shell actors and accessibility behavior; provider-status and
  period presentation decisions remain pure and unit-testable.
- `prefs.js` is the libadwaita preferences entry point until configuration pages
  are split during alpha.5.

Collectors have deadlines, bounded output, and cancellation. Child processes
receive a scoped `PATH` without changing the Shell process environment. Refresh
jobs do not overlap, resume events refresh only after wake, and results are
ignored after extension disable.

The provider-neutral record is currently schema version 2. A record claiming
current, partial, or cached data must include a source and successful-update
timestamp; ready limits must contain at least one typed quota window. Invalid or
oversized records are rejected before they reach the UI or persistent state.

## Privacy and storage

UsageBeam stores derived records in `$XDG_STATE_HOME/usagebeam` and versioned
incremental scan caches in `$XDG_CACHE_HOME/usagebeam`, with private directory
and file modes. Credentials are read only when needed and are never written by
UsageBeam. Prompt/response content is ignored, while session and account identifiers
used for deduplication are hashed once before persistence.

On the first start after the pre-alpha identity change, UsageBeam copies only
recognized provider records and incremental history caches from the former
directories when the corresponding destination is absent. Explicitly changed
preferences are imported from an installed former schema under the same
non-overwrite rule. Credentials and unrelated files are never migrated.

Account quota and local token activity remain separate scopes. Local activity is
not billing data and never becomes a fabricated subscription percentage.

## Distribution

Meson installs only extension entry points, source modules, metadata, styles,
license, and an extension-local schema. `tools/package.py` uses the same explicit
runtime allowlist to produce deterministic ZIP files. Inputs must be regular,
repository-owned files, and the completed archive is checked against the exact
allowlist; agent material, docs, tests, tools, screenshots, and references cannot
enter a release archive.
