# White Leaf Roofing — Production Website

Static HTML site for whiteleafroofing.com, built for conversions + local SEO + on-demand scaling (city pages, SKAG landing pages, blog posts). Design: "Iron & Gold" (chosen by Tyler 2026-07-05). Deploys to Vercel.

## Layout
```
partials/     header.html, footer.html, callbar.html (shared chrome, injected at build)
src/          page sources, one folder per URL (src/chandler/index.html -> /chandler/)
assets/       css, fonts (self-hosted woff2), img (real photos + Higgsfield-generated heroes), js
api/lead.js   serverless lead endpoint -> emails andy@wlcbuilt.com + tycoles@gmail.com via Resend
build.py      assembles src + partials -> public/   (run: python build.py)
vercel.json   trailing slashes, cache headers, ALL 301 redirects from the old WordPress site
public/       build output (what Vercel serves) — never edit by hand
```

## Rules for adding pages (Claude reads this)
1. Copy an existing src page as the shell; keep `<!-- @header -->`, `<!-- @footer -->`, `<!-- @callbar -->` markers.
2. One primary keyword per page; exact-match `<title>` ~60 chars; unique meta description; canonical URL.
3. City pages follow the Chandler exemplar (`src/chandler/index.html`): zips, real neighborhoods, city FAQ (+ FAQPage JSON-LD), local reviews, links to sibling city/service pages.
4. Copy rules: Andy's first-person voice, NO em dashes, no fake urgency/stats/warranty claims. Free inspection by Andy personally is the offer. Repairs "$800 to $4,000" is the only price range we state (from the real site).
5. Real photos of Andy/crew only; Higgsfield-generated imagery allowed for homes/scenes (photoreal prompts, never Andy).
6. New blog posts under /blog/; migrated posts keep their original root slugs.
7. After adding a page: add it to the sitemap (todo: generate in build.py), rebuild, commit public/.

## Deploy (per agency static-site-deploy pattern)
1. GitHub repo (public or Vercel-linked), root = this folder. `python build.py` before commit.
2. Vercel project: output dir `public`, no build command needed (or set `python build.py` with Python runtime).
3. Env var `RESEND_API_KEY` (Resend account, domain whiteleafroofing.com verified — see workflows/website-rebuild/outputs/lead-capture-system.md).
4. Domain cutover LAST: verify redirects with the old sitemap URL list, re-verify GSC, submit new sitemap.

## Status (2026-07-05)
Built: homepage, /free-estimate/, /contact/, /thank-you/, /chandler/ (city hub exemplar).
Next: /chandler/roof-repair|roof-replacement|roof-inspection/, full /gilbert/ stack, /why-andy/, service pillars (repair, replacement, underlayment, emergency, foam), /cost-of-roof-replacement-arizona/, remaining cities, /faq/, /reviews/, /service-areas/, blog migration, sitemap generation, GTM/GA4 snippet.
