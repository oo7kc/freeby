---
description: Verification and privacy requirements for every change
alwaysApply: true
---

# Quality, privacy, and verification

- Add focused regression coverage for behavior changes. Keep automated fixtures
  synthetic or sanitized and network-free.
- Run `npm run check` for JavaScript, schema, unit, and GJS integration checks.
  Run `npm run pack` when packaging inputs or release metadata change.
- Use `python3 tools/smoke-shell.py` for GNOME lifecycle changes when a compatible
  shell is available. Test the exact archive before release.
- Validate provider interfaces against current first-party documentation,
  installed client versions, sanitized fixtures, and live accounts when safely
  available. Record unavailable live checks honestly.
- Verify lifecycle, wake handling, accessibility, packaging, and every advertised
  GNOME version before release. Do not claim checks that were not run.
- Keep credentials, prompts, responses, raw transcripts, account identities, and
  raw session IDs out of logs, fixtures, caches, commits, and release archives.
- Store derived usage metadata only in private XDG state/cache locations. Hash
  identifiers used solely for deduplication or account-change detection.
- Preserve unrelated worktree changes and user-owned assets. Stage explicit paths
  and inspect the staged diff before committing.
