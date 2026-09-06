import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export const join = (...parts) => GLib.build_filenamev(parts);
export const fingerprint = value => GLib.compute_checksum_for_string(GLib.ChecksumType.SHA256, String(value), -1);

export function readJson(path, fallback = null, maxBytes = 16 * 1024 * 1024) {
    try {
        const file = Gio.File.new_for_path(path);
        if (file.query_info('standard::size', Gio.FileQueryInfoFlags.NONE, null).get_size() > maxBytes)
            return fallback;
        const [, bytes] = file.load_contents(null);
        return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
        return fallback;
    }
}

export function writeJson(path, value) {
    const file = Gio.File.new_for_path(path);
    const parent = file.get_parent();
    GLib.mkdir_with_parents(parent.get_path(), 0o700);
    file.replace_contents(new TextEncoder().encode(JSON.stringify(value)), null, false,
        Gio.FileCreateFlags.PRIVATE | Gio.FileCreateFlags.REPLACE_DESTINATION, null);
}

function executable(path) {
    return GLib.file_test(path, GLib.FileTest.IS_EXECUTABLE) ? path : null;
}

function versionParts(value) {
    return (String(value).match(/\d+/g) ?? []).map(Number);
}

function compareVersions(a, b) {
    const left = versionParts(a);
    const right = versionParts(b);
    for (let i = 0; i < Math.max(left.length, right.length); i++) {
        const difference = (left[i] ?? 0) - (right[i] ?? 0);
        if (difference)
            return difference;
    }
    return String(a).localeCompare(String(b));
}

function versionedCommand(root, suffix, name) {
    const directory = Gio.File.new_for_path(root);
    if (!directory.query_exists(null))
        return null;
    const candidates = [];
    let iterator;
    try {
        iterator = directory.enumerate_children('standard::name,standard::type',
            Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);
        let info;
        while ((info = iterator.next_file(null))) {
            if (info.get_file_type() !== Gio.FileType.DIRECTORY)
                continue;
            const path = executable(join(root, info.get_name(), ...suffix, name));
            if (path)
                candidates.push({version: info.get_name(), path});
        }
    } catch {
        return null;
    } finally {
        iterator?.close(null);
    }
    candidates.sort((a, b) => compareVersions(b.version, a.version));
    return candidates[0]?.path ?? null;
}

export function findCommand(name, {home = GLib.get_home_dir(), usePath = true} = {}) {
    const found = usePath ? GLib.find_program_in_path(name) : null;
    if (found)
        return found;
    for (const directory of ['.local/bin', '.cargo/bin', '.npm-global/bin', '.volta/bin', '.asdf/shims',
        '.local/share/mise/shims', '.bun/bin']) {
        const path = executable(join(home, directory, name));
        if (path)
            return path;
    }
    for (const [directory, suffix] of [
        ['.local/share/fnm/node-versions', ['installation', 'bin']],
        ['.nvm/versions/node', ['bin']],
        ['.local/share/mise/installs/node', ['bin']],
        ['.asdf/installs/nodejs', ['bin']],
    ]) {
        const path = versionedCommand(join(home, directory), suffix, name);
        if (path)
            return path;
    }
    const error = new Error(`${name} is not installed`);
    error.code = 'NOT_FOUND';
    throw error;
}

export function nodeCli(name, args = [], options = {}) {
    const command = findCommand(name, options);
    const runtime = executable(join(GLib.path_get_dirname(command), 'node'));
    return runtime ? [runtime, command, ...args] : [command, ...args];
}

export function stateDirectory() {
    return join(GLib.get_user_state_dir(), 'freeby');
}

export function cacheDirectory() {
    return join(GLib.get_user_cache_dir(), 'freeby');
}
