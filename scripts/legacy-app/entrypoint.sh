#!/usr/bin/env bash
set -e
cd /var/www/html
# session save dir the FMSession handler needs (session.save_path=/tmp -> /tmp/fm)
mkdir -p /tmp/fm && chmod 1777 /tmp /tmp/fm
if [ ! -d vendor ]; then
  echo "[entrypoint] installing composer deps (first run)…"
  # the app's global auto_prepend_file chdir()s into application/ and breaks composer's
  # own PHP run -> disable it for this invocation only.
  php -d auto_prepend_file='' /usr/bin/composer install \
     --ignore-platform-reqs --no-scripts --no-dev --no-interaction --no-progress -d /var/www/html
fi
exec apache2-foreground
