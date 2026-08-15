# Toumyou Studio

Cloudflare Pages site for Toumyou LLC.

The site is built as a Cloudflare Pages Worker in `_worker.js`. It includes:

- English-first public homepage
- Portfolio, history, team, and contact content migrated from the original site
- VPN content removed
- `/shop` fastener and industrial accessory storefront entry
- Product admin at `/admin/products`
- Product pages and Stripe Checkout handoff
- Articles, products, orders, customers, and settings backed by Cloudflare D1
- Image media library backed by Cloudflare R2 through `/admin/media`
- `robots.txt` and `sitemap.xml` for search engine and AI crawler discovery

## Cloudflare Pages build settings

Use these settings when connecting this repository to Cloudflare Pages:

- Framework preset: None
- Build command: leave empty
- Build output directory: `/`
- Production branch: `main`

## Runtime bindings

Configure these in Cloudflare Pages project settings:

- D1 binding: `DB`
- R2 binding: `ASSETS`
- Environment variable: `ADMIN_PASSWORD`
- Environment variable: `ADMIN_SESSION_SECRET`
- Optional shop variable: `MEDUSA_BACKEND_URL`
- Optional shop variable: `MEDUSA_PUBLISHABLE_KEY`
- Optional payment secret: `STRIPE_RESTRICTED_KEY` (preferred) or `STRIPE_SECRET_KEY`

Do not commit secret values to GitHub.

## Shop operations

- Open `/admin/products` with the existing admin password.
- Add products with name, SKU, category, material, size, price, inventory, images, and status.
- Upload product images in `/admin/media`, then use the returned R2 media URLs as the main image and gallery image URLs.
- Publish a product to show it on `/shop`.
- Enable checkout per product only after Stripe is configured.
- Use Stripe-hosted Checkout for card and wallet payments. Do not store card details in this project.

## CMS direction

Production now uses the lightweight Cloudflare-native CMS built into `_worker.js`: D1 for structured content and commerce records, R2 for media, and Stripe for payment. The experimental Payload CMS package is deferred because deploying Payload on Cloudflare Workers Free can exceed the Worker bundle-size limit. Keep using `/admin`, `/admin/products`, `/admin/media`, `/admin/orders`, `/admin/customers`, and `/admin/settings` for day-to-day operations.

## Commerce direction

See `SHOP_PLAN.md`. The recommended mature open-source shop backend is Medusa. This Pages site should remain the public storefront, while Medusa handles catalog, admin, orders, carts, checkout, and payment configuration.
