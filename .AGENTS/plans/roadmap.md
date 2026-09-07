# UsageBeam usage monitor roadmap

Updated: 2026-09-07. Status: the UsageBeam identity and active-provider
interface refinements are complete on `dev`; Cursor remains the next alpha.3
provider milestone.

## Agreed direction

Build a reliable native GNOME usage monitor for **Codex, Claude Code, Cursor,
and Copilot**, covering free and paid plans. The first stable release is about
usage: quota windows, reset times, activity history, and model breakdowns where
the provider exposes them.

The canonical product name is **UsageBeam**, with extension UUID
`usagebeam@oo7kc.github.io` and schema `org.gnome.shell.extensions.usagebeam`.
Keep those identities stable from alpha.3 onward. Icon work, cost breakdowns,
provider spending/balances, estimates, and budgets are deferred to a later phase.
Subscription percentages must not be derived from token totals.

Every completed implementation milestone ends with a conventional commit, a
version tag, and an installable GitHub prerelease. The first stable release must
cover all four providers; earlier prereleases introduce them incrementally.

## Reference analysis and interface

The [Claude reference](../references/claude-usage.jpeg) and
[Codex reference](../references/codex-usage.png) share this structure:

1. Provider mark, name, and reported plan.
2. A selector for connected/enabled providers; omit the selector when only one exists.
3. Independently labeled quota windows with percent-used meters and reset countdowns.
4. A seven-column daily token chart, with today emphasized.
5. Model totals shown as horizontal bars.

Adapt that hierarchy to GNOME using native St/Clutter widgets, theme-aware colors,
aligned/tabular numerals, restrained separators, visible focus, and accessible
labels. Add a footer with last-successful-update time, refresh, and preferences.
Keep activity collapsed by default; when opened, expand the popup naturally
without a nested scrolling region.

- Quota bars use a fixed 0–100% scale. Activity bars scale against the largest value in the displayed period.
- Daily and model breakdowns must clearly state their period and whether the source is local or account-wide.
- Show data-supported sections only; keep connection errors and recovery guidance visible.
- Distinguish zero activity from unavailable history. Never fabricate models, plans, usage, or historical coverage.
- Show cached data immediately while independently refreshing providers. Mark stale sections with their timestamps.
- Show a useful setup state when no provider is connected. Do not silently hide the extension after a failure.

## Architecture

Keep a thin native GNOME extension with modular GJS collection and a versioned
usage contract. Provider code must not manipulate UI actors. UI code must not
parse provider transcripts or depend on provider endpoint response shapes.
Expensive history work belongs in a managed GJS subprocess, not the Shell UI
process. Avoid a persistent background daemon in this first iteration.

```text
usagebeam/
├── .AGENTS/                    # Rules, roadmap, archive, design references
├── AGENTS.md                   # Tool-discovery entrypoint
├── extension.js                 # GNOME lifecycle entry
├── prefs.js                     # Preferences entry
├── metadata.json
├── stylesheet.css
├── src/
│   ├── core/                    # Contract, validation, aggregation, formatting
│   ├── providers/               # One adapter per provider
│   ├── services/                # Scheduling, cache, processes, notifications
│   ├── collector/               # Managed GJS collection entry
│   ├── ui/                      # Indicator, selector, meters, charts
├── schemas/
├── tests/
│   ├── unit/
│   └── integration/
├── tools/                       # Development and packaging commands
├── docs/                        # Architecture, provider docs, historical screenshots
├── meson.build
└── .github/workflows/
```

Keep this layout current as modules land. Add a directory only when it owns real
content, preserve existing behavior during moves, and do not retain superseded
runtime implementations.

### Usage contract

