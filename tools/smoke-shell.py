#!/usr/bin/env python3
"""Exercise the packaged extension in a private headless GNOME session."""
import argparse
import os
from pathlib import Path
import signal
import subprocess
import tempfile
import time
import zipfile


def run(command, env, **options):
    return subprocess.run(command, env=env, text=True, capture_output=True, timeout=15, **options)


def install(source, archive, prefix, destination):
    extension = prefix / 'share' / 'gnome-shell' / 'extensions' / 'freeby@kelvin.local'
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


def smoke(source, archive, destination):
    destination.mkdir(parents=True, exist_ok=True)
    prefix = destination / 'install'
    install(source, archive, prefix, destination)
    env = {**os.environ, 'XDG_CONFIG_HOME': str(destination / 'config'),
           'XDG_DATA_HOME': str(prefix / 'share'), 'XDG_CACHE_HOME': str(destination / 'cache'),
           'XDG_STATE_HOME': str(destination / 'state'), 'GSETTINGS_BACKEND': 'keyfile',
           'GSETTINGS_SCHEMA_DIR': str(prefix / 'share/gnome-shell/extensions/freeby@kelvin.local/schemas'),
           'LIBGL_ALWAYS_SOFTWARE': '1'}
    # Empty provider list prevents personal authentication/data access during UI tests.
    run(['gsettings', 'set', 'org.gnome.shell.extensions.freeby', 'enabled-providers', '[]'], env, check=True)
    run(['gsettings', 'set', 'org.gnome.shell', 'enabled-extensions', "['freeby@kelvin.local']"], env, check=True)
    run(['gsettings', 'set', 'org.gnome.shell', 'welcome-dialog-last-shown-version', '999'], env)
    bus = subprocess.Popen(['dbus-daemon', '--session', '--nofork', '--print-address=1'], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
    env['DBUS_SESSION_BUS_ADDRESS'] = bus.stdout.readline().strip()
    log_path = destination / 'shell.log'
    shell = None
    try:
        with log_path.open('w') as log:
            shell = subprocess.Popen(['gnome-shell', '--headless', '--no-x11', '--virtual-monitor', '1280x1024',
                                      '--wayland-display', 'freeby-test', '--debug-control'], env=env, stdout=log, stderr=log, start_new_session=True)
        command = ['gdbus', 'call', '--session', '--dest', 'org.gnome.Shell.Extensions', '--object-path', '/org/gnome/Shell/Extensions',
                   '--method', 'org.gnome.Shell.Extensions.GetExtensionInfo', 'freeby@kelvin.local']
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
        run(['gnome-extensions', 'disable', 'freeby@kelvin.local'], env, check=True)
        run(['gnome-extensions', 'enable', 'freeby@kelvin.local'], env, check=True)
        print('PASS: extension disable/re-enable')
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


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument('--archive', type=Path, help='Test an already-built release archive instead of a Meson install')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    smoke(args.source.resolve(), args.archive.resolve() if args.archive else None,
          args.output or Path(tempfile.mkdtemp(prefix='freeby-shell-')))
