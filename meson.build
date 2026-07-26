project('freeby', version: '1.0.2', license: 'MIT',
  meson_version: '>= 0.56.0',
  default_options: ['warning_level=0'])

uuid = 'freeby@kelvin.local'
prefix = get_option('prefix')
extdir = join_paths(prefix, 'share', 'gnome-shell', 'extensions', uuid)
bindir = join_paths(prefix, 'bin')
schemadir = join_paths(prefix, 'share', 'glib-2.0', 'schemas')

install_data('extension.js', 'indicator.js', 'prefs.js', 'metadata.json', 'stylesheet.css',
  install_dir: extdir)

install_data('scripts/freeby.sh', 'scripts/copilot-setup.sh',
  install_dir: bindir,
  install_mode: 'rwxr-xr-x')

install_data('schemas/org.gnome.shell.extensions.freeby.gschema.xml',
  install_dir: schemadir)

meson.add_install_script('build-aux/compile-schemas.sh', schemadir)
