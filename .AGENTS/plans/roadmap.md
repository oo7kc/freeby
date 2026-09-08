# UsageBeam product roadmap

## Product contract

UsageBeam is a native GNOME Shell monitor for AI coding usage. It reports only
provider-backed account limits and derived local activity, keeps those scopes
visibly separate, and remains useful when one source is temporarily unavailable.

The stable product identity is:

- Name: UsageBeam
- Extension UUID: `usagebeam@oo7kc.github.io`
- Settings schema: `org.gnome.shell.extensions.usagebeam`
- Repository owner: `oo7kc`

Cost, billing, budgets, and a new icon remain outside the usage-monitoring
release. A provider adapter does not ship until its authentication, units,
unsupported states, and failure behavior have been validated.

## Current product surface

- [x] Codex account limits through its installed CLI app-server.
- [x] Codex seven-day local token and model activity.
- [x] Claude Code supported account limits through its saved OAuth sign-in.
- [x] Claude Code seven-day local token and model activity.
- [x] Independent live, local, cached, syncing, and setup states.
- [x] Compact active-provider indicator and naturally expanding detail view.
- [x] Fixed left/right areas plus exact left/right calendar placement.
- [x] Theme-derived light/dark surfaces, accessible controls, and quota severity.
- [x] Private, bounded, cancellable collection with strict record validation.
- [x] Deterministic packaging and isolated GNOME lifecycle coverage.

Released foundations:

- [`v2.0.0-alpha.1`](https://github.com/oo7kc/freeby/releases/tag/v2.0.0-alpha.1):
  Codex and the provider-neutral platform.
- [`v2.0.0-alpha.2`](https://github.com/oo7kc/freeby/releases/tag/v2.0.0-alpha.2):
  Claude Code and provider switching.

## Milestone 3 — Cursor

- [ ] Revalidate authentication and usage sources on current free and paid
  accounts.
- [ ] Preserve reported units and distinguish paid allowance, bonus usage,
  missing subscription, unknown values, and exhaustion.
- [ ] Add only verified capabilities to the shared contract and interface.
- [ ] Cover empty payloads, expired authentication, unavailable endpoints,
  changed upstream shapes, and quota exhaustion.
- [ ] Complete the release gate and publish `v2.0.0-alpha.3`.

## Milestone 4 — GitHub Copilot

- [ ] Revalidate authentication, entitlement data, and usage units for supported
  account types.
- [ ] Keep request counts, tokens, allowances, unknown values, and unlimited
  states distinct.
- [ ] Implement only verified limit and activity capabilities.
- [ ] Verify all supported providers together under partial outages and missing
  integrations.
- [ ] Complete the release gate and publish `v2.0.0-alpha.4`.

## Milestone 5 — Preferences and diagnostics

- [ ] Add provider enablement, order, and default-provider controls.
- [ ] Add connection diagnostics and actionable recovery guidance.
- [ ] Add notification threshold, history retention, and clear-data controls.
- [ ] Preserve existing settings through schema changes and document defaults.
- [ ] Complete keyboard, screen-reader, scaling, long-content, and theme QA.
- [ ] Complete the release gate and publish `v2.0.0-alpha.5`.

## Stabilization

- [ ] Validate every advertised GNOME Shell version.
- [ ] Verify activity accuracy, bounded collection, responsiveness, migration,
  clean install, upgrade, disable/re-enable, uninstall, and downgrade.
- [ ] Complete provider compatibility notes and product screenshots.
- [ ] Publish and verify `v2.0.0-beta.1`; resolve release-blocking feedback.
- [ ] Publish the first stable usage-monitoring release.

### Portability stress checkpoint — 2026-09-08

The initial `6e6cef4` diagnostic reproduced six release blockers. Hardened
candidate `27934c0` was then verified on GNOME Shell 50.1 using archive SHA-256
`edef685e21b69c34c816df0325397435a95e015147222214d190a6e6348e1958`
(46,530 bytes).

- Standard checks: 35 unit tests and the GJS collector integration suite passed.
- Six private desktops exercised 1024×600 through 1920×1080 logical sizes,
  1×/2× monitor scale, 100%/125%/150% text, SF Pro and verified Noto Sans fallback.
  All 396 UI assertions passed against the exact archive.
- All 600 refresh/provider-switch/expand cycles and 60 verified disable/re-enable
  cycles completed without an extension JavaScript error or Shell crash.
- Fifteen synthetic stress cases passed, including 50,000-event history, cache
  rewrites, partial and oversized records, 10,000 notification observations,
  concurrent subprocess/RPC work, bounded output, Unicode boundaries, and
  in-flight cancellation.

Resolved blockers:

- [x] Constrained popup layouts paginate limits and activity before exceeding
  the work area; every one of 32 quota windows and 12 model rows remains keyboard
  reachable without nested scrolling.
- [x] Calendar-gap balancing tracks visible center-panel neighbors, additions,
  removals, visibility, and width changes on both calendar sides.
- [x] History cache version 5 verifies complete committed prefixes, rebuilding
  same-length and growing in-place rewrites instead of retaining stale totals.
- [x] Oversized complete and incomplete history lines are skipped safely while
  later valid records remain available and totals remain explicitly partial.
- [x] Notification milestone state uses bounded LRU eviction and remains at or
  below 200 entries across many windows and reset periods.
- [x] Subprocess and RPC limits are enforced during bounded asynchronous reads;
  queued writes, pending calls, cancellation, and child reaping are also bounded.

Reproduce with `npm run test:stress` and
`python3 tools/smoke-shell.py --archive dist/usagebeam@oo7kc.github.io-2.0.0-alpha.3-dev.0.zip --matrix`.
The optional suites do not replace `npm run check`. Test output belongs in
temporary directories, not the release archive. Real GPU drivers, mixed-monitor
hotplug, fractional scaling, non-English/RTL desktops and live provider failures
remain unverified. GNOME versions other than the advertised 50 are not covered.

## Release gate

Every milestone must satisfy all applicable gates before its checkbox is closed:

1. Strict syntax, import-boundary, schema, repository-layout, unit, and GJS
   integration checks.
2. Deterministic packaging from the exact candidate revision.
3. Installation and disable/re-enable testing of that exact archive in an
   isolated GNOME Shell session.
4. Live provider verification that records the tested client version and account
   scope; unavailable live access remains an explicit limitation.
5. A conventional commit, green remote CI, annotated prerelease tag, downloadable
   archive, checksum, upgrade notes, and downgrade path.

Synthetic tests must remain network-free and contain no credentials, prompts,
responses, raw transcripts, account identities, or raw session identifiers.

## After usage monitoring

- Create a distinctive product icon without changing the established UUID.
- Design cost breakdowns separately, distinguishing provider-reported charges
  from estimates and retaining currency, period, and pricing provenance.
- Scope budgets, multiple accounts, cross-device history, and a larger dashboard
  only after the usage-monitoring release is reliable.
