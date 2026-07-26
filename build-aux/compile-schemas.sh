#!/bin/sh
# Compile GSettings schemas during meson install.
# Called as: compile-schemas.sh <schemadir>

SCHEMADIR="$1"
if command -v glib-compile-schemas >/dev/null 2>&1; then
    glib-compile-schemas "$SCHEMADIR"
else
    echo "warning: glib-compile-schemas not found, skipping schema compilation"
fi
