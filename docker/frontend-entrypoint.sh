#!/bin/sh
set -e

PLACEHOLDER="http://localhost:3001/api"
ACTUAL="${NEXT_PUBLIC_API_URL:-$PLACEHOLDER}"

if [ "$ACTUAL" != "$PLACEHOLDER" ]; then
  echo "Patching API URL: $PLACEHOLDER -> $ACTUAL"
  find /app/apps/web/.next -type f -name "*.js" | xargs sed -i "s|$PLACEHOLDER|$ACTUAL|g" 2>/dev/null || true
  # Also patch the server-side chunks
  find /app -maxdepth 4 -type f -name "*.js" | xargs sed -i "s|$PLACEHOLDER|$ACTUAL|g" 2>/dev/null || true
  echo "Patching complete."
fi

exec node apps/web/server.js
