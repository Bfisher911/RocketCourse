// Generative per-course art: a DETERMINISTIC sprinkle of decorative marks seeded from the course
// title, so every course's banner is subtly unique while rendering identically every time (same
// title → same art, across the in-app preview and the .imscc export). No Math.random — the seed is
// a hash of the title — so the banner never "shimmers" between renders. Pure inline SVG (Canvas-safe).

/** FNV-1a string hash → unsigned 32-bit seed. Stable for the same input. */
export const hashString = (value: string): number => {
  let hash = 2166136261;
  const input = value || "course";
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

/** mulberry32 PRNG — a tiny deterministic generator seeded by an integer. */
export const seededRandom = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const sparkle = (x: number, y: number, size: number, ink: string, opacity: string): string => {
  const a = size;
  const b = size * 0.34;
  return `<path d="M${x} ${y - a} L${x + b} ${y - b} L${x + a} ${y} L${x + b} ${y + b} L${x} ${y + a} L${x - b} ${y + b} L${x - a} ${y} L${x - b} ${y - b} Z" fill="${ink}" opacity="${opacity}"/>`;
};

/**
 * Seeded decorative layer for the 1440×360 banner: a handful of small marks (dots + sparkles)
 * scattered in the open zones (clear of the left title card at x96–736 and the motif's center),
 * positioned/sized/typed deterministically from the title. `ink` is the on-gradient color.
 */
export const seededBannerDecor = (title: string, ink = "#ffffff"): string => {
  const rand = seededRandom(hashString(title));
  const count = 7 + Math.floor(rand() * 5); // 7–11 marks
  // Open zones [x0, x1, y0, y1]: top band, far-right gaps, and lower-left below the title card.
  const zones: Array<[number, number, number, number]> = [
    [110, 760, 14, 74],
    [1280, 1410, 60, 320],
    [120, 700, 298, 346]
  ];
  const marks: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const [x0, x1, y0, y1] = zones[Math.floor(rand() * zones.length)];
    const x = Math.round(x0 + rand() * (x1 - x0));
    const y = Math.round(y0 + rand() * (y1 - y0));
    const opacity = (0.18 + rand() * 0.42).toFixed(2);
    if (rand() < 0.28) {
      marks.push(sparkle(x, y, 4 + rand() * 5, ink, opacity));
    } else {
      const r = (1.4 + rand() * 2.4).toFixed(1);
      marks.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${ink}" opacity="${opacity}"/>`);
    }
  }
  return `<g aria-hidden="true">${marks.join("")}</g>`;
};
