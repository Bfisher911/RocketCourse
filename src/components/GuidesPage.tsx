import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Download,
  FileArchive,
  FilePlus2,
  FileText,
  HelpCircle,
  RotateCcw,
  Sparkles,
  Upload
} from "lucide-react";

// Public "Guides / How It Works" hub. Everything lives on this one page — there is no routing here.
// The page intentionally uses qualified language about Canvas: RocketCourse produces a Canvas-oriented
// .imscc package designed for Canvas import workflows, but import is NOT yet sandbox-verified, so we
// always tell users to test in a blank/sandbox Canvas course first and to review everything before
// publishing. Destructive actions (course reset, importing into a course with existing content) carry
// explicit warnings. The in-depth guide bodies are native <details>/<summary> so they expand with zero
// JS and stay accessible. The parent owns the two CTAs (`onTryDemo`, `onStartBuilding`).

export function GuidesPage({
  onTryDemo,
  onStartBuilding
}: {
  onTryDemo: () => void;
  onStartBuilding: () => void;
}) {
  return (
    <main className="guides page-shell">
      <section className="page-heading">
        <div>
          <span className="section-eyebrow">
            <BookOpen size={14} /> Guides
          </span>
          <h1>
            How <span className="gradient-text">RocketCourse</span> works, start to finish
          </h1>
          <p>
            RocketCourse builds a Canvas-oriented <strong>.imscc</strong> package designed for Canvas
            import workflows. These guides walk you through every path — starting from scratch, improving
            an existing course, importing your package, exporting a single quiz, printing quizzes, and
            generating PDFs. Canvas import is <strong>not yet sandbox-verified</strong>, so always test in
            a blank or sandbox Canvas course first and review everything before you publish.
          </p>
        </div>
      </section>

      {/* High-level 3-step strip */}
      <section className="landing-section">
        <span className="section-eyebrow">
          <Sparkles size={14} /> The big picture
        </span>
        <h2>Three steps, every time</h2>
        <p>
          Whatever you are building, the workflow is the same shape: design in RocketCourse, export a
          package, then import and verify inside Canvas.
        </p>
        <div className="how-grid">
          <article className="step-card">
            <span className="step-line" />
            <span className="step-index">1</span>
            <h3>Build in RocketCourse</h3>
            <p>
              Create your course content — pages, syllabus, assignments, quizzes, and grading — using the
              builder tabs. Edit until it reads the way you want.
            </p>
          </article>
          <article className="step-card">
            <span className="step-line" />
            <span className="step-index">2</span>
            <h3>Export a package</h3>
            <p>
              Export a Canvas-oriented <strong>.imscc</strong> course package, or narrower files such as a
              single quiz QTI, printable quiz PDFs, or a syllabus PDF.
            </p>
          </article>
          <article className="step-card">
            <span className="step-line" />
            <span className="step-index">3</span>
            <h3>Import &amp; verify in Canvas</h3>
            <p>
              Import into a <strong>blank or sandbox Canvas course</strong> first, then review every page,
              quiz, date, link, and policy before you publish to students.
            </p>
          </article>
        </div>
      </section>

      {/* Guide cards grid — visual summaries; authoritative content is in the <details> below */}
      <section className="landing-section">
        <span className="section-eyebrow">
          <HelpCircle size={14} /> Pick your path
        </span>
        <h2>Which guide do you need?</h2>
        <p>
          Each card maps to an in-depth guide further down this page. They are quick summaries — open the
          matching expandable section below for the full, step-by-step instructions and warnings.
        </p>
        <div className="feature-grid">
          <article className="feature-card">
            <span className="feature-icon cyan">
              <Sparkles size={22} />
            </span>
            <h3>Start from scratch</h3>
            <p>
              Build a brand-new course in RocketCourse, export the <strong>.imscc</strong>, and import it
              into a blank Canvas course.
            </p>
          </article>
          <article className="feature-card">
            <span className="feature-icon pink">
              <Upload size={22} />
            </span>
            <h3>Improve an existing course</h3>
            <p>
              Export your current Canvas course, then enhance it with RocketCourse features where they are
              supported.
            </p>
          </article>
          <article className="feature-card">
            <span className="feature-icon orange">
              <FileArchive size={22} />
            </span>
            <h3>Import my .imscc</h3>
            <p>
              Already have the package? Walk through importing it into a target Canvas course step by step.
            </p>
          </article>
          <article className="feature-card">
            <span className="feature-icon orchid">
              <ClipboardList size={22} />
            </span>
            <h3>Add only a quiz</h3>
            <p>
              Export one quiz as a QTI file and import just that quiz into Canvas — then verify it carefully.
            </p>
          </article>
          <article className="feature-card">
            <span className="feature-icon success">
              <FileText size={22} />
            </span>
            <h3>Printable quizzes</h3>
            <p>
              Generate student quiz PDFs and separate answer-key PDFs for paper-based or backup use.
            </p>
          </article>
          <article className="feature-card">
            <span className="feature-icon yellow">
              <Download size={22} />
            </span>
            <h3>Syllabus PDF</h3>
            <p>
              Export a polished syllabus PDF and understand how it relates to the Canvas syllabus page.
            </p>
          </article>
          <article className="feature-card">
            <span className="feature-icon cyan">
              <FilePlus2 size={22} />
            </span>
            <h3>Add only new content</h3>
            <p>
              Do a partial export of just what changed since last time — and avoid creating duplicates.
            </p>
          </article>
          <article className="feature-card">
            <span className="feature-icon pink">
              <RotateCcw size={22} />
            </span>
            <h3>Reset a test course</h3>
            <p>
              Understand why Canvas course reset is destructive and use it only on a course you can safely
              wipe.
            </p>
          </article>
        </div>
      </section>

      {/* In-depth guides — native <details>/<summary>, work with zero JS */}
      <section className="landing-section">
        <span className="section-eyebrow">
          <BookOpen size={14} /> In-depth guides
        </span>
        <h2>The full walkthroughs</h2>
        <p>
          Open any guide below for numbered steps. Each one ends with the checks and warnings that matter
          for that path. When a step happens inside Canvas, it is written so you can follow it directly in
          the Canvas UI.
        </p>

        <details className="guide-detail">
          <summary>1. I want to start from scratch.</summary>
          <div className="guide-steps">
            <p>
              Build the whole course in RocketCourse, export a Canvas-oriented <strong>.imscc</strong>{" "}
              package, and import it into a fresh Canvas course.
            </p>
            <ol>
              <li>
                In Canvas, create or locate a <strong>blank course</strong> to be your target — ideally a
                sandbox or empty test course with no existing content.
              </li>
              <li>
                In RocketCourse, build your course using the builder tabs: Overview, Homepage, Pages,
                Syllabus, Assignments, Quizzes, Discussions, Rubrics, Gradebook, and Contact Hours. Edit
                until the content reads the way you want.
              </li>
              <li>
                Open the <strong>Export</strong> tab, run the readiness and validation checks, and resolve
                anything flagged before you package.
              </li>
              <li>
                Download the Canvas-oriented <strong>.imscc</strong> course package to your computer.
              </li>
              <li>
                In Canvas, open your blank course and go to <strong>Settings → Import Course Content</strong>.
              </li>
              <li>
                Choose <strong>Canvas Course Export Package</strong> (or Common Cartridge if that is the
                appropriate option for your file), upload the <strong>.imscc</strong>, choose{" "}
                <strong>All Content</strong>, and start the import.
              </li>
              <li>
                After the import finishes, review the imported modules, pages, assignments, quizzes,
                gradebook, dates, links, and files before publishing to students.
              </li>
            </ol>
            <p className="guide-warning">
              <AlertTriangle size={15} /> <strong>Test first.</strong> Canvas import is not yet
              sandbox-verified for RocketCourse. Always import into a blank or sandbox course first, and do
              not import into a live course with existing content unless you understand the consequences.
            </p>
          </div>
        </details>

        <details className="guide-detail">
          <summary>2. I already have a Canvas course and want to improve it.</summary>
          <div className="guide-steps">
            <p>
              Export your existing course out of Canvas, then bring in RocketCourse-built content where it
              is supported. Be realistic about the limitations below.
            </p>
            <ol>
              <li>
                In Canvas, open the course you want to improve and go to{" "}
                <strong>Settings → Export Course Content</strong>.
              </li>
              <li>
                Choose <strong>Course</strong> as the export type, click <strong>Create Export</strong>,
                wait for Canvas to finish, then download the resulting <strong>.imscc</strong> file as your
                backup and reference.
              </li>
              <li>
                In RocketCourse, build the additions or improvements you want — for example new pages,
                quizzes, assignments, a refreshed syllabus, or updated grading — using the builder tabs.
              </li>
              <li>
                Export your RocketCourse additions (a full <strong>.imscc</strong>, or a narrower export
                such as a single quiz or a syllabus PDF — see the other guides).
              </li>
              <li>
                Import the RocketCourse export into a <strong>blank or sandbox Canvas course</strong> first
                to confirm it looks right, then decide carefully how to bring it into your live course.
              </li>
            </ol>
            <p className="guide-warning">
              <AlertTriangle size={15} /> <strong>Limitations.</strong> RocketCourse does not edit your live
              Canvas course in place and does not round-trip every Canvas feature. Treat it as a way to
              author new or replacement content, not a full two-way sync. Importing new content into a
              course that already has content can create <strong>duplicate</strong> pages, assignments, or
              quizzes, so review the result before publishing.
            </p>
          </div>
        </details>

        <details className="guide-detail">
          <summary>3. I have my .imscc file. How do I import it into Canvas?</summary>
          <div className="guide-steps">
            <p>Import the package into the course where you want the content to live.</p>
            <ol>
              <li>Log into Canvas.</li>
              <li>
                Open the <strong>target course</strong> — ideally a blank or sandbox course for your first
                import.
              </li>
              <li>
                Go to <strong>Settings → Import Course Content</strong>.
              </li>
              <li>
                For <strong>Content Type</strong>, select{" "}
                <strong>Canvas Course Export Package</strong> (or <strong>Common Cartridge</strong> if that
                matches your file).
              </li>
              <li>
                Upload your <strong>.imscc</strong> file.
              </li>
              <li>
                Choose <strong>All Content</strong>, or <strong>Select specific content</strong> if you only
                want part of the package.
              </li>
              <li>
                Click <strong>Import</strong> and wait for the job to complete (if you chose specific
                content, Canvas will prompt you to select items first).
              </li>
              <li>
                After import, review the <strong>modules, pages, assignments, quizzes, gradebook, and
                files</strong> — plus dates, links, and grading — before publishing.
              </li>
            </ol>
            <p className="guide-warning">
              <AlertTriangle size={15} /> <strong>Duplicates.</strong> Importing into a course that already
              has content can create duplicate items. Use a blank or sandbox course when you can, and verify
              everything imported as expected.
            </p>
          </div>
        </details>

        <details className="guide-detail">
          <summary>4. I only want to add a quiz.</summary>
          <div className="guide-steps">
            <p>
              Export a single quiz as a QTI file from RocketCourse and import just that quiz into Canvas.
            </p>
            <ol>
              <li>
                In RocketCourse, open the <strong>Quizzes</strong> tab and finish the quiz you want to
                export.
              </li>
              <li>
                Export that single quiz as a <strong>QTI</strong> file (the standalone quiz export) and
                download it.
              </li>
              <li>
                In Canvas, open the target course and go to{" "}
                <strong>Settings → Import Course Content</strong>.
              </li>
              <li>
                Choose the <strong>QTI .zip file</strong> content type, upload your exported quiz, and start
                the import.
              </li>
              <li>
                When the import finishes, open the quiz in Canvas and check every question, answer choice,
                correct answer, and point value.
              </li>
            </ol>
            <p className="guide-warning">
              <AlertTriangle size={15} /> <strong>Verify QTI behavior.</strong> Canvas QTI import behavior
              can vary by question type and by Canvas quiz engine (Classic vs New Quizzes). Always confirm
              the imported questions and answer keys are correct <strong>before any student takes the
              quiz</strong>.
            </p>
          </div>
        </details>

        <details className="guide-detail">
          <summary>5. I want printable quizzes.</summary>
          <div className="guide-steps">
            <p>Generate paper-friendly PDFs for a quiz — one for students and a separate answer key.</p>
            <ol>
              <li>
                In RocketCourse, open the <strong>Quizzes</strong> tab and select the quiz you want to
                print.
              </li>
              <li>
                Export the <strong>student quiz PDF</strong> — the clean version with questions and answer
                space but no answers marked.
              </li>
              <li>
                Export the separate <strong>answer-key PDF</strong>, which includes the correct answers for
                grading.
              </li>
              <li>Print or distribute the student PDF; keep the answer-key PDF for yourself.</li>
            </ol>
            <p className="guide-warning">
              <AlertTriangle size={15} /> <strong>Keep the key private.</strong> The answer-key PDF is a
              separate file on purpose — do not hand it out or post it where students can reach it.
            </p>
          </div>
        </details>

        <details className="guide-detail">
          <summary>6. I want a PDF version of my syllabus.</summary>
          <div className="guide-steps">
            <p>Export a standalone syllabus PDF you can email, print, or attach.</p>
            <ol>
              <li>
                In RocketCourse, open the <strong>Syllabus</strong> tab and finish your syllabus content.
              </li>
              <li>
                Export the <strong>syllabus PDF</strong> and download it.
              </li>
              <li>Share the PDF directly, or upload it into Canvas as a file if you want it available there.</li>
            </ol>
            <p className="guide-note">
              <CheckCircle2 size={15} /> <strong>How it relates to Canvas.</strong> The syllabus PDF is a
              static, printable document. It is generated from the same syllabus content RocketCourse uses
              for the Canvas <strong>Syllabus</strong> page when you export a full course package, but the
              PDF itself is standalone — editing it does not change your Canvas syllabus, and vice versa.
            </p>
          </div>
        </details>

        <details className="guide-detail">
          <summary>7. I want to add only new content since my last export.</summary>
          <div className="guide-steps">
            <p>Do a partial export of just what changed, and manage the risk of duplicates carefully.</p>
            <ol>
              <li>
                In RocketCourse, identify exactly what is <strong>new or changed</strong> since your last
                export — for example a few new pages, one new quiz, or an updated assignment.
              </li>
              <li>
                Export only those items (a narrower export such as a single quiz, or a package containing
                only the new content) rather than re-exporting the whole course.
              </li>
              <li>
                Import that partial export into your target Canvas course using{" "}
                <strong>Settings → Import Course Content</strong>.
              </li>
              <li>
                After import, compare against what was already in the course and remove or reconcile any
                duplicates.
              </li>
            </ol>
            <p className="guide-warning">
              <AlertTriangle size={15} /> <strong>Duplicate risk.</strong> Canvas does not merge by default
              — re-importing content that already exists typically creates a second copy. If you are unsure,
              import into a blank or sandbox course first to see exactly what the partial export contains
              before touching a course with existing work.
            </p>
          </div>
        </details>

        <details className="guide-detail">
          <summary>8. I need to reset a Canvas test course.</summary>
          <div className="guide-steps">
            <p>
              Canvas course reset wipes a course back to empty. Use it only on a course you are sure you
              want emptied.
            </p>
            <ol>
              <li>
                Confirm you are in a <strong>blank or test course</strong> that contains nothing you need to
                keep.
              </li>
              <li>
                In that course, go to <strong>Settings</strong>.
              </li>
              <li>
                Use the Canvas <strong>Reset Course Content</strong> action and confirm when prompted.
              </li>
              <li>
                After the reset, the course is empty — you can then import a fresh RocketCourse{" "}
                <strong>.imscc</strong> package into it cleanly.
              </li>
            </ol>
            <p className="guide-warning">
              <AlertTriangle size={15} /> <strong>Destructive — this deletes course content.</strong>{" "}
              Resetting a Canvas course removes its existing content. <strong>Never reset a course that
              contains work you need to keep</strong> (student data, graded work, or anything you have not
              backed up). When in doubt, export the course first and only reset sandbox or test courses.
            </p>
          </div>
        </details>
      </section>

      {/* Warnings panel */}
      <section className="landing-section">
        <div className="guide-warnings">
          <h2>
            <AlertTriangle size={20} /> Read this before you import or reset
          </h2>
          <p>
            RocketCourse is designed for Canvas import workflows, but import is <strong>not yet
            sandbox-verified</strong>. Protect your live courses by treating evaluation as a sandbox
            activity.
          </p>
          <ul>
            <li>
              Do <strong>not</strong> import a RocketCourse demo <strong>.imscc</strong> into an active,
              live course with existing content unless you fully understand the consequences.
            </li>
            <li>
              Use a <strong>blank Canvas sandbox or an empty test course</strong> for evaluation.
            </li>
            <li>
              Importing into a course that already has content can create <strong>duplicates</strong>.
            </li>
            <li>
              Resetting a Canvas course <strong>deletes course content</strong> — only reset courses you can
              safely wipe.
            </li>
            <li>
              Always review generated <strong>pages, quizzes, assignments, dates, grading, links,
              accessibility, and policies</strong> before publishing.
            </li>
            <li>
              Always <strong>verify QTI imports and quiz answers</strong> before students take the quiz.
            </li>
          </ul>
        </div>
      </section>

      {/* Final CTA */}
      <section className="landing-cta">
        <h2>
          Ready to <span className="gradient-text">build</span>?
        </h2>
        <p>
          Explore the demo to see what a finished RocketCourse package looks like, or start building your
          own course now. Remember to import into a blank or sandbox Canvas course first.
        </p>
        <div className="hero-actions">
          <button className="primary" onClick={onStartBuilding}>
            Build your first course <ArrowRight size={16} />
          </button>
          <button className="secondary" onClick={onTryDemo}>
            Explore the demo <Sparkles size={16} />
          </button>
        </div>
      </section>
    </main>
  );
}
