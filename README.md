# Toumyou Studio

Cloudflare Pages site for Toumyou LLC.

The site is built as a Cloudflare Pages Worker in `_worker.js`. It includes:

- English-first public homepage
- Portfolio, history, team, and contact content migrated from the original site
- VPN content removed
- `/shop` fastener and industrial accessory storefront entry
- Product admin at `/admin/products`
- Product pages and Stripe Checkout handoff
- Articles and admin routes backed by Cloudflare D1
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
- Environment variable: `ADMIN_PASSWORD`
- Environment variable: `ADMIN_SESSION_SECRET`
- Optional shop variable: `MEDUSA_BACKEND_URL`
- Optional shop variable: `MEDUSA_PUBLISHABLE_KEY`
- Optional payment secret: `STRIPE_RESTRICTED_KEY` (preferred) or `STRIPE_SECRET_KEY`

Do not commit secret values to GitHub.

## Shop operations

- Open `/admin/products` with the existing admin password.
- Add products with name, SKU, category, material, size, price, inventory, images, and status.
- Use the main image URL plus gallery image URLs, one URL per line. Upload the actual image files to Cloudflare Images, R2, or another CDN first.
- Publish a product to show it on `/shop`.
- Enable checkout per product only after Stripe is configured.
- Use Stripe-hosted Checkout for card and wallet payments. Do not store card details in this project.

## Commerce direction

See `SHOP_PLAN.md`. The recommended mature open-source shop backend is Medusa. This Pages site should remain the public storefront, while Medusa handles catalog, admin, orders, carts, checkout, and payment configuration.
