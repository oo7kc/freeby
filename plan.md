# Freeby usage monitor roadmap

Updated: 2026-09-06. Status: foundation and Codex implementation complete;
alpha.1 release publication pending.

## Agreed direction

Build a reliable native GNOME usage monitor for **Codex, Claude Code, Cursor,
and Copilot**, covering free and paid plans. The first stable release is about
usage: quota windows, reset times, activity history, and model breakdowns where
the provider exposes them.

Complete and verify the system before introducing a new name or icon. Keep the
current extension UUID and GSettings schema identity throughout these milestones.
Cost breakdowns, provider spending/balances, estimates, and budgets are deferred
to a later phase. Subscription percentages must not be derived from token totals.

Every completed implementation milestone ends with a conventional commit, a
version tag, and an installable GitHub prerelease. The first stable release must
cover all four providers; earlier prereleases introduce them incrementally.

## Reference analysis and interface

The [Claude reference](reference-images/1.jpeg) and
[Codex reference](reference-images/2.png) share this structure:

1. Provider mark, name, and reported plan.
2. A selector for connected/enabled providers; omit the selector when only one exists.
3. Independently labeled quota windows with percent-used meters and reset countdowns.
4. Seven daily token totals, with today emphasized.
5. Model totals shown as horizontal bars.

Adapt that hierarchy to GNOME using native St/Clutter widgets, theme-aware colors,
aligned/tabular numerals, restrained separators, visible focus, and accessible
labels. Add a footer with last-successful-update time, refresh, and preferences.
Limit popup height to the monitor work area and scroll content when needed.

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
freeby/
├── AGENTS.md
├── plan.md
├── extension.js                 # GNOME lifecycle entry
├── prefs.js                     # Preferences entry
├── metadata.json
├── stylesheet.css
├── src/
│   ├── core/                    # Contract, validation, aggregation, formatting
│   ├── providers/               # Codex, Claude, Cursor, Copilot adapters
│   ├── services/                # Scheduling, cache, processes, notifications
│   ├── collector/               # Managed GJS collection entry
│   ├── ui/                      # Indicator, selector, meters, charts
│   └── preferences/             # Configuration pages
├── schemas/
├── assets/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── tools/                       # Development and packaging commands
├── docs/                        # Architecture, provider contracts, release guide
├── reference-images/            # Development references, excluded from archives
├── meson.build
└── .github/workflows/
```

This is a target layout, not a claim that these modules already exist. Move code
in reviewable steps and preserve existing behavior until its replacement is
verified. Keep transitional scripts only while needed; do not ship unused code.

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
- Do not retain credentials, prompts, responses, or complete transcripts in Freeby's history or diagnostics.

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
- [ ] Commit, tag, publish, and verify the installable alpha.1 prerelease.

Evidence: 13 deterministic unit tests, GJS incremental-history and process
integration checks, strict schema validation, deterministic packaging, an
isolated GNOME Shell 50 load/disable/re-enable smoke test, and a redacted live
Codex CLI check confirming account quota, seven-day activity, and model data.

### 2. Claude Code — v2.0.0-alpha.2

- [ ] Implement Claude detection, supported authentication/limits, and incremental usage history.
- [ ] Add provider switching and independent partial-data handling using the shared contract.
- [ ] Verify quota windows, daily/model totals, duplicate handling, missing credentials, and expired authentication.
- [ ] Commit, tag, publish, and verify the installable alpha.2 prerelease.

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
- [ ] Add left/center/right panel placement and ordering within the selected panel area, with immediate updates.
- [ ] Add provider enablement/order, default provider, refresh controls, and connection diagnostics.
- [ ] Add notification thresholds, deduplication per account/window, and history retention/clear controls.
- [ ] Preserve valid existing settings and document new defaults and migrations.
- [ ] Verify keyboard navigation, screen-reader labels, dark/light themes, long content, scrolling, and display scaling.
- [ ] Commit, tag, publish, and verify the installable alpha.5 prerelease using the existing name and icon.

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

- Decide the new name and icon direction, then plan branding and any required identity/settings migration.
- Design cost breakdowns separately, distinguishing provider-reported charges from estimates and including currency, period, and pricing provenance.
- Consider budgets, additional providers, multiple accounts, cross-device history, and a separate dashboard only as later scoped work.

## References and historical context

- [Omarchy Agents architecture and panel behavior](https://github.com/omacom/omarchy/blob/quattro/shell/plugins/agents/README.md)
- [Codex app-server documentation](https://learn.chatgpt.com/docs/app-server)
- [GNOME extension review guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html)
- [Archived v1 planning notes](docs/planning/v1-notes.md), including a Cursor no-subscription investigation that requires revalidation.

Sources describe the state inspected during planning; verify them again before
depending on a provider interface or publishing compatibility claims. If upstream
code or assets are reused, preserve the applicable license and attribution.
