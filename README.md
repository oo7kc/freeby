# UsageBeam

UsageBeam is a native GNOME Shell usage monitor for AI coding tools. It keeps
account limits, reset windows, recent local token activity, and model totals one
click away in the top panel.

Version 2 is being delivered provider by provider. The former Freeby identity
was used through `v2.0.0-alpha.2`; development now uses the permanent UsageBeam
identity. Cursor and Copilot adapters remain opt-in previews while their
dedicated milestones are completed.

## What the current prerelease includes

- Account quota windows from the installed Codex CLI's app-server interface.
- Claude Code 5-hour, weekly, and model-scoped limits through its saved OAuth
  sign-in, with clear missing/expired-authentication states.
- Reset countdowns without guessing missing values.
- Seven-day local Codex and Claude Code activity with per-model input, output,
  cache-read, and cache-write totals.
- Cached results shown as stale while a provider independently refreshes.
- Explicit unavailable, unsupported, missing-authentication, and exhausted states.
- Bounded collectors, refresh backoff, wake refresh, cancellation on disable, and
  threshold-crossing notifications.
- A native, theme-aware, keyboard-focusable interface with a compact active-provider
  panel readout and expandable seven-day activity chart.

UsageBeam stores only derived usage metadata under the standard XDG state/cache
directories. It does not copy prompts, responses, transcripts, or credentials.
Local activity covers this device only and must not be interpreted as billing or
subscription usage.

## Requirements

- GNOME Shell 50 (the version verified for this prerelease).
- Codex CLI installed and signed in for Codex account limits. System installs
  and common user-local/version-manager layouts (including fnm, nvm, mise,
  asdf, and Volta) are detected from GNOME Shell's restricted environment.
- Claude Code installed and signed in for Claude account limits; local Claude
  transcripts remain useful independently.
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
gnome-extensions enable usagebeam@oo7kc.github.io
```

Log out and back in if GNOME Shell has not discovered the extension. Starting
with alpha.3, a downloaded release archive can instead be installed with:

```bash
gnome-extensions install --force usagebeam@oo7kc.github.io-VERSION.zip
```

The identity migration copies recognized derived usage data and explicitly
changed settings from an installed Freeby alpha without overwriting existing
UsageBeam values. It does not copy credentials. After confirming UsageBeam is
active, the former `freeby@kelvin.local` extension can be uninstalled.

## Settings

The development preferences window controls left/right-of-calendar placement,
refresh frequency, and notifications. The underlying schema also supports the
default provider, ordered enabled providers, history retention, and notification
threshold; these receive their full preferences interface in alpha.5.

To opt into a preview adapter during development:

```bash
gsettings set org.gnome.shell.extensions.usagebeam enabled-providers "['codex', 'claude', 'cursor', 'copilot']"
```

Preview providers are not part of the alpha.2 compatibility promise. See the
[Claude provider notes](docs/providers/claude.md) for scope and compatibility
details.

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
gnome-extensions disable usagebeam@oo7kc.github.io
gnome-extensions uninstall usagebeam@oo7kc.github.io
```

The extension-local schema is removed with the extension; shared system schema
artifacts are never deleted. To downgrade, install an older release archive with
`gnome-extensions install --force` and restart the session. Releases through
alpha.2 use the former UUID and therefore install as a separate extension.

See [CONTRIBUTING.md](CONTRIBUTING.md) for development practices and
[.AGENTS/plans/roadmap.md](.AGENTS/plans/roadmap.md) for the ordered provider
milestones. Architecture and provider documentation is indexed in
[docs/README.md](docs/README.md). UsageBeam is licensed under the [MIT License](LICENSE).
