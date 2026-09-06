# Freeby

Freeby is a native GNOME Shell usage monitor for AI coding tools. It keeps
account limits, reset windows, recent local token activity, and model totals one
click away in the top panel.

Version 2 is being delivered provider by provider. `v2.0.0-alpha.1` is the Codex
milestone: Codex limits and local activity are verified end to end. Cursor and
Copilot adapters remain available as opt-in previews while their dedicated
milestones are completed; Claude Code follows next.

## What the Codex milestone includes

- Account quota windows from the installed Codex CLI's app-server interface.
- Reset countdowns without guessing missing values.
- Seven-day local token activity and per-model input, output, and cache totals.
- Cached results shown as stale while a provider independently refreshes.
- Explicit unavailable, unsupported, missing-authentication, and exhausted states.
- Bounded collectors, refresh backoff, wake refresh, cancellation on disable, and
  threshold-crossing notifications.
- A native, theme-aware, keyboard-focusable GNOME panel interface.

Freeby stores only derived usage metadata under the standard XDG state/cache
directories. It does not copy prompts, responses, transcripts, or credentials.
Local activity covers this device only and must not be interpreted as billing or
subscription usage.

## Requirements

- GNOME Shell 50 (the version verified for this prerelease).
- Codex CLI installed and signed in for account limits.
- GJS with Gio/GLib and Soup 3 introspection data.
- Meson, Ninja, and `glib-compile-schemas` when installing from source.

## Install from source

Development happens on the `dev` branch:

```bash
git clone https://github.com/oo7kc/freeby.git
cd freeby
git switch dev
meson setup build --prefix="$HOME/.local"
meson install -C build
gnome-extensions enable freeby@kelvin.local
```

Log out and back in if GNOME Shell has not discovered the extension. An archive
from a GitHub release can instead be installed with:

```bash
gnome-extensions install --force freeby@kelvin.local-2.0.0-alpha.1.zip
```

## Settings

The alpha.1 preferences window controls refresh frequency and notifications.
The underlying schema also supports the default provider, ordered enabled
providers, history retention, and notification threshold; these receive their
full preferences interface in alpha.5.

To opt into a preview adapter during development:

```bash
gsettings set org.gnome.shell.extensions.freeby enabled-providers "['codex', 'cursor', 'copilot']"
```

Preview providers are not part of the alpha.1 compatibility promise.

## Verify a checkout

```bash
npm run check
npm run pack
python3 tools/smoke-shell.py
```

The final command starts a private headless GNOME session and does not enable the
extension in the active desktop. Live-provider checks are intentionally separate
from credential-free automated fixtures.

## Uninstall or downgrade

```bash
gnome-extensions disable freeby@kelvin.local
rm -rf "$HOME/.local/share/gnome-shell/extensions/freeby@kelvin.local"
```

The extension-local schema is removed with that directory; shared system schema
artifacts are never deleted. To downgrade, install an older release archive with
`gnome-extensions install --force` and restart the session.

See [CONTRIBUTING.md](CONTRIBUTING.md) for development practices and
[plan.md](plan.md) for the ordered provider milestones. Freeby is licensed under
the [MIT License](LICENSE).
