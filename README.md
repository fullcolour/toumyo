# Toumyou (東緲合同会社)

Cloudflare Pages Worker for https://toumyou.com — the official site of 東緲合同会社, an Osaka-based IT company for website production, web apps and business systems, WeChat mini programs, UI/UX and brand design, and IT operations.

Everything (public site, customer account, cart, Stripe checkout, admin) lives in `_worker.js`.

## Languages

The public site is trilingual, Japanese by default:

| Language | Path prefix | Example |
| --- | --- | --- |
| Japanese (default) | none | `/services` |
| Simplified Chinese | `/zh` | `/zh/services` |
| English | `/en` | `/en/services` |

- The language switcher sits at the top right of every page and links to the same page in the other language.
- Every public page outputs `hreflang` alternates (plus `x-default` → Japanese); `sitemap.xml` lists all three versions.
- Interface copy lives in `UI`; service, process, FAQ, product, and article copy each have `ja` / `zh` / `en` entries (`SERVICE_LINES`, `TOUMYOU_SERVICE_PRODUCTS[].i18n`, `SITE_ARTICLES[].i18n`, …). Add new copy to all three.
- The chosen language is remembered in the `toumyou_lang` cookie so server redirects (login, cart, Stripe return URLs, logout) land in the right language.
- Articles and products created in the admin are single-language; they appear in every language listing and their canonical URL is the Japanese path.

## Public routes

`/`, `/services`, `/about`, `/contact`, `/shop`, `/shop/products/:slug`, `/articles`, `/articles/:slug`, `/login`, `/account`, `/cart`, `/shop/success` — each also under `/zh` and `/en`.

Admin (English UI, root only): `/admin`, `/admin/products`, `/admin/orders`, `/admin/customers`, `/admin/media`, `/admin/settings`, `/admin/support`.

Retired URLs (old media-operations articles and service slugs, `/digital`) return 301 redirects.

## Runtime bindings

- D1: `DB` (`toumyou_db`)
- R2: `PRODUCT_MEDIA` (bucket `image`)
- Secrets: `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `CUSTOMER_SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `STRIPE_SECRET_KEY` (or `STRIPE_RESTRICTED_KEY`), `STRIPE_WEBHOOK_SECRET`, `DISCORD_WEBHOOK_URL`

Do not commit secret values.

## Shop

- Built-in service orders are defined in `TOUMYOU_SERVICE_PRODUCTS`. The website and system diagnostic (`/shop/products/ewe`) can be bought online; the others start with a quote.
- Products published in `/admin/products` also appear in the shop.
- Stripe Checkout uses the visitor's language. Shipping options and address collection are only added for physical products (`weight_grams > 0`).
- Inquiry forms post to `/api/quote`, are stored in the `inquiries` table, and are forwarded to Discord when configured.

## Deploy

See `DEPLOYMENT.md`. Only the worker file is published.
