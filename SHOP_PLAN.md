# Toumyou Fastener Shop Plan

This Cloudflare Pages project now includes a `/shop` storefront entry for cross-border fastener and industrial accessory sales.

## Recommended mature shop program

Recommended base: [medusajs/medusa](https://github.com/medusajs/medusa)

Why Medusa:

- mature open-source commerce platform with a large GitHub community;
- built-in admin for products, orders, customers, regions, and sales channels;
- flexible headless API that can power the existing Cloudflare storefront;
- payment-provider ecosystem suitable for Stripe-first rollout;
- easier fit than Saleor/Vendure for this project’s current JavaScript/Cloudflare direction.

## Architecture

- `toumyou-studio.pages.dev`: public brand site, articles, and `/shop` storefront on Cloudflare Pages.
- Medusa backend: separate commerce server for admin, catalog, orders, carts, checkout, and payment providers.
- Database/cache: Postgres and Redis required by the Medusa backend.
- Payments: Stripe Checkout first, then PayPal or bank-transfer flows if required for B2B buyers.

## Cloudflare environment variables

After the Medusa backend is deployed, add:

- `MEDUSA_BACKEND_URL`: public Medusa backend URL.
- `MEDUSA_PUBLISHABLE_KEY`: Medusa publishable API key for storefront requests.

For Stripe, prefer a restricted API key where possible and configure secrets only in the backend commerce system, not in public client code.

## Rollout steps

1. Deploy Medusa backend and admin.
2. Configure regions, currencies, shipping, product categories, and first fastener SKUs.
3. Configure Stripe Checkout in the commerce backend.
4. Add `MEDUSA_BACKEND_URL` and `MEDUSA_PUBLISHABLE_KEY` to Cloudflare Pages.
5. Replace current quote-oriented `/shop` cards with live product, cart, and checkout API calls.
6. Add legal pages: shipping, returns, privacy, terms, and business contact.

