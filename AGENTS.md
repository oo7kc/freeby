# Project guidance

Applies to the whole repository. Read [plan.md](plan.md) and [CONTRIBUTING.md](CONTRIBUTING.md) before implementation.

## Product priorities

- Build a reliable native GNOME usage monitor for Codex, Claude Code, Cursor, and Copilot, including free and paid plans.
- Complete usage monitoring before cost breakdowns, estimates, budgets, or billing features.
- Keep the Freeby name, icon, extension UUID, and settings schema identity during the usage milestones. Defer rebranding until the system works.
- Provide preferences for panel position, providers, refresh behavior, notifications, and history as scheduled in the plan.
- Use `reference-images/` for layout inspiration; adapt to GNOME themes, keyboard access, screen readers, and display scaling.

## Architecture and correctness

- Keep GNOME entry points thin; separate provider adapters, usage logic, collection services, UI, and preferences.
- Prefer GJS, Gio/GLib, and native GNOME APIs. Use Meson for installation and packaging; keep development dependencies out of the runtime archive.
- Replace the legacy Bash/embedded-Python collector incrementally. Do not introduce runtime package downloads or unpinned `npx` execution.
- Keep expensive history scans out of the Shell UI process. Bound subprocess lifetimes, prevent overlapping refreshes, and cancel work on disable.
- Store numeric metrics, units, periods, capabilities, source scope, and freshness explicitly. Never infer state from display text.
- Unknown, unsupported, stale, unauthenticated, and exhausted are distinct states. An empty response is not zero usage.
- Keep account-wide limits separate from local activity; never infer subscription usage from token totals or add overlapping data sources.
- Handle cumulative counters, repeated events, partial records, timezone boundaries, and provider-specific cache-token semantics.
- Validate provider APIs and CLI versions against current documentation and fixtures; support partial results without hiding failures.
- Keep credentials and transcript content out of logs, fixtures, caches, and releases. Persist only required usage metadata in XDG locations.

## Verification

- Add meaningful regression tests for changed behavior. Default automated tests to synthetic or sanitized fixtures without live accounts or network access.
- While legacy scripts remain, use `bash -n scripts/freeby.sh scripts/copilot-setup.sh`, `shellcheck scripts/freeby.sh scripts/copilot-setup.sh`, and `bats tests/` as appropriate.
- Validate schemas with `glib-compile-schemas --strict --dry-run schemas`; use an isolated temporary prefix for build/install checks.
- Add and document GJS/pure-JavaScript test and lint commands as the new modules land. Do not claim unavailable checks passed.
- Test only as broadly as the change requires; documentation-only changes need document/link checks, not a live desktop installation.
- Verify lifecycle, wake handling, accessibility, packaging, and each advertised GNOME version before a release. Label unsupported or unverified combinations honestly.

## Milestones and releases

- Follow the ordered milestones in `plan.md`; keep its checkboxes and evidence current. Historical notes under `docs/planning/` are context, not the active roadmap.
- Use conventional commits and stage only intentional changes. Preserve unrelated edits, local credentials, and user reference assets.
- After each completed milestone, commit the tested changes, tag the milestone, and publish an installable GitHub prerelease as agreed with the user.
- Resolve the intended repository and release branch before publishing. Release artifacts must match the tagged commit and pass the milestone gate.
- Include installation/upgrade instructions, release notes, verification results, known limitations, and a downgrade path. Verify the published tag and downloadable artifact.
- If a required check or release operation is blocked, report the exact blocker and leave the milestone incomplete; never label an unfinished milestone released.
- Planning/documentation setup alone is not a completed product milestone and does not warrant a prerelease.
