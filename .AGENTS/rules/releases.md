---
description: Branch, commit, tag, and prerelease workflow
alwaysApply: true
---

# Version control and releases

- Develop on `dev`; reserve `main` for the later stable migration.
- Follow `.AGENTS/plans/roadmap.md` in order and keep its checkboxes and evidence
  current. Planning setup alone is not a product milestone.
- Use conventional commits and separate implementation from release-documentation
  checkpoints when that improves reviewability.
- A milestone requires applicable tests, strict schema validation, deterministic
  packaging, an isolated install, and lifecycle checks for UI changes.
- Push the candidate to `dev` and require green remote CI before tagging.
- Create an annotated semantic prerelease tag from the exact tested commit.
- Publish the CI-built archive as a GitHub prerelease with install/upgrade,
  verification, known limitations, and downgrade instructions.
- Verify the remote tag target, prerelease/draft status, downloadable asset, and
  checksum. Record the commit, URL, size, and SHA-256 in the roadmap.
- Never mark a milestone complete while a required check or publication is
  blocked. Keep stable unreleased until all provider and stabilization gates pass.
