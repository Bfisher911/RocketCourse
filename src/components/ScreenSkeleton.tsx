// Suspense fallback for lazily-loaded screens. Deliberately quiet: a screen
// chunk is a few tens of kB over a warm connection, so a loud spinner would
// flash and feel worse than a calm placeholder. Announced politely for screen
// readers, and it respects reduced-motion via the shared .spin rules.

export function ScreenSkeleton({ label = "Loading" }: { label?: string }) {
  // Keeps id="main-content" and the <main> landmark: the skip link at the top of
  // every page targets #main-content, and putting role="status" on the <main>
  // itself would replace the landmark role and leave that link pointing at
  // nothing while a lazy screen loads. The live region is a child instead.
  return (
    <main id="main-content" tabIndex={-1} className="screen-skeleton">
      <p className="screen-skeleton__status" role="status" aria-live="polite" aria-busy="true">
        <span className="screen-skeleton__dot" aria-hidden="true" />
        <span className="screen-skeleton__label">{label}…</span>
      </p>
    </main>
  );
}
