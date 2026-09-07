---
description: Product scope and architecture invariants for UsageBeam
alwaysApply: true
---

# Product and architecture

- Build a reliable native GNOME usage monitor for Codex, Claude Code, Cursor,
  and Copilot across free and paid plans.
- Keep the finalized UsageBeam identity stable. Finish usage monitoring before
  cost, billing, budgets, or icon work.
- Keep GNOME entry points thin. Separate provider adapters, usage contracts,
  services, UI actors, and preferences.
- Prefer GJS, Gio/GLib, Soup, and native GNOME APIs. Never download runtime
  dependencies or invoke unpinned package runners.
- Keep expensive history scans in bounded, cancellable collector subprocesses.
  Prevent overlapping jobs and ignore results after disable.
- Keep account-wide limits separate from local activity. Never derive quota or
  subscription percentages from token totals.
- Store metrics, units, periods, source scope, capabilities, and freshness as
  typed fields. Do not infer state from display strings.
- Treat unknown, unsupported, stale, unauthenticated, unlimited, and exhausted
  as distinct states. Empty data is not zero usage.
- Preserve provider-specific token/cache semantics, deduplicate repeated events,
  and handle cumulative counters, partial writes, rotation, and local dates.
- Adapt `.AGENTS/references/` to GNOME themes, keyboard access, screen readers,
  work-area limits, and display scaling; do not copy another panel literally.
