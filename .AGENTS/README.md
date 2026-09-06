# Agent workspace

This directory is the single home for agent guidance, active plans, historical
planning context, and implementation reference material. The root `AGENTS.md`
exists only because agent tooling discovers that conventional filename.

Read these always-applicable rules before making changes:

1. [Product and architecture](rules/architecture.md)
2. [Quality, privacy, and verification](rules/quality.md)
3. [Version control and releases](rules/releases.md)

Use [plans/roadmap.md](plans/roadmap.md) as the active milestone record. Material
under [plans/archive/](plans/archive/) is historical and must not override the
active roadmap. Visuals under [references/](references/) are design references,
not runtime assets, and are excluded from extension archives by the packaging
allowlist.
