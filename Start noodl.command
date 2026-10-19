#!/bin/bash
# Double-click on macOS to run noodl locally (production build) at http://localhost:4320
# Pass --rebuild (or delete dist/) to rebuild from source first.
cd "$(dirname "$0")" || exit 1
PORT="${PORT:-4320}"

need_build=false
[ ! -f dist/app/index.html ] && need_build=true
[ "$1" = "--rebuild" ] && need_build=true

if $need_build; then
  if ! command -v node >/dev/null 2>&1; then
    echo "Node.js 22+ is needed to build noodl. Install it from https://nodejs.org (or: brew install node), then run this again."
    read -r -p "Press Enter to close." _; exit 1
  fi
  echo "Building noodl (first run takes a minute)…"
  corepack enable >/dev/null 2>&1 || npm install -g pnpm
  pnpm install || { read -r -p "Install failed. Press Enter to close." _; exit 1; }
  ./scripts/build-site.sh || { read -r -p "Build failed. Press Enter to close." _; exit 1; }
fi

( sleep 1.5; open "http://localhost:$PORT/app/" ) &
if command -v node >/dev/null 2>&1; then
  PORT="$PORT" node scripts/serve-dist.mjs dist
else
  echo "Serving with Python (install Node.js for the exact Vercel-like routing and the AI function)."
  echo "  Marketing site → http://localhost:$PORT/   Web app → http://localhost:$PORT/app/"
  cd dist && python3 -m http.server "$PORT"
fi
