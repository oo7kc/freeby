#!/usr/bin/env python3
"""Exercise the packaged extension in a private headless GNOME session."""
import argparse
from datetime import date, timedelta
import json
import os
from pathlib import Path
import signal
import shutil
import subprocess
import tempfile
import time
import zipfile
from xml.sax.saxutils import escape

UUID = 'usagebeam@oo7kc.github.io'
SCHEMA = 'org.gnome.shell.extensions.usagebeam'
PRODUCT_DIRECTORY = 'usagebeam'
TEST_UUID = 'usagebeam-ui-test@tests.invalid'


def run(command, env, **options):
    return subprocess.run(command, env=env, text=True, capture_output=True, timeout=15, **options)


def install(source, archive, prefix, destination):
    extension = prefix / 'share' / 'gnome-shell' / 'extensions' / UUID
    if archive:
        with zipfile.ZipFile(archive) as payload:
            for entry in payload.infolist():
                parts = Path(entry.filename).parts
                if entry.is_dir():
                    continue
                if Path(entry.filename).is_absolute() or '..' in parts:
                    raise RuntimeError(f'Unsafe archive entry: {entry.filename}')
                target = extension.joinpath(*parts)
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(payload.read(entry))
        return
    build = destination / 'build'
    subprocess.run(['meson', 'setup', str(build), str(source), f'--prefix={prefix}'], check=True, stdout=subprocess.DEVNULL)
    subprocess.run(['meson', 'install', '-C', str(build)], check=True, stdout=subprocess.DEVNULL)


def seed_usage(destination):
    """Populate non-personal records so every primary popup widget is constructed."""
    now = int(time.time() * 1000)
    dates = [(date.today() - timedelta(days=offset)).isoformat() for offset in range(6, -1, -1)]

    def record(provider, name, plan, percentages, models):
        days = [{'date': day, 'total': [0, 0, 0, 0, 0, 70_700_000, 38_500_000][index],
                 'sessions': index + 1, 'events': index + 2}
                for index, day in enumerate(dates)]
        return {
            'schemaVersion': 2, 'id': provider, 'name': name, 'plan': plan, 'accountKey': '0' * 64,
            'capabilities': {'limits': True, 'history': True, 'models': True},
            'limits': {'status': 'ready', 'message': '', 'updatedAt': now, 'scope': 'account',
                       'source': 'Synthetic smoke fixture',
                       'windows': [
                           {'id': f'{provider}:session', 'label': 'Session · 5 hours', 'usedPercent': percentages[0],
                            'used': None, 'limit': None, 'unit': 'percent', 'unlimited': False,
                            'state': 'exhausted' if percentages[0] >= 100 else 'active',
                            'durationMinutes': 300, 'resetsAt': now + 7_200_000},
                           {'id': f'{provider}:weekly', 'label': 'Weekly', 'usedPercent': percentages[1],
                            'used': None, 'limit': None, 'unit': 'percent', 'unlimited': False,
                            'state': 'exhausted' if percentages[1] >= 100 else 'active',
                            'durationMinutes': 10_080, 'resetsAt': now + 172_800_000},
                           {'id': f'{provider}:reserve', 'label': 'Weekly reserve', 'usedPercent': percentages[2],
                            'used': None, 'limit': None, 'unit': 'percent', 'unlimited': False,
                            'state': 'exhausted' if percentages[2] >= 100 else 'active',
                            'durationMinutes': 10_080, 'resetsAt': now + 604_800_000},
                       ]},
            'history': {'status': 'ready', 'message': '', 'updatedAt': now, 'scope': 'local',
                        'period': {'start': dates[0], 'end': dates[-1]}, 'days': days, 'models': models,
                        'source': 'Synthetic smoke fixture'},
        }

    models = [
        {'model': 'gpt-5.6-sol', 'total': 77_200_000, 'input': 190_000, 'output': 68_000,
         'cacheRead': 76_942_000, 'cacheWrite': 0},
        {'model': 'codex-auto-review', 'total': 24_100_000, 'input': 97_000, 'output': 8_000,
         'cacheRead': 23_995_000, 'cacheWrite': 0},
        {'model': 'gpt-6-astra', 'total': 7_900_000, 'input': 42_000, 'output': 62_000,
         'cacheRead': 7_796_000, 'cacheWrite': 0},
    ]
    target = destination / 'state' / PRODUCT_DIRECTORY
    target.mkdir(parents=True, exist_ok=True)
    records = {'codex': record('codex', 'Codex', 'Plus', (100, 94, 83), models),
               'claude': record('claude', 'Claude Code', 'Pro', (46, 7, 0), models)}
    for provider, data in records.items():
        (target / f'{provider}.json').write_text(json.dumps(data))
    # Separate fixtures survive asynchronous collector updates to the cache.
    (destination / 'ui-fixtures.json').write_text(json.dumps(records))


