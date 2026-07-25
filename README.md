# Freeby

GNOME Shell extension that tracks remaining usage across your free-tier AI coding tools.

![Screenshot](screenshot.png)

The panel indicator shows `ai` with a count of providers that still have quota (e.g., `ai·2`). Open the dropdown to see per-provider details and time until reset.

## Supported providers

| Provider | How it's detected | Data source |
|---|---|---|
| Codex | `~/.codex/auth.json` | `codex-check` CLI |
| Cursor | `~/.config/cursor/auth.json` | Cursor API |
| Copilot | `gh` CLI or `~/.config/freeby/copilot-token` | GitHub API |

## Prerequisites

- GNOME Shell 45+ (Wayland or X11)
- bash
- curl
- python3
- npx (for Codex provider)
- gh CLI (optional, for Copilot provider)

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

This copies the extension files to `~/.local/share/gnome-shell/extensions/freeby@kelvin.local/` and the scripts to `~/.local/bin/`.

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

## Usage

- **Panel** — shows `ai·N` where N is the number of providers with remaining quota
- **Dropdown** — click to see per-provider usage, limits, and reset countdown
- **Refresh** — data refreshes every 2 minutes, or click "Refresh now" in the dropdown

## Debugging

```bash
# Check raw output from the data script
bash ~/.local/bin/freeby.sh | python3 -m json.tool

# Watch extension logs in real time
journalctl -f -o cat /usr/bin/gnome-shell
```

## License

[MIT](LICENSE)
