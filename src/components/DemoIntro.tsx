import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Compass,
  FileArchive,
  Info,
  PlayCircle,
  Rocket,
  ShieldAlert,
  Sparkles
} from "lucide-react";

// Public demo intro, the gate before the pre-populated "AI and Modern Society" sample editor.
// It sets expectations (what the demo is / is not), then lets the visitor take the guided tour or
// explore on their own. No AI credits are used; the sample is static.

const DEMO_IS = [
  "A pre-populated, ready-to-explore RocketCourse course built around AI and Modern Society.",
  "A safe way to see the editor, course structure, readiness scoring, and the Canvas export flow.",
  "A sample you can edit in a temporary session and export as a Canvas-oriented .imscc file."
];

const DEMO_IS_NOT = [
  "Not connected to live AI. Exploring the demo uses no AI credits and saves nothing to an account.",
  "Not a finished course. Like any RocketCourse output, it is a strong first draft for human review.",
  "Not meant for a live Canvas course. Import the sample only into a blank or sandbox Canvas course."
];

export function DemoIntro({
  onStartTour,
  onExplore,
  onBackHome
}: {
  onStartTour: () => void;
  onExplore: () => void;
  onBackHome: () => void;
}) {
  return (
    <main id="main-content" tabIndex={-1} className="demo-intro page-shell" aria-labelledby="demo-intro-heading">
      <section className="page-heading">
        <div>
          <span className="section-eyebrow">
            <Sparkles size={14} /> Live demo
          </span>
          <h1 id="demo-intro-heading">
            Explore a prebuilt <span className="accent-text">RocketCourse</span> demo
          </h1>
          <p>
            This sample uses a pre-populated <strong>AI and Modern Society</strong> course so you can see exactly how
            RocketCourse structures a Canvas course, homepage, syllabus, modules, pages, assignments, discussions,
            quizzes, rubrics, gradebook groups, and the export package, before you build your own.
          </p>
        </div>
      </section>

      <section className="demo-intro-grid">
        <article className="demo-intro-card is">
          <h2>
            <Info size={18} /> What this demo is
          </h2>
          <ul>
            {DEMO_IS.map((item) => (
              <li key={item}>
                <CheckCircle2 size={15} /> {item}
              </li>
            ))}
          </ul>
        </article>
        <article className="demo-intro-card not">
          <h2>
            <ShieldAlert size={18} /> What it is not
          </h2>
          <ul>
            {DEMO_IS_NOT.map((item) => (
              <li key={item}>
                <ArrowRight size={15} /> {item}
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="demo-intro-steps">
        <span className="section-eyebrow">
          <Compass size={14} /> Two ways in
        </span>
        <div className="how-grid">
          <article className="step-card">
            <span className="step-index">
              <PlayCircle size={18} />
            </span>
            <h3>Take the guided tour</h3>
            <p>A short, optional walkthrough points out every tab, from the homepage to the export package, and where to download the sample files.</p>
          </article>
          <article className="step-card">
            <span className="step-index">
              <BookOpen size={18} />
            </span>
            <h3>Explore on your own</h3>
            <p>Jump straight into the editor and click around. Make safe edits in this temporary session, nothing is saved to an account.</p>
          </article>
          <article className="step-card">
            <span className="step-index">
              <FileArchive size={18} />
            </span>
            <h3>Export the sample</h3>
            <p>From the Export tab, download the sample Canvas-oriented <strong>.imscc</strong> package and import it into a blank Canvas course to test.</p>
          </article>
        </div>
      </section>

      <section className="demo-intro-warning" role="note">
        <ShieldAlert size={18} />
        <p>
          Import the sample <strong>only into a blank Canvas course</strong> for testing. Do not import it into a live
          course with existing content unless you understand the consequences, importing into a course that already has
          content can create duplicates.
        </p>
      </section>

      <section className="landing-cta">
        <h2>Ready to look around?</h2>
        <p>No sign-in, no AI credits, no risk. Start the tour or dive straight in.</p>
        <div className="hero-actions">
          <button className="primary" onClick={onStartTour}>
            <PlayCircle size={18} /> Start the guided tour
          </button>
          <button className="secondary" onClick={onExplore}>
            <Rocket size={17} /> Explore on my own <ArrowRight size={16} />
          </button>
          <button className="ghost-button" onClick={onBackHome}>
            Back to RocketCourse Home
          </button>
        </div>
      </section>
    </main>
  );
}
