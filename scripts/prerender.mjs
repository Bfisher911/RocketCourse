// Post-build prerender: after `vite build`, emit a static HTML file per marketing route with
// correct per-page <title>, meta description, canonical, Open Graph, Twitter, and robots tags, plus
// a small crawlable <h1>/intro snapshot injected into #root (React replaces it on mount). This is
// what gives non-JS crawlers and social scrapers (Slack/Twitter/LinkedIn/Facebook) correct metadata
// per URL — the SPA shell alone cannot. Also generates sitemap.xml from the same route data.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const dist = join(root, "dist");

const seo = JSON.parse(readFileSync(join(root, "src/seo-routes.json"), "utf8"));
const origin = seo.siteOrigin;
const ogImage = origin + seo.defaultOgImage;
const shell = readFileSync(join(dist, "index.html"), "utf8");

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function setMeta(html, attr, key, value) {
  const re = new RegExp(`(<meta\\s+${attr}="${key}"\\s+content=")[^"]*(")`, "i");
  if (re.test(html)) return html.replace(re, `$1${esc(value)}$2`);
  return html.replace("</head>", `    <meta ${attr}="${key}" content="${esc(value)}" />\n  </head>`);
}

function setCanonical(html, href) {
  const re = /(<link\s+rel="canonical"\s+href=")[^"]*(")/i;
  if (re.test(html)) return html.replace(re, `$1${esc(href)}$2`);
  return html.replace("</head>", `    <link rel="canonical" href="${esc(href)}" />\n  </head>`);
}

// BreadcrumbList structured data: Home → [Integrations →] page. The leaf name is the short page
// name (the title before the first em-dash/pipe). Skipped for the home page. CourseMagic ships none.
function breadcrumbJsonLd(route) {
  if (route.path === "/") return null;
  const leaf = route.title.split(/\s[—|]\s/)[0].trim();
  const crumbs = [{ name: "Home", url: origin + "/" }];
  if (route.path.startsWith("/integration/")) crumbs.push({ name: "Integrations", url: origin + "/integration" });
  crumbs.push({ name: leaf, url: origin + route.path });
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({ "@type": "ListItem", position: index + 1, name: crumb.name, item: crumb.url }))
  };
}

function render(route) {
  const url = origin + (route.path === "/" ? "/" : route.path);
  let html = shell;
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(route.title)}</title>`);
  html = setMeta(html, "name", "description", route.description);
  if (route.keywords) html = setMeta(html, "name", "keywords", route.keywords);
  html = setMeta(html, "name", "robots", route.index ? "index,follow" : "noindex,follow");
  html = setMeta(html, "property", "og:title", route.title);
  html = setMeta(html, "property", "og:description", route.description);
  html = setMeta(html, "property", "og:url", url);
  html = setMeta(html, "property", "og:image", ogImage);
  html = setMeta(html, "name", "twitter:title", route.title);
  html = setMeta(html, "name", "twitter:description", route.description);
  html = setMeta(html, "name", "twitter:image", ogImage);
  html = setCanonical(html, url);

  const breadcrumb = breadcrumbJsonLd(route);
  if (breadcrumb) {
    html = html.replace("</head>", `    <script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>\n  </head>`);
  }

  const links = seo.routes
    .filter((r) => r.index)
    .map((r) => `<a href="${r.path}">${esc(r.h1)}</a>`)
    .join(" ");
  const snapshot =
    `<div id="prerender-snapshot" style="position:absolute;left:-9999px;top:-9999px">` +
    `<h1>${esc(route.h1)}</h1><p>${esc(route.intro)}</p><nav aria-label="RocketCourse">${links}</nav></div>`;
  return html.replace('<div id="root"></div>', `<div id="root">${snapshot}</div>`);
}

let count = 0;
for (const route of seo.routes) {
  const outPath = route.path === "/" ? join(dist, "index.html") : join(dist, route.path, "index.html");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, render(route));
  count += 1;
}

const urls = seo.routes
  .filter((route) => route.index)
  .map((route) => {
    const loc = origin + (route.path === "/" ? "/" : route.path);
    const priority = route.path === "/" ? "1.0" : "0.7";
    return `  <url>\n    <loc>${loc}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
  })
  .join("\n");
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
writeFileSync(join(dist, "sitemap.xml"), sitemap);

console.log(`[prerender] wrote ${count} route HTML files + sitemap.xml (${origin})`);
