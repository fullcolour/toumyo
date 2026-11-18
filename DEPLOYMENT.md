# Deployment notes

Production project: Cloudflare Pages `toumyou-studio` (domains `toumyou.com`, `toumyou-studio.pages.dev`).

Publish only the worker, never the repository root (it contains docs and SQL):

```sh
mkdir -p /tmp/toumyou-dist && cp _worker.js /tmp/toumyou-dist/
node --check /tmp/toumyou-dist/_worker.js
# preview first
npx wrangler pages deploy /tmp/toumyou-dist --project-name toumyou-studio --branch preview
# then production
npx wrangler pages deploy /tmp/toumyou-dist --project-name toumyou-studio --branch main
```

Preview deployments (`*.toumyou-studio.pages.dev`) render normally and send `X-Robots-Tag: noindex`; `toumyou-studio.pages.dev` itself redirects to `https://toumyou.com`.

The project is still linked to GitHub (`fullcolour/toumyo`, branch `main`), so pushing to `main` also triggers a build. Keep the repository and the direct upload in sync.
