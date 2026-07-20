#!/bin/sh
# Ensure the local dev database is reachable before `npm run dev`.
# Wired as the `predev` npm script so `npm run dev` self-heals after a reboot:
# starts OrbStack if the Docker daemon is down, then starts the `fm-new`
# MySQL container (the app DB — host port 3400, db `fm`). Idempotent + fail-safe:
# it never blocks the dev server (predev uses `|| true`), it just tries.

DB_CONTAINER=fm-new

# 0) Node version guard. Node 20 breaks esbuild's spawn on macOS 26 (EBADF spam);
#    Node 22+ is required. Warn loudly but don't block (nvm is shell-level).
NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "‼  You're on Node $(node -v). This project needs Node 22+ (Node 20 = 'spawn EBADF' on macOS 26)."
  echo "   Run:  nvm use 22   (then rerun npm run dev).  Node 22 is already your nvm default for new terminals."
fi

# 1) Docker daemon (OrbStack) up?
if ! docker info >/dev/null 2>&1; then
  echo "› Starting OrbStack (Docker daemon is down)…"
  orb start >/dev/null 2>&1 || open -a OrbStack >/dev/null 2>&1 || true
  i=0
  while [ $i -lt 30 ]; do
    docker info >/dev/null 2>&1 && break
    i=$((i+1)); sleep 1
  done
fi

if ! docker info >/dev/null 2>&1; then
  echo "⚠  Docker/OrbStack still not up — start OrbStack manually, then rerun."
  exit 0
fi

# 2) DB container running?
if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$DB_CONTAINER"; then
  echo "› Starting MySQL container ($DB_CONTAINER)…"
  docker start "$DB_CONTAINER" >/dev/null 2>&1 || {
    echo "⚠  Could not start $DB_CONTAINER (does it exist? \`docker ps -a\`)."; exit 0;
  }
fi

# 3) Wait for mysqld inside the container to accept connections.
i=0
while [ $i -lt 25 ]; do
  if docker exec "$DB_CONTAINER" mysqladmin ping -uroot -pfmroot 2>/dev/null | grep -q "alive"; then
    echo "✓ Database ready (fm-new :3400)."
    exit 0
  fi
  i=$((i+1)); sleep 1
done
echo "⚠  $DB_CONTAINER is up but mysqld didn't answer in time — the app may 500 until it does."
exit 0
