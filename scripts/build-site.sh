#!/usr/bin/env bash
# Builds both apps and assembles one static site for Firebase Hosting:
#   dist/        ← marketing site (pre-rendered HTML, SEO)
#   dist/app/    ← the web app (static SPA, basePath /app)
set -euo pipefail
cd "$(dirname "$0")/.."
pnpm --filter marketing build
pnpm --filter app build
rm -rf dist
mkdir -p dist
cp -r apps/marketing/out/. dist/
mkdir -p dist/app
cp -r apps/app/out/. dist/app/
echo "Built dist/ ($(du -sh dist | cut -f1))"
