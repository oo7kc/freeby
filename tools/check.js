import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {resolve, dirname, join} from 'node:path';
import {execFileSync} from 'node:child_process';

function walk(directory) {
    return readdirSync(directory, {withFileTypes: true}).flatMap(entry => entry.isDirectory()
        ? walk(join(directory, entry.name)) : [join(directory, entry.name)]);
}
const files = ['extension.js', 'prefs.js', ...walk('src'), ...walk('tests'), ...walk('tools')].filter(file => file.endsWith('.js'));
for (const file of files) {
    const text = readFileSync(file, 'utf8');
    execFileSync(process.execPath, ['--check', file], {stdio: 'pipe'});
    if (!text.endsWith('\n') || /[ \t]+$/m.test(text))
        throw new Error(`${file}: trailing whitespace or missing final newline`);
    for (const [, target] of text.matchAll(/from ['"]([.][^'"]+)['"]/g)) {
        if (!existsSync(resolve(dirname(file), target)))
            throw new Error(`${file}: missing import ${target}`);
    }
}
const metadata = JSON.parse(readFileSync('metadata.json', 'utf8'));
if (metadata.uuid !== 'freeby@kelvin.local')
    throw new Error('Extension identity changed without a migration');
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
if (!readFileSync('meson.build', 'utf8').includes(`version: '${version}'`))
    throw new Error('Meson and package versions differ');
execFileSync('glib-compile-schemas', ['--strict', '--dry-run', 'schemas']);
console.log(`Syntax, imports, formatting, release metadata and schema checks passed (${files.length} JavaScript files).`);
