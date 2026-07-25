import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ChunkErrorBoundary } from "./components/ChunkErrorBoundary";
import "./styles.css";
import "./brand.css";
import "./platform.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* Outermost boundary: a lazily-loaded chunk that fails to arrive (e.g. the
        tab was open across a deploy) must show a reload prompt, never a blank page. */}
    <ChunkErrorBoundary>
      <App />
    </ChunkErrorBoundary>
  </React.StrictMode>
);
