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

export function findCommand(name) {
    const found = GLib.find_program_in_path(name);
    if (found)
        return found;
    for (const directory of ['.local/bin', '.cargo/bin', '.npm-global/bin']) {
        const path = join(GLib.get_home_dir(), directory, name);
        if (GLib.file_test(path, GLib.FileTest.IS_EXECUTABLE))
            return path;
    }
    const error = new Error(`${name} is not installed`);
    error.code = 'NOT_FOUND';
    throw error;
}

export function stateDirectory() {
    return join(GLib.get_user_state_dir(), 'freeby');
}

export function cacheDirectory() {
    return join(GLib.get_user_cache_dir(), 'freeby');
}
