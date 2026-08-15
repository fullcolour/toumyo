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

Then replace `REPLACE_WITH_PAYLOAD_D1_DATABASE_ID` in `wrangler.toml`.

R2 uses the existing `image` bucket.

## Required environment variables

Set a strong secret:

```bash
npx wrangler secret put PAYLOAD_SECRET
```

## Local validation

```bash
npm install
npm run generate:types
npm run migrate:create
npm run migrate
```

## Deploy flow

This folder contains the Payload config and collections for the CMS service. For production, use Payload's Cloudflare/D1 template or a Next/OpenNext Cloudflare Worker build, then copy this `payload.config.ts` and `src/collections` folder into that app.

Before deploying:

1. Replace the D1 placeholder in `wrangler.toml`.
2. Set `PAYLOAD_SECRET`.
3. Ensure the Worker build output path in `wrangler.toml` matches the actual Next/OpenNext output.
4. Deploy the Payload CMS as a separate Cloudflare Worker, for example `cms.toumyou.com`.

After the Payload deployment is live:

1. Open the Payload admin URL.
2. Create the first admin user.
3. Add test articles and products.
4. In the storefront `/admin/settings`, set:
   - Payload API base URL: `https://cms.example.com/api`
   - Enable Payload articles
   - Enable Payload products

The storefront will then read Payload first and fall back to D1 when Payload is unavailable.
