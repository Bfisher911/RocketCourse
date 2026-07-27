// @vitest-environment jsdom
//
// The first test in this repo that actually RENDERS React. Every other suite is
// pure logic, which means all 885 of them stay green through a total UI break —
// exactly the blind spot that makes extracting App.tsx's inline screens risky.
// This mounts the real <App/> and walks the public screens, so a broken import,
// a bad lazy() default mapping, or a screen that throws on mount fails here.

import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import App from "./App";

// jsdom ships neither of these and React/the app touch both.
beforeAll(() => {
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }
  if (!window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
});

// App derives its initial screen from window.location.pathname, and the SEO
// effect pushState()s as you navigate — so without this reset a test that ends
// on /contact makes the NEXT test boot into the contact screen.
beforeEach(() => window.history.pushState({}, "", "/"));
afterEach(cleanup);

describe("App smoke", () => {
  it("mounts and renders the landing page without throwing", async () => {
    render(<App />);
    // The landing hero is eager (never lazy) — it is the prerendered first paint.
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    });
    expect(document.querySelector(".app")).toBeInTheDocument();
  });

  it("does not trip the chunk error boundary on first paint", () => {
    render(<App />);
    expect(document.querySelector(".chunk-error")).not.toBeInTheDocument();
  });

  it("renders the skip link pointing at a real #main-content target", async () => {
    render(<App />);
    const skip = document.querySelector<HTMLAnchorElement>("a.skip-link");
    expect(skip).toBeInTheDocument();
    expect(skip!.getAttribute("href")).toBe("#main-content");
    await waitFor(() => {
      expect(document.getElementById("main-content")).toBeInTheDocument();
    });
  });

  it("navigates to the public marketing screens and each renders real content", async () => {
    const user = userEvent.setup();
    render(<App />);
    for (const name of ["Pricing", "Guides", "About", "Contact"]) {
      await user.click(screen.getAllByRole("button", { name: new RegExp(`^${name}$`) })[0]);
      // each is React.lazy: wait for the chunk, then assert it is not a stuck skeleton
      await waitFor(
        () => {
          expect(document.querySelector(".screen-skeleton")).not.toBeInTheDocument();
          expect(document.querySelector("main")!.textContent!.length).toBeGreaterThan(80);
        },
        { timeout: 5000 }
      );
      expect(document.querySelector(".chunk-error")).not.toBeInTheDocument();
    }
  }, 30000);

  it("enters the demo course and renders the editor with its tabs", async () => {
    const user = userEvent.setup();
    render(<App />);
    // Query by text content: these buttons pair an icon with a label, so their
    // accessible name is not a clean match.
    const byText = (re: RegExp): HTMLButtonElement => {
      const el = [...document.querySelectorAll("button")].find((b) => re.test((b.textContent || "").trim()));
      if (!el) throw new Error(`no button matching ${re}`);
      return el as HTMLButtonElement;
    };
    await user.click(byText(/Try the demo/i));
    await waitFor(() => expect(byText(/Explore on my own/i)).toBeInTheDocument(), { timeout: 5000 });
    // enterDemo is async: it materializes the demo course from the code-split generator
    await user.click(byText(/Explore on my own/i));
    await waitFor(
      () => {
        expect(document.body.textContent).toContain("AI and Modern Society");
      },
      { timeout: 20000 }
    );
    expect(document.querySelector(".chunk-error")).not.toBeInTheDocument();
  }, 40000);
});

