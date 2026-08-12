# Toumyou Studio

Cloudflare Pages site for Toumyou LLC.

The site is built as a Cloudflare Pages Worker in `_worker.js`. It includes:

- English-first public homepage
- Portfolio, history, team, and contact content migrated from the original site
- VPN content removed
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

Do not commit secret values to GitHub.
