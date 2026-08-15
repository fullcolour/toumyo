# Toumyou Payload CMS

This is the planned Payload CMS backend for Toumyou/Ximiao content and product management.

It is intentionally separate from the current storefront Worker:

- Payload manages `articles`, `products`, and `media`.
- The existing storefront keeps Stripe Checkout, cart, customers, and orders.
- The storefront can read Payload API when enabled in `/admin/settings`.
- If Payload is unavailable, the storefront falls back to the existing D1 data.

## Collections

- `articles`
- `products`
- `media`
- `users`

## Required Cloudflare resources

Create a separate D1 database for Payload, for example:

```bash
npx wrangler d1 create toumyou_payload_cms
```

Then replace `REPLACE_WITH_PAYLOAD_D1_DATABASE_ID` in `wrangler.jsonc`.

R2 uses the existing `image` bucket.

If deployment fails with Cloudflare API code `10042`, R2 has not been enabled for the selected Cloudflare account yet. Open **Cloudflare Dashboard > R2 Object Storage**, enable R2 for the `toumyou` account, then create or confirm the bucket named `image`.

## Required environment variables

Set a strong secret:

```bash
npx wrangler secret put PAYLOAD_SECRET
```

## Initialize the Payload D1 database

The first deployment needs the initial Payload tables in D1:

```bash
npm run d1:apply-schema
```

## Local validation

```bash
npm install
npx tsc --noEmit
npm run generate:types
npm run migrate:create
```

## Deploy flow

This folder is now structured as a Next + Payload + OpenNext Cloudflare app.

Before deploying:

1. Replace the D1 placeholder in `wrangler.jsonc`.
2. Set `PAYLOAD_SECRET`.
3. Run `npm run d1:apply-schema` once for a fresh D1 database.
4. Run `npm run generate:types`.
5. Run `npm run build:cloudflare`.
6. Deploy with `npm run deploy`.

If local `next build` runs slowly on a desktop workspace, validate with `npx tsc --noEmit` and `npm run generate:types`, then run the production build in Cloudflare/CI. The CMS uses Next/OpenNext and can be heavy locally.

This project uses webpack for `next build` because Turbopack can be slow in the larger Codex workspace:

```bash
npm run build
npm run build:cloudflare
```

The guided deploy command checks Cloudflare login, D1 configuration, and `PAYLOAD_SECRET` before deploying:

```bash
npm run deploy:guide
```

You can also check R2 availability before a full deploy:

```bash
npm run r2:check
```

The guide pins the Cloudflare account to `toumyou` and writes Wrangler logs to `/tmp/toumyou-payload-wrangler.log` by default:

```bash
CLOUDFLARE_ACCOUNT_ID=1c9ff8f2024e236353e989faba3a9a24
WRANGLER_LOG_PATH=/tmp/toumyou-payload-wrangler.log
```

If `wrangler deploy --dry-run` reports a conflict with an outer `.wrangler/deploy/config.json`, run Wrangler from a clean checkout of this repository or remove the stale outer deploy config. The CMS project itself uses `payload-cms/wrangler.jsonc`.

Before production deployment, also replace the D1 placeholder in `wrangler.jsonc`:

```jsonc
"database_id": "REPLACE_WITH_PAYLOAD_D1_DATABASE_ID"
```

The old `wrangler.toml` format is intentionally not used; this app follows the current Cloudflare JSONC config structure.
6. Deploy the Payload CMS as a separate Cloudflare Worker, for example `cms.toumyou.com`.

After the Payload deployment is live:

1. Open the Payload admin URL.
2. Create the first admin user.
3. Add test articles and products.
4. In the storefront `/admin/settings`, set:
   - Payload API base URL: `https://cms.example.com/api`
   - Enable Payload articles
   - Enable Payload products

The storefront will then read Payload first and fall back to D1 when Payload is unavailable.
