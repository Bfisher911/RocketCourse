// Suspense fallback for lazily-loaded screens. Deliberately quiet: a screen
// chunk is a few tens of kB over a warm connection, so a loud spinner would
// flash and feel worse than a calm placeholder. Announced politely for screen
// readers, and it respects reduced-motion via the shared .spin rules.

export function ScreenSkeleton({ label = "Loading" }: { label?: string }) {
  return (
    <main className="screen-skeleton" role="status" aria-live="polite" aria-busy="true">
      <span className="screen-skeleton__dot" aria-hidden="true" />
      <span className="screen-skeleton__label">{label}…</span>
    </main>
  );
}
