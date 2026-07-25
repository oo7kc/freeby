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

### With meson (recommended)

```bash
git clone https://github.com/YOUR_USERNAME/freeby.git
cd freeby
meson setup build --prefix=$HOME/.local
meson install -C build
```

### Manual install

Copy these files to `~/.local/share/gnome-shell/extensions/freeby@kelvin.local/`:

- `extension.js`
- `metadata.json`
- `stylesheet.css`

Then copy `scripts/freeby.sh` to `~/.local/bin/freeby.sh` and make it executable.

### Enable

Log out and back in (Wayland), or press `Alt+F2` and type `r` (X11), then:

```bash
gnome-extensions enable freeby@kelvin.local
```

## Copilot setup

Copilot needs a one-time device-flow auth:

```bash
copilot-setup
```

If `gh` CLI is installed and authenticated, this step is not needed.

## Usage

- **Panel** — shows `ai·N` where N is the number of providers with remaining quota
- **Dropdown** — click to see per-provider usage, limits, and reset countdown
- **Refresh** — data refreshes every 2 minutes, or click "Refresh now" in the dropdown

## Debugging

```bash
# Check raw output
bash ~/.local/bin/freeby.sh | python3 -m json.tool

# Watch extension logs
journalctl -f -o cat /usr/bin/gnome-shell
```

## License

[MIT](LICENSE)
