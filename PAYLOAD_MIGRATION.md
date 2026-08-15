# Payload CMS migration plan

Goal: use Payload CMS for `articles`, `products`, and media management while keeping the existing Cloudflare D1/R2 storefront, Stripe Checkout, cart, customers, and orders stable.

## Current production source

- Articles: Cloudflare D1 `posts`
- Products: Cloudflare D1 `products`
- Media: Cloudflare R2 via `/media/*`
- Checkout: existing Stripe Checkout endpoints
- Cart/customers/orders: existing D1 tables and Google login

## Target source

- Payload collection: `articles`
- Payload collection: `products`
- Payload upload collection: `media`, backed by R2
- Frontend read mode:
  - Phase 1: D1 remains primary, Payload API support is available but disabled by default
  - Phase 2: frontend reads Payload API directly when `payload_articles_enabled` and `payload_products_enabled` are enabled in `/admin/settings`
  - If Payload is unavailable or returns no documents, the storefront falls back to D1

## Implemented in this repository

- Storefront Payload API reader for articles and products
- `/admin/settings` switches for Payload article/product reads
- Product snapshot sync into D1 before cart/Stripe Checkout, so existing cart/order tables keep working
- `payload-cms/` config package with `articles`, `products`, `media`, and `users` collections

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
