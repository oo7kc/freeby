# Freeby — minimal GNOME panel indicator

A GNOME Shell extension that shows local AI coding tool usage
in your top panel, with a dropdown for the per-tool breakdown.

## What works

| Tool | Data source | Status |
|---|---|---|
| Codex | `~/.codex/auth.json` via `codex-check` | Works (needs Node for `npx`) |
| Cursor | `~/.config/cursor/auth.json` → `api2.cursor.sh` | Works |
| Copilot | Token from `gh` CLI or `~/.config/freeby/copilot-token` → GitHub API | Works (needs setup) |

OpenCode was dropped: `opencode stats` only reports lifetime totals,
never remaining quota.

## Install

Requires: `meson`, `bash`, `curl`, `python3`.

### Build and install

```bash
meson setup build --prefix=$HOME/.local
meson install -C build
```

This copies:
- `extension.js`, `metadata.json`, `stylesheet.css` → `~/.local/share/gnome-shell/extensions/freeby@kelvin.local/`
- `freeby.sh`, `copilot-setup.sh` → `~/.local/bin/`

### Restart GNOME Shell

- X11: `Alt+F2`, type `r`, Enter.
- Wayland: log out and back in.

### Enable

```bash
gnome-extensions enable freeby@kelvin.local
```

## Copilot setup

Copilot requires a one-time device-flow authentication:

```bash
copilot-setup
```

This opens a browser prompt where you authorize GitHub access.
The token is saved to `~/.config/freeby/copilot-token`.

If you have `gh` CLI installed and authenticated, the extension
will use that instead — no setup needed.

## Debugging

```bash
# Test the data script standalone
bash ~/.local/bin/freeby.sh | python3 -m json.tool

# Watch extension logs
journalctl -f -o cat /usr/bin/gnome-shell
```

## How it works

The extension (`extension.js`) spawns `freeby.sh` every 120 seconds.
The script calls each provider's API and outputs a JSON blob:

```json
{
  "codex":   {"available": true,  "summary": "5h: 42.3% used, resets Jul 27 21:29"},
  "cursor":  {"available": true,  "summary": "You've used 0% of your included usage, resets Jul 30"},
  "copilot": {"available": true,  "summary": "45/1000 premium used, resets Aug 1"}
}
```

The extension shows a count of available providers in the panel
(e.g. `AI (3)`) and the full breakdown in the dropdown.
