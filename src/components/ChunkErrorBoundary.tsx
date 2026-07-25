// ChunkErrorBoundary — the app's only error boundary, wrapping the whole tree.
//
// Why it must exist before any React.lazy: netlify.toml serves a catch-all
// `/* -> /index.html 200`, so a request for a chunk that no longer exists (the
// classic "user had the tab open across a deploy" case) does not 404 — it
// returns the HTML shell with HTTP 200. The dynamic import then fails on a MIME
// or parse error, React unmounts the entire tree, and the user is left staring
// at a blank white page with no way forward.
//
// A chunk-load failure is recoverable: the fix is always a reload, which fetches
// the new index.html and its new hashed chunk names. So we detect that class of
// error specifically and lead with a reload action, while still degrading
// gracefully for any other render error.

import { Component, type ErrorInfo, type ReactNode } from "react";

/** True when the error looks like a failed dynamic import rather than a bug in
 * component code — different remedy, so it gets different copy. Exported for tests. */
export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return (
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /ChunkLoadError/i.test(message) ||
    // The catch-all-returns-HTML case: the browser parses index.html as JS.
    /Unexpected token '<'/.test(message)
  );
}

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  isChunkError: boolean;
}

/** Set by the mounted boundary so non-render code paths can reach it. */
let notifyChunkFailure: ((error: unknown) => void) | null = null;

/**
 * Surface a chunk-load failure that happened OUTSIDE React's render phase —
 * i.e. a rejected `await import(...)` inside an event handler, which an error
 * boundary can never see. Wired up from main.tsx's `unhandledrejection`
 * listener. No-ops if the boundary is not mounted.
 */
export function reportChunkLoadFailure(error: unknown): void {
  notifyChunkFailure?.(error);
}

export class ChunkErrorBoundary extends Component<Props, State> {
  state: State = { error: null, isChunkError: false };

  componentDidMount(): void {
    notifyChunkFailure = (error: unknown) => {
      // Only escalate to the full-page prompt for chunk failures; ordinary
      // rejected promises elsewhere in the app must not blank the screen.
      if (!isChunkLoadError(error)) return;
      this.setState({ error: error instanceof Error ? error : new Error(String(error)), isChunkError: true });
    };
  }

  componentWillUnmount(): void {
    notifyChunkFailure = null;
  }

  static getDerivedStateFromError(error: Error): State {
    return { error, isChunkError: isChunkLoadError(error) };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Keep a real record for support/monitoring. Never include user course
    // content — just the error identity and the React component stack.
    console.error("[RocketCourse] Unhandled render error:", error.name, error.message, info.componentStack);
  }

  private reload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    const { error, isChunkError } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="chunk-error" role="alert">
        <div className="chunk-error__panel">
          <h1 className="chunk-error__title">
            {isChunkError ? "This page needs a refresh" : "Something went wrong"}
          </h1>
          <p className="chunk-error__body">
            {isChunkError
              ? "RocketCourse was updated while this tab was open, so part of the app could not load. Reloading picks up the new version. Your saved courses are not affected."
              : "An unexpected error stopped this screen from rendering. Reloading usually clears it. Your saved courses are not affected."}
          </p>
          <button type="button" className="chunk-error__button" onClick={this.reload}>
            Reload RocketCourse
          </button>
          {!isChunkError && (
            <p className="chunk-error__detail">
              If it keeps happening, send us this detail: <code>{error.name}: {error.message}</code>
            </p>
          )}
        </div>
      </div>
    );
  }
}
