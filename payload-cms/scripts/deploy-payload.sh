#!/usr/bin/env bash
set -euo pipefail

export CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-9bbf527fc892e63a600961322cc8cb39}"
export WRANGLER_LOG_PATH="${WRANGLER_LOG_PATH:-/tmp/toumyou-payload-wrangler.log}"

if ! npx wrangler whoami >/dev/null; then
  echo "Cloudflare Wrangler is not logged in."
  echo "Run: npx wrangler login"
  echo "Or set CLOUDFLARE_API_TOKEN with Workers, D1, R2, and DNS permissions."
  echo "If Wrangler reports DNS errors, check that this terminal can resolve api.cloudflare.com."
  exit 1
fi

if grep -q "REPLACE_WITH_.*PAYLOAD_D1_DATABASE_ID" wrangler.jsonc; then
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

if ! npx wrangler r2 bucket list >/tmp/toumyou-payload-r2-check.log 2>&1; then
  echo "Cloudflare R2 is not available for this account yet."
  echo "Make sure Wrangler is logged into the sunflyer Cloudflare account."
  echo "Open Cloudflare Dashboard > R2 Object Storage and confirm R2 for the sunflyer account."
  echo "Then create or confirm the bucket named: image"
  echo "R2 check output:"
  cat /tmp/toumyou-payload-r2-check.log
  exit 1
fi

npm run check
npm run build:cloudflare
npx opennextjs-cloudflare deploy --config wrangler.jsonc
