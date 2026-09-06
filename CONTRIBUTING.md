# Contributing to Freeby

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
meson setup build --prefix=/tmp/freeby-install
meson install -C build
```

`python3 tools/smoke-shell.py` additionally verifies lifecycle behavior in a
private headless GNOME Shell session when GNOME Shell is available locally.

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

The authoritative milestone gates and release process are in [plan.md](plan.md).
Project-wide agent guidance is in [AGENTS.md](AGENTS.md).
