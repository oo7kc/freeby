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
