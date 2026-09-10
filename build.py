#!/usr/bin/env python3
"""White Leaf Roofing static site builder.

Assembles pages in src/ with shared partials, writes the deployable site to public/.

Markers inside src pages:
    <!-- @header -->   -> partials/header.html
    <!-- @footer -->   -> partials/footer.html
    <!-- @callbar -->  -> partials/callbar.html

Usage:  python build.py
"""
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).parent
SRC, PARTIALS, PUBLIC, ASSETS = ROOT / "src", ROOT / "partials", ROOT / "public", ROOT / "assets"

MARKERS = {
    "<!-- @header -->": "header.html",
    "<!-- @footer -->": "footer.html",
    "<!-- @callbar -->": "callbar.html",
}

# The on-page callback form (partials/callback.html). Parameterised rather than a plain
# marker, because three things vary per page:
#   {{PAGE}}         the page's own URL, auto-filled from its path so the lead email always
#                    names the right page. Never write this by hand.
#   {{PLACEHOLDER}}  the textarea prompt. Override for replacement-flavoured pages.
#   {{STEP2}}        step 02 of "what happens when you reach out".
# Usage in a src page:
#   <!-- @callback -->
#   <!-- @callback placeholder="Getting bids on a replacement..." step2="I walk the roof..." -->
CALLBACK_MARKER = re.compile(r"<!--\s*@callback(?P<args>[^>]*?)-->")
CALLBACK_ARG = re.compile(r'(?P<key>\w+)="(?P<val>[^"]*)"')
CALLBACK_DEFAULTS = {
    "placeholder": "Leak, broken tiles, getting bids on a replacement, not sure...",
    "step2": "I come out and inspect the roof myself. It costs nothing.",
}

# Turnstile is per-page, not global. Without it the widget never renders and /api/lead/
# rejects the submission, so the form looks fine and silently loses every lead. Injected
# automatically for any page carrying a lead form, rather than relied on being remembered.
TURNSTILE = '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>'

# Google Tag Manager (same container as the old WordPress site: GTM Kit)
GTM_ID = "GTM-M5CC3JS"
GTM_HEAD = (
    '<link rel="preconnect" href="https://www.googletagmanager.com" crossorigin>'
    "<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),"
    "event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?"
    "'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;"
    "f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','" + GTM_ID + "');</script>"
)
GTM_BODY = (
    f'<noscript><iframe src="https://www.googletagmanager.com/ns.html?id={GTM_ID}" '
    'height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>'
)

# Google Ads tag (gtag.js), loaded directly — NOT via the GTM container, so conversion
# tracking never depends on container publishes. Do not also add AW-11135708302 inside
# GTM or conversions will double-count. Website-call number swap lives in site.js.
AW_ID = "AW-11135708302"
GTAG_HEAD = (
    f'<script async src="https://www.googletagmanager.com/gtag/js?id={AW_ID}"></script>'
    "<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}"
    f"gtag('js',new Date());gtag('config','{AW_ID}');</script>"
)


def asset_version(path: Path) -> str:
    import hashlib
    return hashlib.md5(path.read_bytes()).hexdigest()[:8]


def page_url(page: Path) -> str:
    """The site-relative URL a src file will be served at. src/gilbert/index.html -> /gilbert/"""
    rel = page.relative_to(SRC)
    if rel.name != "index.html":
        return f"/{rel.as_posix()}"
    return "/" if rel.parent.as_posix() == "." else f"/{rel.parent.as_posix()}/"


def expand_callback(html: str, template: str, url: str) -> str:
    """Replace every @callback marker with the callback form, filling its placeholders."""
    def render(match: "re.Match") -> str:
        args = dict(CALLBACK_DEFAULTS)
        for arg in CALLBACK_ARG.finditer(match.group("args")):
            key = arg.group("key")
            if key not in CALLBACK_DEFAULTS:
                raise SystemExit(f"Unknown @callback argument {key!r} (expected {sorted(CALLBACK_DEFAULTS)})")
            args[key] = arg.group("val")
        return (template
                .replace("{{PAGE}}", url)
                .replace("{{PLACEHOLDER}}", args["placeholder"])
                .replace("{{STEP2}}", args["step2"]))
    return CALLBACK_MARKER.sub(render, html)


def main() -> None:
    partials = {m: (PARTIALS / f).read_text(encoding="utf-8") for m, f in MARKERS.items()}

    # Cache-busting: assets are served immutable, so mutated js needs a versioned URL.
    # CSS is small and render-blocking, so we inline it instead (better FCP/LCP).
    css_text = (ASSETS / "css" / "main.css").read_text(encoding="utf-8")
    js_v = asset_version(ASSETS / "js" / "site.js")

    if PUBLIC.exists():
        shutil.rmtree(PUBLIC)
    PUBLIC.mkdir()

    callback_tpl = (PARTIALS / "callback.html").read_text(encoding="utf-8").rstrip("\n")

    pages = sorted(SRC.rglob("*.html"))
    for page in pages:
        html = page.read_text(encoding="utf-8")
        html = expand_callback(html, callback_tpl, page_url(page))
        for marker, content in partials.items():
            html = html.replace(marker, content)
        # The private leads dashboard is a tool, not a marketing page: no GTM,
        # and it stays out of the sitemap (below).
        top = page.relative_to(SRC).parts[0]
        if top != "leads":
            html = html.replace("<head>", "<head>\n" + GTM_HEAD + GTAG_HEAD, 1)
            html = html.replace("<body>", "<body>\n" + GTM_BODY, 1)
        html = html.replace('<link rel="stylesheet" href="/assets/css/main.css">', "<style>" + css_text + "</style>")
        html = html.replace('src="/assets/js/site.js"', f'src="/assets/js/site.js?v={js_v}"')
        if "data-lead" in html and "turnstile/v0/api.js" not in html:
            html = html.replace("</head>", TURNSTILE + "\n</head>", 1)
        leftovers = [m for m in MARKERS if m in html]
        if CALLBACK_MARKER.search(html):
            leftovers.append("<!-- @callback -->")
        if leftovers:
            raise SystemExit(f"Unreplaced markers in {page}: {leftovers}")
        if "data-lead" in html and "turnstile/v0/api.js" not in html:
            raise SystemExit(f"Lead form without Turnstile in {page} — the form would drop every lead")
        out = PUBLIC / page.relative_to(SRC)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(html, encoding="utf-8")

    shutil.copytree(ASSETS, PUBLIC / "assets")

    write_sitemap(pages)
    write_robots()

    print(f"Built {len(pages)} pages -> public/")


SITE = "https://whiteleafroofing.com"
NOINDEX = {"thank-you", "404", "leads", "roofers-east-valley", "review", "ask"}  # LP is paid-search only; review = feedback gate; ask = Andy's private toolbox


def write_sitemap(pages) -> None:
    from datetime import date
    today = date.today().isoformat()
    urls = []
    for page in pages:
        rel = page.relative_to(SRC)
        if rel.name != "index.html":
            continue  # 404.html etc. stay out of the sitemap
        path = "/" if rel.parent.as_posix() == "." else f"/{rel.parent.as_posix()}/"
        if path.strip("/").split("/")[0] in NOINDEX:
            continue
        urls.append(f"  <url><loc>{SITE}{path}</loc><lastmod>{today}</lastmod></url>")
    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
           + "\n".join(urls) + "\n</urlset>\n")
    (PUBLIC / "sitemap.xml").write_text(xml, encoding="utf-8")


def write_robots() -> None:
    (PUBLIC / "robots.txt").write_text(
        f"User-agent: *\nAllow: /\n\nSitemap: {SITE}/sitemap.xml\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
