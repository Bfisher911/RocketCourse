// Single source of truth for client-side SEO: maps app "screens" to real URLs and keeps the
// document head (title, description, canonical, Open Graph, Twitter, robots) in sync as the user
// navigates. The same route data (src/seo-routes.json) is read at build time by
// scripts/prerender.mjs so non-JS crawlers and social scrapers get correct per-page metadata too.
import type { Screen } from "./types";
import seo from "./seo-routes.json";

export const SITE_ORIGIN: string = seo.siteOrigin;
const SITE_NAME: string = seo.siteName;
const OG_IMAGE: string = SITE_ORIGIN + seo.defaultOgImage;

export type RouteMeta = {
  screen: Screen;
  path: string;
  index: boolean;
  title: string;
  description: string;
  h1: string;
  intro: string;
  keywords?: string;
};

export const ROUTES = seo.routes as RouteMeta[];

const BY_SCREEN = new Map<string, RouteMeta>(ROUTES.map((route) => [route.screen, route]));
const BY_PATH = new Map<string, RouteMeta>(ROUTES.map((route) => [route.path, route]));

// login/signup get real (noindex) URLs; the in-app screens (their state lives only in memory) all
// collapse to a single noindex "/app" path, so a hard refresh there simply returns to the landing
// page — matching the app's existing in-memory-state behaviour.
const AUTH_PATHS: Partial<Record<Screen, string>> = { login: "/login", signup: "/signup" };

const stripTrailing = (pathname: string): string => pathname.replace(/\/+$/, "") || "/";

export function screenToPath(screen: Screen): string {
  // Integration is a family of pages sharing one screen; default to the hub.
  if (screen === "integration") return "/integration";
  // Blog posts are a family of /blog/<slug> URLs; keep the current path when on one.
  if (screen === "blogPost") {
    const here = typeof window !== "undefined" ? window.location.pathname : "/blog";
    return here.startsWith("/blog/") ? here : "/blog";
  }
  if (screen === "workspace") return "/workspace";
  if (screen === "admin") return "/admin";
  if (screen === "join") return "/join";
  const route = BY_SCREEN.get(screen);
  if (route) return route.path;
  return AUTH_PATHS[screen] ?? "/app";
}

export function pathToScreen(pathname: string): Screen {
  const clean = stripTrailing(pathname);
  const route = BY_PATH.get(clean);
  if (route) return route.screen;
  if (clean === "/login") return "login";
  if (clean === "/signup") return "signup";
  if (clean === "/integration" || clean.startsWith("/integration/")) return "integration";
  if (clean.startsWith("/blog/")) return "blogPost";
  if (clean === "/workspace") return "workspace";
  if (clean === "/admin") return "admin";
  if (clean === "/join") return "join";
  return "landing";
}

/** The SEO route matching a pathname (for per-page hero copy + runtime head). */
export const routeForPath = (pathname: string): RouteMeta | undefined => BY_PATH.get(stripTrailing(pathname));

function upsertMeta(attr: "name" | "property", key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertCanonical(href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/** Update the document head to match the active screen. Safe to call on every screen change. */
export function applySeo(screen: Screen): void {
  if (typeof document === "undefined") return;
  // Resolve by the current URL so families like /integration/<lms> get their own per-page meta.
  const route = BY_PATH.get(stripTrailing(window.location.pathname)) ?? BY_SCREEN.get(screen);
  const path = route?.path ?? screenToPath(screen);
  const url = SITE_ORIGIN + (path === "/" ? "" : path);
  const indexable = route?.index === true;
  const title = route?.title ?? `${SITE_NAME} — AI Canvas Course Builder & IMSCC Export`;
  const description =
    route?.description ??
    "RocketCourse turns a course idea into an editable, Canvas-ready course you can export as an IMSCC package.";

  document.title = title;
  upsertMeta("name", "description", description);
  if (route?.keywords) upsertMeta("name", "keywords", route.keywords);
  upsertMeta("name", "robots", indexable ? "index,follow" : "noindex,follow");
  upsertCanonical(url);
  upsertMeta("property", "og:title", title);
  upsertMeta("property", "og:description", description);
  upsertMeta("property", "og:url", url);
  upsertMeta("property", "og:type", "website");
  upsertMeta("property", "og:site_name", SITE_NAME);
  upsertMeta("property", "og:image", OG_IMAGE);
  upsertMeta("name", "twitter:card", "summary_large_image");
  upsertMeta("name", "twitter:title", title);
  upsertMeta("name", "twitter:description", description);
  upsertMeta("name", "twitter:image", OG_IMAGE);
}
