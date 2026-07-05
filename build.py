#!/usr/bin/env python3
"""White Leaf Roofing static site builder.

Assembles pages in src/ with shared partials, writes the deployable site to public/.

Markers inside src pages:
    <!-- @header -->   -> partials/header.html
    <!-- @footer -->   -> partials/footer.html
    <!-- @callbar -->  -> partials/callbar.html

Usage:  python build.py
"""
import shutil
from pathlib import Path

ROOT = Path(__file__).parent
SRC, PARTIALS, PUBLIC, ASSETS = ROOT / "src", ROOT / "partials", ROOT / "public", ROOT / "assets"

MARKERS = {
    "<!-- @header -->": "header.html",
    "<!-- @footer -->": "footer.html",
    "<!-- @callbar -->": "callbar.html",
}

# Google Tag Manager (same container as the old WordPress site: GTM Kit)
GTM_ID = "GTM-M5CC3JS"
GTM_HEAD = (
    "<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),"
    "event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?"
    "'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;"
    "f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','" + GTM_ID + "');</script>"
)
GTM_BODY = (
    f'<noscript><iframe src="https://www.googletagmanager.com/ns.html?id={GTM_ID}" '
    'height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>'
)


def main() -> None:
    partials = {m: (PARTIALS / f).read_text(encoding="utf-8") for m, f in MARKERS.items()}

    if PUBLIC.exists():
        shutil.rmtree(PUBLIC)
    PUBLIC.mkdir()

    pages = sorted(SRC.rglob("*.html"))
    for page in pages:
        html = page.read_text(encoding="utf-8")
        for marker, content in partials.items():
            html = html.replace(marker, content)
        html = html.replace("<head>", "<head>\n" + GTM_HEAD, 1)
        html = html.replace("<body>", "<body>\n" + GTM_BODY, 1)
        leftovers = [m for m in MARKERS if m in html]
        if leftovers:
            raise SystemExit(f"Unreplaced markers in {page}: {leftovers}")
        out = PUBLIC / page.relative_to(SRC)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(html, encoding="utf-8")

    shutil.copytree(ASSETS, PUBLIC / "assets")

    write_sitemap(pages)
    write_robots()

    print(f"Built {len(pages)} pages -> public/")


SITE = "https://whiteleafroofing.com"
NOINDEX = {"thank-you", "404"}


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
