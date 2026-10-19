#!/bin/bash
# Double-click on macOS to run noodl in development mode (hot reload).
#   Web app → http://localhost:3000/app/    Marketing site → http://localhost:3001/
#   AI function → http://localhost:4320/api/ai (needs GEMINI_API_KEY + Supabase in .env.local)
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 22+ is needed. Install it from https://nodejs.org (or: brew install node), then run this again."
  read -r -p "Press Enter to close." _; exit 1
fi
corepack enable >/dev/null 2>&1 || npm install -g pnpm
pnpm install || { read -r -p "Install failed. Press Enter to close." _; exit 1; }
[ -f .env.local ] && { set -a; . ./.env.local; set +a; }
export NEXT_PUBLIC_AI_ENDPOINT="${NEXT_PUBLIC_AI_ENDPOINT:-http://localhost:4320/api/ai}"
export AI_ALLOWED_ORIGINS="${AI_ALLOWED_ORIGINS:-http://localhost:3000}"
( sleep 6; open "http://localhost:3000/app/" ) &
PORT=4320 node scripts/serve-dist.mjs --api-only &
pnpm --filter marketing dev &
pnpm --filter app dev
