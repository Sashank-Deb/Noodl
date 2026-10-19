#!/usr/bin/env bash
# Builds both apps and assembles one static site (the Vercel output, also
# served locally by scripts/serve-dist.mjs):
#   dist/        ← marketing site (pre-rendered HTML, SEO)
#   dist/app/    ← the web app (static SPA, basePath /app)
# The AI function lives in api/ and is deployed by Vercel alongside dist/.
set -euo pipefail
cd "$(dirname "$0")/.."
# Local builds: pick up NEXT_PUBLIC_* from the repo-root .env.local (Vercel sets them itself).
if [ -f .env.local ] && [ -z "${VERCEL:-}" ]; then set -a; . ./.env.local; set +a; fi
pnpm --filter marketing build
pnpm --filter app build
rm -rf dist
mkdir -p dist
cp -r apps/marketing/out/. dist/
mkdir -p dist/app
cp -r apps/app/out/. dist/app/
echo "Built dist/ ($(du -sh dist | cut -f1))"
