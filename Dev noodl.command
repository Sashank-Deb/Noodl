#!/bin/bash
# Double-click on macOS to run noodl in development mode (hot reload).
#   Web app → http://localhost:3000/app/    Marketing site → http://localhost:3001/
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 22+ is needed. Install it from https://nodejs.org (or: brew install node), then run this again."
  read -r -p "Press Enter to close." _; exit 1
fi
corepack enable >/dev/null 2>&1 || npm install -g pnpm
pnpm install || { read -r -p "Install failed. Press Enter to close." _; exit 1; }
( sleep 6; open "http://localhost:3000/app/" ) &
pnpm --filter marketing dev &
pnpm --filter app dev
