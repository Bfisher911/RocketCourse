// Bundle size report: prints every emitted JS/CSS asset with raw + gzip bytes and
// flags the entry chunk. Used to make code-splitting work measurable rather than
// vibes-based — run it before and after a change and compare `initial` totals.
//
//   node scripts/bundle-report.mjs            # human table
//   node scripts/bundle-report.mjs --json     # machine-readable (CI/diffing)
//
// "initial" = what the browser must download to render the first page: the entry
// chunk, anything it statically imports, and the CSS. Lazy chunks are listed
// separately because they cost nothing until the user navigates to them.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const assets = join(dist, "assets");
const asJson = process.argv.includes("--json");

if (!existsSync(assets)) {
  console.error("No dist/assets — run `npm run build` first.");
process.exit(1);
}

const kb = (n) => (n / 1024).toFixed(1);

// The entry chunk is the one referenced by a <script type="module"> in index.html.
const indexHtml = existsSync(join(dist, "index.html")) ? readFileSync(join(dist, "index.html"), "utf8") : "";
const entryMatch = indexHtml.match(/<script[^>]+src="\/assets\/([^"]+\.js)"/);
const entryName = entryMatch ? entryMatch[1] : null;

// Static imports of the entry are also on the critical path. Rolldown/Vite emit
// them as <link rel="modulepreload">, so read them straight out of the shell.
const preloaded = new Set(
  [...indexHtml.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="\/assets\/([^"]+\.js)"/g)].map((m) => m[1])
);

// Only stylesheets actually <link>ed from the shell are render-blocking. CSS
// that belongs to a lazy chunk is injected at runtime and costs nothing up front.
const linkedCss = new Set(
  [...indexHtml.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="\/assets\/([^"]+\.css)"/g)].map((m) => m[1])
);

const files = readdirSync(assets)
  .filter((f) => f.endsWith(".js") || f.endsWith(".css"))
  .map((name) => {
    const buf = readFileSync(join(assets, name));
    const isEntry = name === entryName;
    const critical = isEntry || preloaded.has(name) || linkedCss.has(name);
    return { name, bytes: buf.length, gzip: gzipSync(buf).length, isEntry, critical };
  })
  .sort((a, b) => b.bytes - a.bytes);

const sum = (list, key) => list.reduce((n, f) => n + f[key], 0);
const initial = files.filter((f) => f.critical);
const lazy = files.filter((f) => !f.critical);

const report = {
  entry: entryName,
  initial: { count: initial.length, bytes: sum(initial, "bytes"), gzip: sum(initial, "gzip") },
  lazy: { count: lazy.length, bytes: sum(lazy, "bytes"), gzip: sum(lazy, "gzip") },
  total: { count: files.length, bytes: sum(files, "bytes"), gzip: sum(files, "gzip") },
  files: files.map(({ name, bytes, gzip, critical, isEntry }) => ({ name, bytes, gzip, critical, isEntry })),
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const line = (f) =>
    `  ${f.critical ? (f.isEntry ? "▶" : "•") : " "} ${f.name.padEnd(38)} ${kb(f.bytes).padStart(9)} kB  ${kb(f.gzip).padStart(8)} kB gz`;
  console.log("\nBundle report (▶ entry, • also on the critical path)\n");
  console.log("  INITIAL — downloaded before the first screen renders");
  initial.forEach((f) => console.log(line(f)));
  console.log(`    ${"".padEnd(38)} ${kb(report.initial.bytes).padStart(9)} kB  ${kb(report.initial.gzip).padStart(8)} kB gz  <= INITIAL TOTAL`);
  if (lazy.length) {
    console.log("\n  LAZY — fetched only when the user reaches that surface");
    lazy.forEach((f) => console.log(line(f)));
    console.log(`    ${"".padEnd(38)} ${kb(report.lazy.bytes).padStart(9)} kB  ${kb(report.lazy.gzip).padStart(8)} kB gz  <= LAZY TOTAL`);
  }
  console.log(`\n  ${files.length} assets · total ${kb(report.total.bytes)} kB (${kb(report.total.gzip)} kB gz)\n`);
}
