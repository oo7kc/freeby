# Contributing

Thanks for your interest in Freeby.

## Development

Clone and install locally:

```bash
git clone https://github.com/kcnewman/freeby.git && cd freeby
git checkout dev
meson setup build --prefix=$HOME/.local
meson install -C build
```

Test your changes by restarting GNOME Shell (Alt+F2, type `r`, Enter) and enabling the extension:

```bash
gnome-extensions enable freeby@kelvin.local
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

Test the shell script directly:

```bash
bash ~/.local/bin/freeby.sh | python3 -m json.tool
```

Run shellcheck:

```bash
shellcheck scripts/freeby.sh scripts/copilot-setup.sh
```

## Branches

- `main` — stable releases
- `dev` — active development

## Pull requests

1. Fork and create a branch from `dev`
2. Make your changes
3. Test manually (the extension runs in your live desktop)
4. Open a PR against `dev`
