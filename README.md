# Freeby

GNOME Shell panel extension that shows remaining usage across your AI coding tools.

## Supported providers

| Provider | Source |
|---|---|
| Codex | `~/.codex/auth.json` via `codex-check` |
| Cursor | `~/.config/cursor/auth.json` → `api2.cursor.sh` |
| Copilot | `gh` CLI or `~/.config/freeby/copilot-token` → GitHub API |

## Install

```bash
meson setup build --prefix=$HOME/.local
meson install -C build
```

Then restart your session (log out/in on Wayland, or `Alt+F2` → `r` on X11) and enable:

```bash
gnome-extensions enable freeby@kelvin.local
```

## Copilot setup

Copilot needs a one-time device-flow auth:

```bash
copilot-setup
```

If `gh` CLI is installed and authenticated, this step is not needed.

## Debugging

```bash
bash ~/.local/bin/freeby.sh | python3 -m json.tool
journalctl -f -o cat /usr/bin/gnome-shell
```
