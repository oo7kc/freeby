<p align="center">
  <h1 align="center">Freeby</h1>
  <p align="center">GNOME Shell extension that tracks remaining usage across your free-tier AI coding tools.</p>
</p>

<p align="center">
  <img src="docs/s1.png" width="45%" />
  &nbsp;&nbsp;
  <img src="docs/s2.png" width="45%" />
</p>

<br>

The panel indicator shows `ai` with a count of providers that still have quota (e.g., `ai·2`). Open the dropdown to see per-provider details and time until reset.

---

## Features

- **Panel indicator** — colored `ai·N` shows available providers at a glance
- **Dropdown** — per-provider usage, limits, and reset countdown
- **Notifications** — alert when a provider hits its limit
- **Auto-refresh** — refreshes on wake from sleep
- **Configurable** — adjust refresh interval in settings

## Supported providers

| Provider | How it's detected | Data source |
|---|---|---|
| Codex | `~/.codex/auth.json` | `codex-check` CLI (JSON output) |
| Cursor | `~/.config/cursor/auth.json` | Cursor API |
| Copilot | `gh` CLI or `~/.config/freeby/copilot-token` | GitHub API |

## Install

### 1. Clone the repo

```bash
git clone https://github.com/kcnewman/freeby.git
cd freeby
```

### 2. Install with meson

```bash
meson setup build --prefix=$HOME/.local
meson install -C build
```

### 3. Restart GNOME Shell

- **Wayland:** Log out and log back in
- **X11:** Press `Alt+F2`, type `r`, and press Enter

### 4. Enable the extension

```bash
gnome-extensions enable freeby@kelvin.local
```

You should see `ai` appear in your top panel.

## Copilot setup

If you don't have `gh` CLI installed and authenticated, you need to set up Copilot auth manually:

```bash
copilot-setup
```

This runs a device-flow auth and saves the token to `~/.config/freeby/copilot-token`.

If `gh` CLI is already authenticated, skip this step.

## Settings

Open Extension Manager → Freeby → Settings to configure:

| Setting | Default | Description |
|---|---|---|
| Refresh interval | 120s | How often to check usage (min 30s) |
| Notifications | On | Alert when a provider hits its limit |

Or via command line:

```bash
gsettings --schemadir ~/.local/share/glib-2.0/schemas set org.gnome.shell.extensions.freeby refresh-interval 60
gsettings --schemadir ~/.local/share/glib-2.0/schemas set org.gnome.shell.extensions.freeby notifications-enabled false
```

## Debugging

```bash
# Check raw output
bash ~/.local/bin/freeby.sh | python3 -m json.tool

# Watch extension logs
journalctl -f -o cat /usr/bin/gnome-shell
```

## License

[MIT](LICENSE)
