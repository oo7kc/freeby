# Architecture

Freeby is a GNOME Shell extension with a small trusted UI process and short-lived
collector subprocesses. Provider code never creates GNOME actors, and UI code
never reads provider credentials or transcript formats.

## Runtime flow

1. `extension.js` creates the indicator and `UsageService`.
2. `UsageService` loads cached provider records, schedules independent refreshes,
   and starts one bounded GJS collector per enabled provider.
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
- `src/ui/` owns Shell actors and accessibility behavior.
- `prefs.js` is the libadwaita preferences entry point until configuration pages
  are split during alpha.5.

Collectors have deadlines and cancellation. Refresh jobs do not overlap, resume
events refresh only after wake, and results are ignored after extension disable.

## Privacy and storage

Freeby stores derived records in `$XDG_STATE_HOME/freeby` and incremental scan
caches in `$XDG_CACHE_HOME/freeby`. Credentials are read only when needed and are
never written by Freeby. Prompt/response content is ignored, while session and
account identifiers used for deduplication are hashed before persistence.

Account quota and local token activity remain separate scopes. Local activity is
not billing data and never becomes a fabricated subscription percentage.

## Distribution

Meson installs only extension entry points, source modules, metadata, styles,
license, and an extension-local schema. `tools/package.py` uses the same explicit
runtime allowlist to produce deterministic ZIP files; agent material, docs, tests,
tools, screenshots, and references cannot enter a release archive.
