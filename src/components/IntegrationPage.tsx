import { ArrowRight, CheckCircle2, Clock, Layers, Rocket, Sparkles } from "lucide-react";
import { INTEGRATIONS, getIntegration, integrationSlugFromPath } from "../data/integrations";
import { routeForPath } from "../seo";

// Per-LMS / per-format SEO landing pages served at /integration and /integration/<slug>. The page is
// path-driven (it reads the current pathname to choose which LMS/format to render) so a single screen
// powers the whole family; each path is prerendered with its own meta (see scripts/prerender.mjs).
// Cross-page links use real <a href> so crawlers follow them and the prerendered HTML is served.

const CANVAS_ARTIFACTS = [
  "Modules with ordered items",
  "Pages — homepage, syllabus, lessons",
  "Assignments with submission types",
  "Discussions",
  "QTI quizzes (multiple choice, true/false, fill-in-the-blank, essay)",
  "Rubrics aligned to outcomes",
  "Learning outcomes",
  "Gradebook groups with weights"
];

export function IntegrationPage({ onStartBuilding, onTryDemo }: { onStartBuilding: () => void; onTryDemo: () => void }) {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "/integration";
  const entry = getIntegration(integrationSlugFromPath(pathname));
  const route = routeForPath(pathname);
  const lmsEntries = INTEGRATIONS.filter((item) => item.kind === "lms");
  const formatEntries = INTEGRATIONS.filter((item) => item.kind === "format");

  // Hub: /integration
  if (!entry) {
    return (
      <main id="main-content" tabIndex={-1} className="integration page-shell">
        <section className="page-heading">
          <div>
            <span className="section-eyebrow">
              <Sparkles size={14} /> Integrations
            </span>
            <h1>{route?.h1 ?? "Export your AI-built course to any LMS"}</h1>
            <p>
              {route?.intro ??
                "Generate a structured course with AI, then export a validated package you can import into your LMS."}
            </p>
          </div>
        </section>

        <section className="landing-section">
          <h2>Learning management systems</h2>
          <div className="integration-grid">
            {lmsEntries.map((item) => (
              <a
                key={item.slug}
                className={`integration-card${item.comingSoon ? " is-soon" : ""}`}
                href={`/integration/${item.slug}`}
              >
                <span className="integration-card-head">
                  <strong>{item.name}</strong>
                  {item.comingSoon && (
                    <span className="integration-soon">
                      <Clock size={12} /> Coming soon
                    </span>
                  )}
                </span>
                <span>{item.tagline}</span>
                <ArrowRight size={15} />
              </a>
            ))}
          </div>
        </section>

        <section className="landing-section">
          <h2>Export formats</h2>
          <div className="integration-grid">
            {formatEntries.map((item) => (
              <a key={item.slug} className="integration-card" href={`/integration/${item.slug}`}>
                <strong>{item.name}</strong>
                <span>{item.tagline}</span>
                <ArrowRight size={15} />
              </a>
            ))}
          </div>
        </section>

        <section className="landing-cta">
          <h2>Build a course, export it anywhere</h2>
          <p>Generate a structured course in minutes, validate it locally, and export for your LMS.</p>
          <div className="hero-actions">
            <button className="primary" onClick={onStartBuilding}>
              <Rocket size={16} /> Build your first course <ArrowRight size={16} />
            </button>
            <button className="secondary" onClick={onTryDemo}>
              Try the demo
            </button>
          </div>
        </section>
      </main>
    );
  }

  // Specific LMS or format page: /integration/<slug>
  const otherLms = lmsEntries.filter((item) => item.slug !== entry.slug);
  return (
    <main id="main-content" tabIndex={-1} className="integration page-shell">
      <section className="page-heading">
        <div>
          <span className="section-eyebrow">
            <Sparkles size={14} /> {entry.kind === "lms" ? "LMS integration" : "Export format"}
          </span>
          <h1>{route?.h1 ?? entry.name}</h1>
          <p>{route?.intro ?? entry.blurb}</p>
        </div>
      </section>

      {entry.comingSoon && (
        <div className="integration-soon-banner" role="note">
          <Clock size={18} />
          <p>
            <strong>{entry.name} support is coming soon.</strong> Canvas is the verified, supported LMS today.
            RocketCourse can already export a Common Cartridge that {entry.name} can import, but we have not yet
            verified that path end to end, so treat it as experimental and test in a sandbox course first.
          </p>
        </div>
      )}

      <section className="landing-section">
        <h2>What is {entry.name}?</h2>
        <p>{entry.blurb}</p>
      </section>

      <section className="landing-section">
        <span className="section-eyebrow">
          <Layers size={14} /> How it works
        </span>
        <h2>How RocketCourse exports to {entry.name}</h2>
        <ol className="integration-steps">
          {entry.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      {entry.kind === "lms" && (
        <section className="landing-section">
          <span className="section-eyebrow">
            <CheckCircle2 size={14} /> Included
          </span>
          <h2>What comes across</h2>
          <ul className="integration-artifacts">
            {CANVAS_ARTIFACTS.map((artifact) => (
              <li key={artifact}>
                <CheckCircle2 size={14} /> {artifact}
              </li>
            ))}
          </ul>
          <p className="muted-note">
            RocketCourse produces a Canvas-oriented package and a strong first draft — always review and test in a
            blank {entry.name} course before using it with students.
          </p>
        </section>
      )}

      <section className="landing-section">
        <h2>Other supported LMS</h2>
        <nav className="integration-silo" aria-label="Other LMS integrations">
          <a href="/integration">All integrations</a>
          {otherLms.map((item) => (
            <a key={item.slug} href={`/integration/${item.slug}`}>
              {item.name}
            </a>
          ))}
        </nav>
      </section>

      <section className="landing-cta">
        <h2>Build your {entry.kind === "lms" ? entry.name : ""} course</h2>
        <p>Generate a structured course in minutes, validate it locally, and export it.</p>
        <div className="hero-actions">
          <button className="primary" onClick={onStartBuilding}>
            <Rocket size={16} /> Build your course <ArrowRight size={16} />
          </button>
          <button className="secondary" onClick={onTryDemo}>
            Try the demo
          </button>
        </div>
      </section>
    </main>
  );
}
