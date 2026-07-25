project('ai-usage', version: '1', license: 'MIT',
  default_options: ['warning_level=0'])

uuid = 'ai-usage@kelvin.local'
prefix = get_option('prefix')
extdir = join_paths(prefix, 'share', 'gnome-shell', 'extensions', uuid)
bindir = join_paths(prefix, 'bin')

install_data('extension.js', 'metadata.json', 'stylesheet.css',
  install_dir: extdir)

install_data('scripts/ai-usage.sh', 'scripts/copilot-setup.sh',
  install_dir: bindir,
  install_mode: 'rwxr-xr-x')
