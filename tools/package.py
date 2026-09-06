#!/usr/bin/env python3
"""Create a deterministic GNOME extension archive from an explicit allowlist."""
import argparse
import json
from pathlib import Path
import subprocess
import tempfile
import zipfile


def package(source, output):
    metadata = json.loads((source / 'metadata.json').read_text())
    version = json.loads((source / 'package.json').read_text())['version']
    files = [source / name for name in ('extension.js', 'prefs.js', 'metadata.json', 'stylesheet.css', 'LICENSE')]
    files.extend(sorted((source / 'src').rglob('*.js')))
    files.extend(sorted((source / 'schemas').glob('*.xml')))
    output.mkdir(parents=True, exist_ok=True)
    archive = output / f'{metadata["uuid"]}-{version}.zip'
    with tempfile.TemporaryDirectory(prefix='freeby-schemas-') as scratch:
        subprocess.run(['glib-compile-schemas', '--strict', '--targetdir', scratch, str(source / 'schemas')], check=True)
        payloads = [(file.relative_to(source).as_posix(), file.read_bytes()) for file in files]
        payloads.append(('schemas/gschemas.compiled', (Path(scratch) / 'gschemas.compiled').read_bytes()))
        with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED) as target:
            for name, payload in sorted(payloads):
                info = zipfile.ZipInfo(name, date_time=(2020, 1, 1, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o100644 << 16
                target.writestr(info, payload)
        with zipfile.ZipFile(archive) as check:
            assert check.testzip() is None
            assert 'schemas/gschemas.compiled' in check.namelist()
            assert all(not name.startswith(('.AGENTS/', '.github/', 'docs/', 'tests/', 'tools/'))
                       for name in check.namelist())
    print(archive.resolve())
    return archive


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument('--output', type=Path, default=Path('dist'))
    args = parser.parse_args()
    package(args.source.resolve(), args.output.resolve())
