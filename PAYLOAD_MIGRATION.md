# Payload CMS migration plan — deferred

Payload CMS was evaluated for managing `articles`, `products`, and media while keeping the existing Cloudflare D1/R2 storefront, Stripe Checkout, cart, customers, and orders stable.

Decision: defer Payload for production. The generated Payload/OpenNext Worker can exceed Cloudflare Workers Free bundle-size limits, so the production site now uses the lightweight D1 + R2 CMS already built into `_worker.js`.

## Current production source

- Articles: Cloudflare D1 `posts`
- Products: Cloudflare D1 `products`
- Media: Cloudflare R2 via `/media/*`
- Checkout: existing Stripe Checkout endpoints
- Cart/customers/orders: existing D1 tables and Google login

## Deferred target source

- Payload collection: `articles`
- Payload collection: `products`
- Payload upload collection: `media`, backed by R2
- Frontend read mode, if revived later:
  - Keep D1 as the stable primary source during migration
  - Add a deliberate feature flag only after the Payload deployment target is known
  - Keep a D1 fallback until content parity is verified

## Implemented but not production-enabled

- Payload API normalization helpers for articles and products
- `payload-cms/` config package with `articles`, `products`, `media`, and `users` collections

## Production behavior after deferral

- Frontend articles read Cloudflare D1 `posts`
- Frontend products read Cloudflare D1 `products`
- Media is uploaded and served from Cloudflare R2 through `/admin/media` and `/media/*`
- `/admin/settings` shows the lightweight CMS status and no longer exposes Payload switches
- Stripe Checkout, cart, customer login, orders, and webhook handling remain unchanged

## Historical implementation notes

- Product snapshot sync into D1 before cart/Stripe Checkout, so existing cart/order tables keep working

## Collections

### articles

- title
- slug
- excerpt
- body
- category
- status
- publishedAt
- coverImage
- seoTitle
- seoDescription

### products

- name
- slug
- sku
- excerpt
- description
- category
- material
- size
- specs
- packageInfo
- leadTime
- shippingNote
- moq
- weightGrams
- images
- priceCents
- currency
- inventory
- status
- allowCheckout

## What stays outside Payload

- Stripe secret keys and Checkout session creation
- Customer login/session cookies
- Cart table
- Orders table and Stripe webhook updates
- Fulfillment status and payment record history

This keeps commercial reliability separate from content editing.
