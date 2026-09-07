# Contributing to UsageBeam

Development targets the `dev` branch. `main` is reserved for stable releases.
Keep provider changes small enough to verify independently and use conventional
commit messages such as `feat:`, `fix:`, `test:`, `docs:`, and `chore:`.

## Development environment

Install Node.js 20 or newer, GJS, Soup 3 introspection data, Meson, Ninja, and the
GLib schema compiler. Then run:

```bash
git clone https://github.com/oo7kc/freeby.git
cd freeby
git switch dev
npm run check
npm run pack
```

For an isolated installation:

```bash
meson setup build --prefix=/tmp/usagebeam-install
meson install -C build
```

`python3 tools/smoke-shell.py` additionally verifies lifecycle and actual popup
geometry in a private headless GNOME Shell session. The test-only companion under
`tests/shell/` injects synthetic usage, exercises all four panel positions and
provider changes, expands activity, and checks bar sizes, text alignment, and
layout stability. JSON measurements and light/dark screenshots are saved in the
printed temporary directory. The companion is never included in release archives;
it requires no unsafe Shell evaluation or access to your live desktop.
Use `--archive dist/ARCHIVE.zip` to test the exact packaged payload.
Add `--scale 2` for a 2× virtual monitor or `--text-scale 1.25` for enlarged
accessibility text. Physical/fractional monitor scaling still needs desktop QA.

## Design and architecture

- Keep `extension.js` and `prefs.js` thin GNOME entry points.
- Keep provider response parsing in `src/providers/`, orchestration and storage
  in `src/services/`, shared contracts in `src/core/`, and actors in `src/ui/`.
- Preserve source scope and provider units. Unknown data stays unknown; account
  limits never derive from local token totals.
- Keep collectors bounded and cancellable. Never download runtime dependencies.
- Fixtures must be synthetic or sanitized. Do not commit tokens, account IDs,
  prompts, responses, or complete provider transcripts.
- Preserve GNOME theme behavior, keyboard focus, accessible names, and readable
  scaling when changing the panel UI.

The authoritative milestone gates and release process are in
[.AGENTS/plans/roadmap.md](.AGENTS/plans/roadmap.md). Project-wide agent guidance
starts in [AGENTS.md](AGENTS.md), with the substantive rules under `.AGENTS/`.
