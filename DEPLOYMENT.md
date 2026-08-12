# Deployment notes

This repository is intended to be connected to Cloudflare Pages.

Cloudflare should deploy from the repository root. The root contains `_worker.js`, which Cloudflare Pages treats as the Pages Worker entry point.

After connecting the repository, keep the existing production project settings aligned with:

- Project name: `toumyou-studio`
- Production branch: `main`
- D1 binding name: `DB`
- Public URL: `https://toumyou-studio.pages.dev`

The current direct-upload production deployment was validated at:

https://toumyou-studio.pages.dev

When GitHub auto-deploy is connected, push changes to `main` to trigger new Cloudflare builds.
