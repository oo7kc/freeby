# Freeby

> GNOME Shell extension that tracks remaining usage across your free-tier AI coding tools.

<table>
  <tr>
    <td><img src="docs/s1.png" width="400" /></td>
    <td><img src="docs/s2.png" width="400" /></td>
  </tr>
</table>

---

### Features

- **Panel indicator** — colored `ai·N` shows available providers at a glance
- **Dropdown** — per-provider usage, limits, and reset countdown
- **Notifications** — desktop alert when a provider hits its limit
- **Auto-refresh on wake** — refreshes immediately after sleep
- **Fast** — all providers queried in parallel (~2s)
- **Configurable** — adjust refresh interval and notifications in settings

---

### Providers

| | Provider | Source |
|---|---|---|
| ![#f87171](https://via.placeholder.com/10/f87171/000000?text=+) | **Codex** | `~/.codex/auth.json` → `codex-check` CLI |
| ![#4ade80](https://via.placeholder.com/10/4ade80/000000?text=+) | **Cursor** | `~/.config/cursor/auth.json` → Cursor API |
| ![#facc15](https://via.placeholder.com/10/facc15/000000?text=+) | **Copilot** | `gh` CLI → GitHub API |

---

### Prerequisites

- GNOME Shell 45+ (Wayland or X11)
- `python3`
- `curl`
- `meson` and `ninja-build` (for building)
- `glib-compile-schemas` (usually pre-installed)
- `npx` (for Codex usage tracking)
- `gh` CLI (for Copilot usage tracking, optional)

Install build dependencies on Fedora:

```bash
sudo dnf install meson ninja-build python3 curl glib2-devel
```

On Ubuntu/Debian:

```bash
sudo apt install meson ninja-build python3 curl libglib2.0-dev-bin
```

---

### Install

```bash
git clone https://github.com/kcnewman/freeby.git && cd freeby
meson setup build --prefix=$HOME/.local
meson install -C build
```

Restart your session, then:

```bash
gnome-extensions enable freeby@kelvin.local
```

> **Copilot users:** If `gh` isn't installed, run `copilot-setup.sh` first.

---

### Settings

| Setting | Default | |
|---|---|---|
| Refresh interval | `120s` | min 30s |
| Notifications | `on` | alerts on limit hit |

Configure via Extension Manager or CLI:

```bash
gsettings --schemadir ~/.local/share/glib-2.0/schemas \
  set org.gnome.shell.extensions.freeby refresh-interval 60
```

---

### Uninstall

```bash
gnome-extensions disable freeby@kelvin.local
rm -rf ~/.local/share/gnome-shell/extensions/freeby@kelvin.local
rm -f ~/.local/bin/freeby.sh ~/.local/bin/copilot-setup.sh
rm -f ~/.local/share/glib-2.0/schemas/org.gnome.shell.extensions.freeby.gschema.xml
rm -f ~/.local/share/glib-2.0/schemas/gschemas.compiled
```

---

### Debug

```bash
bash ~/.local/bin/freeby.sh | python3 -m json.tool
journalctl -f -o cat /usr/bin/gnome-shell
```

---

[MIT](LICENSE)