- Include a schema version, stable provider identity, optional account/plan identity, and explicit capabilities.
- Represent each quota window with its unit, reported usage/limit or percentage, duration, reset timestamp, and state.
- Represent activity with dated totals and model aggregates, including provider-specific input/output/cache semantics.
- Track source, account/local scope, measurement period, coverage, and last-successful-update timestamps.
- Track limits and history status independently so local history remains useful when an account endpoint fails.
- Distinguish ready, missing authentication, unsupported data, unavailable data, stale data, and exhausted quota.
- Leave unknown values absent/null; never coerce an empty response to zero or an unlimited allowance to exhaustion.

### Collection and storage

- Prefer documented provider interfaces and existing supported CLI authentication; verify versions and account eligibility.
- For Codex, evaluate app-server account/rate-limit reads and available account-usage reads; probe compatibility before using optional methods.
- Use local usage records for supported history/model data; retain explicit scope when account-wide activity is also available.
- Validate Claude, Cursor, and Copilot sources independently. Preserve their real units and advertise only verified capabilities.
- Replace automatic `npx` downloads and the hardcoded helper path with packaged, extension-relative resources.
- Give each provider a deadline, bounded retries/backoff, and independent success/failure handling.
- Parse changed records incrementally; handle repeated events, cumulative counters, partial writes, rotation, and timezone boundaries.
- Keep private usage metadata in XDG state/cache locations using atomic writes, bounded retention, and schema migrations.
- Do not retain credentials, prompts, responses, or complete transcripts in UsageBeam's history or diagnostics.

## Known regressions to address

The preceding repository analysis identified these issues; add focused regression
coverage during the foundation work:

- Notification construction uses the tray instance as a constructor namespace.
- The sleep signal condition refreshes before suspend rather than on resume.
- An in-flight refresh can apply data after the indicator is destroyed.
- Repeated refreshes can leave overlapping collection processes.
- Empty Codex/Cursor objects can display successful zero usage.
- Summary-text matching can show an exhausted Cursor quota as a green row.
- Initial/error states can trigger incorrect quota-limit notifications.
- The Codex `npx` path has no explicit collection deadline.
- The uninstall instructions remove the shared compiled schema file instead of recompiling remaining schemas.

## Implementation milestones

### 1. Foundation and Codex — v2.0.0-alpha.1

- [x] Establish the target module boundaries, versioned contract, development commands, and fixture-based tests.
- [x] Repair the known lifecycle, notification, quota-state, and install/uninstall regressions.
- [x] Implement bounded Codex collection, cached results, available quota windows, daily activity, and model totals.
- [x] Build the native provider header, quota meters, activity/model views, status footer, and loading/error/setup states.
- [x] Keep existing provider behavior working until deliberately migrated; document any verified data limitations.
- [x] Verify the complete Codex path, temporary installation, disable/re-enable cleanup, and offline/partial behavior.
- [x] Commit, tag, publish, and verify the installable alpha.1 prerelease.