def smoke(source, archive, destination, scale=1, text_scale=1.0):
    destination.mkdir(parents=True, exist_ok=True)
    prefix = destination / 'install'
    install(source, archive, prefix, destination)
    shutil.copytree(source / 'tests/shell', prefix / 'share/gnome-shell/extensions' / TEST_UUID)
    isolated_home = destination / 'home'
    isolated_home.mkdir(parents=True, exist_ok=True)
    runtime = destination / 'runtime'
    runtime.mkdir(mode=0o700)
    seed_usage(destination)
    env = {**os.environ, 'HOME': str(isolated_home), 'PATH': '/usr/bin:/bin',
           'XDG_CONFIG_HOME': str(destination / 'config'),
           'XDG_DATA_HOME': str(prefix / 'share'), 'XDG_CACHE_HOME': str(destination / 'cache'),
           'XDG_STATE_HOME': str(destination / 'state'), 'GSETTINGS_BACKEND': 'keyfile',
           'XDG_RUNTIME_DIR': str(runtime),
           'GSETTINGS_SCHEMA_DIR': str(prefix / 'share/gnome-shell/extensions' / UUID / 'schemas'),
           'LIBGL_ALWAYS_SOFTWARE': '1', 'USAGEBEAM_TEST_OUTPUT': str(destination),
           'USAGEBEAM_TEST_SCALE': str(scale)}
    # Use locally installed fonts without copying or distributing licensed files.
    font = run(['fc-match', '-f', '%{file}', 'SF Pro Text'], os.environ, check=True).stdout
    font_config = destination / 'fonts.conf'
    font_config.write_text('<fontconfig><include>/etc/fonts/fonts.conf</include>'
                           f'<dir>{escape(str(Path(font).parent))}</dir></fontconfig>')
    env['FONTCONFIG_FILE'] = str(font_config)
    run(['gsettings', 'set', 'org.gnome.desktop.interface', 'scaling-factor', str(scale)], env, check=True)
    run(['gsettings', 'set', 'org.gnome.desktop.interface', 'text-scaling-factor', str(text_scale)], env, check=True)
    run(['gsettings', 'set', SCHEMA, 'enabled-providers', "['codex', 'claude']"], env, check=True)
    run(['gsettings', 'set', SCHEMA, 'panel-position', "'left-of-calendar'"], env, check=True)
    run(['gsettings', 'set', 'org.gnome.shell', 'enabled-extensions', f"['{UUID}', '{TEST_UUID}']"], env, check=True)
    run(['gsettings', 'set', 'org.gnome.shell', 'welcome-dialog-last-shown-version', '999'], env)
    bus = subprocess.Popen(['dbus-daemon', '--session', '--nofork', '--print-address=1'], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
    env['DBUS_SESSION_BUS_ADDRESS'] = bus.stdout.readline().strip()
    log_path = destination / 'shell.log'
    shell = None
    try:
        with log_path.open('w') as log:
            shell = subprocess.Popen(['gnome-shell', '--headless', '--no-x11', '--virtual-monitor', f'{1280 * scale}x{1024 * scale}',
                                      '--wayland-display', 'usagebeam-test'], env=env, stdout=log, stderr=log, start_new_session=True)
        command = ['gdbus', 'call', '--session', '--dest', 'org.gnome.Shell.Extensions', '--object-path', '/org/gnome/Shell/Extensions',
                   '--method', 'org.gnome.Shell.Extensions.GetExtensionInfo', UUID]
        deadline = time.monotonic() + 30
        info = ''
        while time.monotonic() < deadline and shell.poll() is None:
            result = run(command, env)
            info = result.stdout
            if "'state': <1.0>" in info:
                break
            if "'state': <3.0>" in info:
                raise RuntimeError(f'Extension failed: {info}')
            time.sleep(0.4)
        else:
            raise RuntimeError(f'Extension did not become active: {info}')
        print('PASS: packaged extension loads in a private GNOME Shell session')
        results_path = destination / 'ui-results.json'
        deadline = time.monotonic() + 25
        while time.monotonic() < deadline and not results_path.exists() and shell.poll() is None:
            time.sleep(0.2)
        if not results_path.exists():
            raise RuntimeError(f'UI tests did not complete; inspect {log_path}')
        results = json.loads(results_path.read_text())
        if not results['ok']:
            raise RuntimeError(f"UI check failed: {results['error']}")
        print('PASS: four positions, stable provider width, and exact calendar-gap centering')
        print('PASS: opened popup, compact bars, aligned text, repeated allocation, and theme screenshots')
        print(f'UI geometry and screenshots: {destination}')
        run(['gnome-extensions', 'disable', TEST_UUID], env, check=True)
        run(['gnome-extensions', 'disable', UUID], env, check=True)
        run(['gnome-extensions', 'enable', UUID], env, check=True)
        print('PASS: extension disable/re-enable')
        # Leave no collector running while the private shell itself shuts down.
        run(['gnome-extensions', 'disable', UUID], env, check=True)
    finally:
        if shell and shell.poll() is None:
            os.killpg(shell.pid, signal.SIGTERM)
            try:
                shell.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(shell.pid, signal.SIGKILL)
                shell.wait()
        bus.terminate()
        bus.wait(timeout=5)
        print(f'GNOME log: {log_path}')
    contents = log_path.read_text(errors='replace')
    if 'Gjs-CRITICAL' in contents and UUID in contents:
        raise RuntimeError(f'Extension emitted a GJS critical; inspect {log_path}')
    if 'St-WARNING' in contents or 'UsageBeam could not' in contents or 'JS ERROR' in contents:
        raise RuntimeError(f'UI, stylesheet, or JavaScript warning; inspect {log_path}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument('--archive', type=Path, help='Test an already-built release archive instead of a Meson install')
    parser.add_argument('--output', type=Path)
    parser.add_argument('--scale', type=int, choices=[1, 2], default=1, help='Private virtual-monitor scale')
    parser.add_argument('--text-scale', type=float, choices=[1.0, 1.25], default=1.0, help='Accessibility text scale')
    args = parser.parse_args()
    smoke(args.source.resolve(), args.archive.resolve() if args.archive else None,
          args.output.resolve() if args.output else Path(tempfile.mkdtemp(prefix='usagebeam-shell-')),
          args.scale, args.text_scale)
