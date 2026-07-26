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

> **Copilot users:** If `gh` isn't installed, run `copilot-setup` first.

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

### Debug

```bash
bash ~/.local/bin/freeby.sh | python3 -m json.tool
journalctl -f -o cat /usr/bin/gnome-shell
```

---

[MIT](LICENSE)