Evidence: 13 deterministic unit tests, GJS incremental-history and process
integration checks, strict schema validation, deterministic packaging, an
isolated GNOME Shell 50 load/disable/re-enable smoke test, and a redacted live
Codex CLI check confirming account quota, seven-day activity, and model data.
Released from commit `ce64146` on `dev` as
[`v2.0.0-alpha.1`](https://github.com/oo7kc/freeby/releases/tag/v2.0.0-alpha.1).
The downloaded 22,488-byte archive matched the tagged CI artifact at SHA-256
`eef63b1978b13f2adda9fe3c172cebfe7584835461f1b07f2b8ffd8b887b56fb`.

### 2. Claude Code — v2.0.0-alpha.2

- [x] Implement Claude detection, supported authentication/limits, and incremental usage history.
- [x] Add provider switching and independent partial-data handling using the shared contract.
- [x] Verify quota windows, daily/model totals, duplicate handling, missing credentials, and expired authentication.
- [x] Commit, tag, publish, and verify the installable alpha.2 prerelease.

Evidence: Claude Code 2.1.218 detection and missing-auth collection were checked
locally. Synthetic quota, expired-auth, repeated-message, cache-token, and
private-cache fixtures pass. An authenticated Claude account was not available,
so the OAuth endpoint path is upstream- and fixture-validated rather than live.
Released from commit `48b28ac` on `dev` as
[`v2.0.0-alpha.2`](https://github.com/oo7kc/freeby/releases/tag/v2.0.0-alpha.2).
The downloaded 25,249-byte archive matched the tagged CI artifact at SHA-256
`04f8417dd0fd0cafdc636293134ce80bf1477a0e6b39342e9f3681bffbef6fae`.

### Repository organization checkpoint

- [x] Consolidate agent rules, active/historical plans, and visual references
  under `.AGENTS/` while retaining the root discovery entrypoint.
- [x] Remove obsolete v1 runtime/test files and split provider ownership cleanly.
- [x] Add architecture/documentation indexes and enforce the intended layout in
  development checks.
- [x] Verify and commit the organization checkpoint on `dev` before alpha.3.

Evidence: `npm run verify` passed 20 unit tests, the Codex/Claude GJS history
and subprocess integration suite, strict schema/layout/link validation, and a
deterministic alpha.3-dev package. The exact archive loaded, disabled, and
re-enabled without extension errors in an isolated GNOME Shell 50 session.

### Interface and local-runtime correction checkpoint

- [x] Match the supplied Omarchy hierarchy with a compact, theme-integrated
  panel, visible data status, equal provider tabs, and left-anchored graphics.
- [x] Keep limits and freshness in the default view, move daily/model activity
  behind an accessible disclosure, and let the complete activity view expand
  without a nested scrollbar.
- [x] Inherit the user's Shell font and accent, place the subtle accent on the
  popup perimeter, and consolidate actions into a compact footer.
- [x] Detect user-local and version-managed Codex installations from GNOME
  Shell's minimal environment and use the installation's matching Node runtime.
- [x] Exercise all primary popup widgets with synthetic records and reject GJS
  criticals in the isolated lifecycle smoke test.

Evidence: 20 unit tests and the GJS integration suite pass, including newest
version-manager selection and sibling-runtime launch coverage. A sanitized live
probe with Codex CLI 0.145.0, an fnm-only binary path, no `/usr/bin/node`, and a
GNOME-equivalent minimal `PATH` returned the signed-in Plus plan with three live
quota windows. The populated two-provider popup loaded, disabled, and re-enabled
without extension GJS criticals in a private GNOME Shell 50 session. A follow-up
compactness pass retained that lifecycle coverage, added deterministic activity
summary tests, and smoke-tested the exact packaged archive with the theme-derived
perimeter and collapsed details structure.

### Runtime and contract hardening checkpoint

- [x] Enforce schema sources, freshness, typed fields, collection bounds, and
  provider identity before records reach UI state or persistence.
- [x] Keep subprocess environments scoped, failures classified, responses
  bounded, and private cache permissions repaired on atomic writes.
- [x] Make incremental history resilient to counter resets, replacement,
  source removal, invalid cache data, and stable private session identities.
- [x] Enforce runtime import boundaries and an exact, repository-owned package
  allowlist in development tooling.
- [x] Verify deterministic packaging and the exact archive lifecycle before
  committing the checkpoint on `dev`.

Evidence: `npm run verify` passed 25 deterministic unit tests, strict schema,
layout, import-boundary, link, GJS history, process, HTTP-policy, and packaging
checks. Two builds produced the same 35,916-byte archive at SHA-256
`48a6a6ae7546db9634385388db5a8b1dcc5bcc81135e65e93376187c2ca30d18`.
That exact archive loaded, disabled, and re-enabled without extension errors in
an isolated GNOME Shell 50 session. A sanitized live check with Codex CLI
0.145.0 returned the Plus plan, three account quota windows, seven-day local
activity, and model totals under usage schema version 2.

### Product identity checkpoint

- [x] Rename the active product, runtime classes/styles, package, schema, archive,
  CI artifact, and documentation from Freeby to UsageBeam.
- [x] Adopt `usagebeam@oo7kc.github.io` and
  `org.gnome.shell.extensions.usagebeam` as the permanent extension identities.
- [x] Migrate recognized derived state, history caches, and explicitly changed
  preferences without copying credentials or overwriting new UsageBeam values.
- [x] Verify a clean install, former-alpha migration, deterministic packaging,
  and disable/re-enable lifecycle; commit the checkpoint on `dev` without moving
  or tagging `main`.

Evidence: `npm run check` passed 26 unit tests, strict schema/layout/identity
validation, and the GJS history, migration, command, process, and HTTP-policy
integration suite. A live local migration copied four recognized derived files
and two explicitly changed settings, retained private `0600` file modes, matched
the original data checksums, and preserved the 30-second refresh preference.
Two builds produced the same 38,098-byte archive at SHA-256
`d92595924b705125cebc6bd09dc9689f6562522a9cf9ffaba98db7d666f0926a`.
That exact UsageBeam archive loaded, disabled, and re-enabled without extension
errors in a private GNOME Shell 50 session. The former local extension package
was removed and the new UUID was installed and enabled for the next login; GNOME
Shell 50 cannot discover a brand-new UUID in an already-running Wayland session.

### Active-provider interface checkpoint

- [x] Replace the generic panel label with one compact active-provider readout:
  adaptive provider icon, short name, highest current quota, and reset countdown.
- [x] Put quota reset countdowns beside their percentages, rename the Codex
  reserve window to `Weekly reserve` for display, and remove redundant reset rows.
- [x] Render seven-day activity as an accessible, softly colored column chart
  while retaining explicit local/account scope and measurement dates.
- [x] Remove the popup's internal scrolling region so activity expands to its
  complete natural height, while remaining collapsed by default.
- [x] Add immediate left/right-of-calendar placement in native preferences and
  package the supplied Claude and adaptive Codex SVG marks.

Evidence: `npm run check` passed 28 deterministic unit tests, strict schema,
layout, identity, and GJS integration checks. Two builds produced the same
41,049-byte archive at SHA-256
`0622c2af111f7f1985e99340af32fb99c1dd4020bb9f2f03ccee774c1973e542`.
That exact archive loaded with populated Codex and Claude records, moved live
from the left to the right of the calendar, disabled, and re-enabled without
extension errors in a private GNOME Shell 50 session.

### Visual QA correction checkpoint

- [x] Correct the daily chart's zero-width bar allocation and keep every
  non-zero column visibly bottom-aligned against the period maximum.
- [x] Center the popup around its panel trigger and retain GNOME's work-area
  clamping at screen edges.
- [x] Give the activity disclosure a complete border and stable right-aligned
  metadata group; align quota percentages and resets in tabular columns.
- [x] Replace raw ISO ranges with concise locale-aware dates and refine the
  surface into light/dark accent-tinted slate variants with mixed system and
  system-monospace typography.

Evidence: `npm run check` passed 29 deterministic unit tests, including chart
geometry and date-presentation coverage, plus the strict schema/layout and GJS
integration suite.
Two builds produced the same 42,120-byte archive at SHA-256
`11a51d84ed710e30cfc633fb6d6c7b5f8c6a7479c8e40dca95350e0f9d1526bc`.
The exact archive loaded, changed calendar side live, disabled, and re-enabled
without extension or stylesheet errors in a private GNOME Shell 50 session.

### 3. Cursor — v2.0.0-alpha.3

- [ ] Revalidate current Cursor authentication and usage sources for free and paid accounts.
- [ ] Handle paid allowance, remaining bonus, absent subscription, and unsupported metrics without fabricated percentages.
- [ ] Add all verified usage capabilities to the shared interface and document integration limits.
- [ ] Verify fixtures for empty responses, expired authentication, inaccessible endpoints, and quota exhaustion.
- [ ] Commit, tag, publish, and verify the installable alpha.3 prerelease.

### 4. Copilot — v2.0.0-alpha.4

- [ ] Revalidate current Copilot authentication, entitlement data, and usage units for supported account types.
- [ ] Implement usage collection and available history/model metrics without assuming every account exposes them.
- [ ] Keep request counts, tokens, allowances, and unknown/unlimited states distinct.
- [ ] Verify all four providers together, including partial outages and missing integrations.
- [ ] Commit, tag, publish, and verify the installable alpha.4 prerelease.

### 5. Preferences and interface polish — v2.0.0-alpha.5

- [ ] Expand the existing preferences entry into organized native libadwaita pages.
- [x] Add immediate left/right-of-calendar panel placement for the compact active-provider readout.
- [ ] Add provider enablement/order, default provider, refresh controls, and connection diagnostics.
- [ ] Add notification thresholds, deduplication per account/window, and history retention/clear controls.
- [ ] Preserve valid existing settings and document new defaults and migrations.
- [ ] Verify keyboard navigation, screen-reader labels, dark/light themes, long content, natural popup expansion, and display scaling.
- [ ] Commit, tag, publish, and verify the installable alpha.5 prerelease using the finalized name and existing icon.

### 6. Stabilization — v2.0.0-beta.1, then v2.0.0

- [ ] Validate supported GNOME versions; keep metadata aligned with tested compatibility.
- [ ] Verify history accuracy, bounded collection, responsiveness, and all four provider capability declarations.
- [ ] Test clean install, upgrade, disable/re-enable, uninstall, and downgrade with an isolated installation prefix.
- [ ] Finalize README, setup/troubleshooting, architecture/provider docs, screenshots, and release instructions.
- [ ] Commit, tag, publish, and verify beta.1; issue further beta prereleases when feedback requires changes.
- [ ] Resolve release-blocking feedback and publish the first stable usage-monitoring release.

## Verification and release gate

Every milestone requires applicable lint/syntax checks, deterministic unit and
integration tests, strict schema validation, and a packaged-install smoke test.
GUI/lifecycle changes also require relevant GNOME desktop checks. Live provider
verification is separate from credential-free CI and must identify which account
types and client versions were actually tested.

1. Confirm the intended repository and release branch; preserve unrelated worktree changes.
2. Update this plan, the changelog, and the project release version. Do not use the deprecated metadata `version` field as the release source of truth.
3. Complete the milestone checks and record results, remaining limitations, and any unavailable checks.
4. Commit only the intended, tested milestone changes using conventional commits.
5. Tag the commit and build the downloadable extension archive from that exact revision. Exclude tests, development tools, references, and credentials from the runtime archive.
6. Publish the GitHub release as a prerelease for alpha/beta tags, with installation/upgrade instructions, verification evidence, known limitations, and a downgrade path.
7. Verify the remote tag, release status, downloadable artifact, and archive contents; record the tag/commit/release link here.

Do not mark a milestone complete until its code, checks, commit, and prerelease
are complete. A blocked required check or publication remains explicitly open.
Documentation setup is preparatory work and does not trigger a product prerelease.

## After usage monitoring is reliable

- Design a distinctive UsageBeam icon without changing the finalized extension identity.
- Design cost breakdowns separately, distinguishing provider-reported charges from estimates and including currency, period, and pricing provenance.
- Consider budgets, additional providers, multiple accounts, cross-device history, and a separate dashboard only as later scoped work.

## References and historical context

- [Omarchy Agents architecture and panel behavior](https://github.com/omacom/omarchy/blob/quattro/shell/plugins/agents/README.md)
- [Codex app-server documentation](https://learn.chatgpt.com/docs/app-server)
- [GNOME extension review guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html)
- [Archived v1 planning notes](archive/v1-notes.md), including a Cursor no-subscription investigation that requires revalidation.

Sources describe the state inspected during planning; verify them again before
depending on a provider interface or publishing compatibility claims. If upstream
code or assets are reused, preserve the applicable license and attribution.
