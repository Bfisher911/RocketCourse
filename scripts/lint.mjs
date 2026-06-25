// Dependency-free lint gate for RocketCourse.
//
// ESLint 9 / typescript-eslint can't be installed cleanly against this repo's bleeding-edge
// toolchain (TypeScript 6, Vite 8, React 19 types) without a forced peer-dependency resolution, so
// this script performs the high-signal static checks that matter most here and leaves deep
// type-linting to `npm run typecheck` (strict TS). It scans the source for:
//   1. Leaked secrets — any VITE_-prefixed reference to a server-only key (OpenAI/Stripe secret/
//      Supabase service role). These must NEVER reach the browser bundle.
//   2. Focused/skipped tests committed by accident (.only / .skip).
//   3. Stray `debugger` statements.
// Exits non-zero on any violation so it can gate CI alongside build + test + typecheck.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROOTS = ["src", "netlify/functions"];
const EXfTS = new Set([".ts", ".tsx", ".mjs", ".js"]);
const SKIP_DIRS = new Set(["node_modules", "dist", ".netlify"]);

/** Recursively collect lintable source files. */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (EXfTS.has(extname(entry))) out.push(full);
  }
  return out;
}

const problems = [];
const add = (file, line, msg) => problems.push(`${file}:${line}  ${msg}`);

// VITE_-prefixed reference to a server-only secret in the same token (e.g. VITE_OPENAI_API_KEY).
const LEAK_RE = /VITE_[A-Z0-9_]*(OPENAI|SERVICE_ROLE|STRIPE_SECRET|SECRET_KEY|WEBHOOK_SECRET)/;
const FOCUS_RE = /\b(?:describe|it|test)\.(only|skip)\s*\(/;
const DEBUGGER_RE = /(^|[^.\w])debugger\s*;?/;

for (const r of ROOTS) {
  const base = join(root, r);
  let files;
  try {
    files = walk(base);
  } catch {
    continue; // root may not exist
  }
  for (const file of files) {
    const rel = file.slice(root.length + 1);
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((text, i) => {
      const ln = i + 1;
      if (LEAK_RE.test(text)) add(rel, ln, "potential secret leaked to the client (VITE_-prefixed server key)");
      if (/\.(test|spec)\.[tj]sx?$/.test(file) && FOCUS_RE.test(text)) add(rel, ln, "focused/skipped test committed (.only/.skip)");
      if (DEBUGGER_RE.test(text)) add(rel, ln, "stray `debugger` statement");
    });
  }
}

if (problems.length) {
  console.error(`\n✖ lint found ${problems.length} issue(s):\n`);
  for (const p of problems) console.error("  " + p);
  console.error("");
  process.exit(1);
}
console.log("✓ lint: no leaked secrets, focused tests, or debugger statements.");
