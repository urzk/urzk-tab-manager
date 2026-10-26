#!/usr/bin/env bash
# Regenerate the store screenshots (1280x800, en + ja) from the mock demo page
# with headless Chrome. Usage: scripts/screenshots.sh
set -euo pipefail

cd "$(dirname "$0")/.."
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
PORT=4174
OUT=store/screenshots

pnpm build:mock >/dev/null
node_modules/.bin/vite preview --config vite.mock.config.ts --port "$PORT" --strictPort \
  >/dev/null 2>&1 &
SERVER=$!
trap 'kill "$SERVER" 2>/dev/null || true' EXIT

for _ in $(seq 50); do
  curl -sf "http://localhost:$PORT/" >/dev/null && break
  sleep 0.2
done

# shot number -> query string (lang is appended)
shots=(
  "1|"
  "2|expand=all&hover=4"
  "3|expand=all&q=site:example.org"
)

for lang in en ja; do
  for s in "${shots[@]}"; do
    n="${s%%|*}"
    q="${s#*|}"
    url="http://localhost:$PORT/?lang=$lang${q:+&$q}"
    "$CHROME" --headless=new --disable-gpu --hide-scrollbars \
      --window-size=1280,800 --virtual-time-budget=2000 \
      --screenshot="$OUT/$lang-$n.png" "$url" >/dev/null 2>&1
    echo "$OUT/$lang-$n.png <- $url"
  done
done
