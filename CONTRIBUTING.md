# Contributing

Thanks for your interest in Freeby.

## Development

```bash
git clone https://github.com/kcnewman/freeby.git && cd freeby
git checkout dev
meson setup build --prefix=$HOME/.local
meson install -C build
```

Restart GNOME Shell (Alt+F2, type `r`, Enter) and enable:

```bash
gnome-extensions enable freeby@kelvin.local
```

## Project structure

```
freeby/
├── extension.js          # Entry point (enable/disable)
├── indicator.js          # Panel UI, dropdown, refresh
├── prefs.js              # Settings UI in Extension Manager
├── scripts/
│   ├── freeby.sh         # Data aggregator (parallel provider fetches)
│   └── copilot-setup.sh  # GitHub device-flow auth
├── schemas/
│   └── *.gschema.xml     # GSettings schema
├── build-aux/
│   └── compile-schemas.sh
├── tests/
│   └── freeby.bats       # Shell script tests
├── .github/workflows/
│   └── ci.yml            # shellcheck, meson build, bats tests
└── docs/
    ├── s1.png
    └── s2.png
```

## Code style

- Keep it simple. No unnecessary abstraction.
- Lowercase sentence case for user-facing text.
- Follow existing patterns in the codebase.

## Commits

Use [conventional commits](https://www.conventionalcommits.org/):

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation only
- `chore:` maintenance, tests, CI

## Testing

```bash
# test the data script
bash scripts/freeby.sh | python3 -m json.tool

# run shellcheck
shellcheck scripts/freeby.sh scripts/copilot-setup.sh

# run bats tests
bats tests/
```

CI runs automatically on push to `main` or `dev`, and on all pull requests.

## Branches

- `main` — stable releases
- `dev` — active development

## Pull requests

1. Fork and create a branch from `dev`
2. Make your changes
3. Test manually (the extension runs in your live desktop)
4. Open a PR against `dev`
