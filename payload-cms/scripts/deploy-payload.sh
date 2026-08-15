#!/usr/bin/env bash
set -euo pipefail

export CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-1c9ff8f2024e236353e989faba3a9a24}"
export WRANGLER_LOG_PATH="${WRANGLER_LOG_PATH:-/tmp/toumyou-payload-wrangler.log}"

if ! npx wrangler whoami >/dev/null; then
  echo "Cloudflare Wrangler is not logged in."
  echo "Run: npx wrangler login"
  echo "Or set CLOUDFLARE_API_TOKEN with Workers, D1, R2, and DNS permissions."
  echo "If Wrangler reports DNS errors, check that this terminal can resolve api.cloudflare.com."
  exit 1
fi

if grep -q "REPLACE_WITH_PAYLOAD_D1_DATABASE_ID" wrangler.jsonc; then
  echo "D1 database_id is still a placeholder in wrangler.jsonc."
  echo "Create/find the database first:"
  echo "  CLOUDFLARE_ACCOUNT_ID=${CLOUDFLARE_ACCOUNT_ID} npx wrangler d1 create toumyou_payload_cms"
  echo "Then paste the returned database_id into wrangler.jsonc."
  exit 1
fi

if ! npx wrangler secret list | grep -q "PAYLOAD_SECRET"; then
  echo "PAYLOAD_SECRET is not configured yet."
  echo "Run: npx wrangler secret put PAYLOAD_SECRET"
  exit 1
fi

npm run check
npm run build:cloudflare
npx opennextjs-cloudflare deploy
