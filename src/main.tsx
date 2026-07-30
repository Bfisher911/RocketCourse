import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ChunkErrorBoundary, isChunkLoadError, reportChunkLoadFailure } from "./components/ChunkErrorBoundary";
import "./styles.css";
import "./brand.css";
import "./platform.css";

// An error boundary only catches errors thrown during RENDER. A call-site
// `await import(...)` inside a click handler rejects outside React's rendering
// path, so a chunk that fails to load there would otherwise be completely
// silent — the button just does nothing, forever (a failed module fetch is
// cached as errored, so retrying re-rejects without refetching).
// This catches that class globally and surfaces the same reload prompt.
window.addEventListener("unhandledrejection", (event) => {
  if (isChunkLoadError(event.reason)) {
    event.preventDefault();
    reportChunkLoadFailure(event.reason);
  }
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* Outermost boundary: a lazily-loaded chunk that fails to arrive (e.g. the
        tab was open across a deploy) must show a reload prompt, never a blank page. */}
    <ChunkErrorBoundary>
      <App />
    </ChunkErrorBoundary>
  </React.StrictMode>
);
