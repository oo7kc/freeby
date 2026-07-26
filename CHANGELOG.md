# Changelog

## v1.0.0

### Fixed
- Crash when subprocess returns empty/null output
- Race condition from concurrent refresh calls (clicking during auto-refresh)
- Stale async callback after extension disable
- False "limit reached" notification on first refresh
- Schema not compiled during install (gsettings now works out of the box)
- Codex percentage parser using string instead of boolean for `has_remaining`
- Copilot percentage exceeding 100% on overages
- Cursor showing "resets now" when billing cycle end is unknown
- `copilot-setup.sh` infinite loop (now times out after 5 minutes)
- Shell script temp directory shadowing system `$TMPDIR`
- Shell script hanging forever when curl or npx times out

### Changed
- Consistent percentage display across all providers
- Metadata: added `version` and `settings-schema` fields
- Metadata: removed unreleased GNOME shell versions from compatibility list
- GSettings: enforced 30–3600s range on refresh interval
- Build: schema compilation now runs automatically during `meson install`
- README: added prerequisites, uninstall instructions, corrected copilot-setup path

### Security
- Fixed Python code injection risk when `$HOME` contains single quotes
- Removed unused `json_escape` function

## v0.5.0

### Fixed
- Dropdown now stays open when clicking the refresh icon
- Consistent percentage display for Copilot (was showing token counts)

## v0.4.0

### Added
- Desktop notifications on provider limit hit
- Auto-refresh on wake from sleep (systemd PrepareForSleep)
- Configurable refresh interval via gsettings
- Settings UI in Extension Manager (prefs.js)
- Parallel provider fetches (4.6s → 1.9s)

### Changed
- Split extension.js into extension.js + indicator.js + prefs.js

## v0.3.0

### Added
- Click panel to refresh
- Clickable refresh icon in dropdown
- `has_remaining` field for accurate provider count

### Fixed
- Consistent comma separator and countdown format
- Codex parsed via `--json` flag for reliable parsing

## v0.2.0

### Added
- Real provider integrations: Codex, Cursor, Copilot
- `copilot-setup.sh` device-flow auth script
- Panel indicator with colored status

## v0.1.0

- Initial release with placeholder data
