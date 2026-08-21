# Toumyou Media Operations

Cloudflare Pages Worker for the Toumyou and Ximiaokeji sites.

The site is built as a Cloudflare Pages Worker in `_worker.js`. It includes:

- `toumyou.com`: media operations, content growth, short-video production, website production, software development, traffic acquisition, and commercial IP growth
- `ximiaokeji.com`: Chinese fastener and industrial accessory storefront
- Toumyou keeps `/shop`, `/cart`, `/account`, `/login`, Stripe checkout, and the original test product link as a paid digital-product area named Japanese files
- Ximiaokeji `/shop` fastener storefront and quote flow
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

## Public site direction

- Toumyou public pages should not use fastener, anchor, hardware, or procurement positioning.
- Toumyou main navigation focuses on media operations and growth services; `/shop` remains available for Japanese files and paid digital products with the original cart and payment flow.
- Toumyou articles include the built-in media-operations articles plus existing published D1 articles.
- Toumyou sitemap includes `/`, `/services`, `/shop`, product URLs, `/articles`, the built-in media-operations articles, and existing published D1 articles.
- Ximiaokeji keeps the fastener storefront, product catalog, cart, Stripe checkout, and quote flow.

## Ximiaokeji shop operations

- Open `/admin/products` with the existing admin password.
- Add products with name, SKU, category, material, size, price, inventory, images, and status.
- Upload product images in `/admin/media`, then use the returned R2 media URLs as the main image and gallery image URLs.
- Publish a product to show it on `/shop`.
- Enable checkout per product only after Stripe is configured.
- Use Stripe-hosted Checkout for card and wallet payments. Do not store card details in this project.

## CMS direction

Production now uses the lightweight Cloudflare-native CMS built into `_worker.js`: D1 for structured content and commerce records, R2 for media, and Stripe for payment. The experimental Payload CMS package is deferred because deploying Payload on Cloudflare Workers Free can exceed the Worker bundle-size limit. Keep using `/admin`, `/admin/products`, `/admin/media`, `/admin/orders`, `/admin/customers`, and `/admin/settings` for day-to-day operations.

## Commerce direction

See `SHOP_PLAN.md` for the deferred mature shop backend direction. Ximiaokeji remains the fastener storefront. Toumyou keeps a lighter commerce surface for Japanese files and paid digital products, preserving the original test link, cart, account, and Stripe payment flow.
