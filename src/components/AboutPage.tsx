import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  Heart,
  Layers,
  Rocket,
  ShieldCheck,
  Sparkles,
  Users
} from "lucide-react";

// Public "About" page. Tells the RocketCourse story, the creator's background (Dr. Blaine Fisher),
// what the product believes, who it serves, and why a strong starting point matters — then routes
// the visitor into the builder, the demo, or a contact channel. Renders entirely with the existing
// cosmic landing-page CSS classes (page-shell / page-heading / landing-section / feature-grid /
// how-grid / landing-cta) so it stays visually consistent with PricingPage and the marketing surface.
// Canvas claims are deliberately qualified — RocketCourse produces a Canvas-oriented .imscc package
// and a strong first draft, never a verified-ready import or a finished course.

export function AboutPage({
  onStartBuilding,
  onTryDemo,
  onContact
}: {
  onStartBuilding: () => void;
  onTryDemo: () => void;
  onContact: () => void;
}) {
  return (
    <main className="about page-shell">
      <section className="page-heading" aria-labelledby="about-title">
        <div>
          <span className="section-eyebrow">
            <Sparkles size={14} /> About
          </span>
          <h1 id="about-title">
            About <span className="gradient-text">RocketCourse</span>
          </h1>
          <p>
            RocketCourse helps instructors and instructional designers turn a course idea, a syllabus, lecture
            notes, a reading list, or an existing Canvas export into a polished, fully editable course shell —
            organized modules, consistent pages, clear instructions, and a Canvas-oriented{" "}
            <strong>.imscc</strong> package you can import into a blank course and refine. It is built to remove
            the repetitive setup work so you can spend your time on the parts that actually need a human:
            teaching, accuracy, alignment, accessibility, and the student experience.
          </p>
        </div>
      </section>

      {/* The creator story */}
      <section className="landing-section about-creator" aria-labelledby="about-creator-title">
        <span className="section-eyebrow">
          <GraduationCap size={14} /> The creator
        </span>
        <h2 id="about-creator-title">Built by someone who lives in the LMS</h2>
        <p>
          RocketCourse was created by <strong>Dr. Blaine Fisher</strong>, who works across faculty teaching,
          instructional technology, Canvas and LMS administration, faculty development, and course design. He has
          taught in multiple subject areas and has spent years helping individual instructors and whole programs
          strengthen their online and blended courses — from first-time online faculty to seasoned teachers
          rebuilding a course from scratch.
        </p>
        <p>
          The idea came directly from that work. After building Canvas templates over and over, sitting with
          faculty to improve course structure and navigation, and watching how much time disappears into
          repetitive setup — duplicating module patterns, formatting pages, wiring up the same scaffolding before
          any real teaching design can begin — a pattern became obvious. The hard, valuable thinking was being
          crowded out by mechanical assembly. RocketCourse grew from that practical need: give instructors and
          designers a strong, structured starting point so their energy goes to the course, not the course shell.
        </p>
        <p>
          That background shapes every decision in the product. RocketCourse is opinionated about structure
          because consistent structure is what helps students, and it is deliberately humble about its output
          because a generated draft is a beginning, not an endpoint. The person who knows the subject, the
          students, and the standards is still the one in charge.
        </p>
      </section>

      {/* What RocketCourse believes */}
      <section className="landing-section about-values" aria-labelledby="about-values-title">
        <span className="section-eyebrow">
          <Heart size={14} /> What we believe
        </span>
        <h2 id="about-values-title">
          A strong draft, with <span className="gradient-text">humans in charge</span>
        </h2>
        <p>
          RocketCourse is built around a few firm beliefs about how good courses get made — and who is
          responsible for making them good.
        </p>
        <div className="feature-grid">
          <article className="feature-card">
            <span className="feature-icon cyan">
              <Layers size={22} />
            </span>
            <h3>Everything stays editable</h3>
            <p>
              No locked output and no black boxes. Every page, module, and assignment is yours to revise, because
              humans remain responsible for course quality, factual accuracy, teaching voice, academic standards,
              and the final review before anything reaches students.
            </p>
          </article>
          <article className="feature-card">
            <span className="feature-icon pink">
              <Users size={22} />
            </span>
            <h3>The student experience comes first</h3>
            <p>
              A course should be easy to move through. RocketCourse favors clear navigation, consistent module
              patterns, understandable instructions, and professional pages — the kind of structure that reduces
              confusion and lets students focus on learning instead of hunting for what to do next.
            </p>
          </article>
          <article className="feature-card">
            <span className="feature-icon orchid">
              <Heart size={22} />
            </span>
            <h3>Respect for the people involved</h3>
            <p>
              Instructors, instructional designers, instructional technologists, and students all bring real
              expertise and real constraints. RocketCourse is designed to support that work and reduce its busywork,
              not to talk over it or replace it.
            </p>
          </article>
          <article className="feature-card">
            <span className="feature-icon orange">
              <ShieldCheck size={22} />
            </span>
            <h3>Honest about what it is</h3>
            <p>
              RocketCourse produces a strong first draft, not a finished course. We say so plainly. The export is a
              Canvas-oriented <strong>.imscc</strong> package designed for Canvas import workflows — test it in a
              blank Canvas course first, then review, adjust, and make it yours.
            </p>
          </article>
          <article className="feature-card">
            <span className="feature-icon success">
              <CheckCircle2 size={22} />
            </span>
            <h3>Consistency you can build on</h3>
            <p>
              Predictable structure is a feature. Repeating module shapes, page layouts, and instructional
              patterns give you a dependable baseline to extend — and give students a course that feels coherent
              from the first week to the last.
            </p>
          </article>
          <article className="feature-card">
            <span className="feature-icon yellow">
              <BookOpen size={22} />
            </span>
            <h3>Accessibility and alignment are human work</h3>
            <p>
              A draft can set the stage, but accessibility, learning-objective alignment, and academic rigor
              deserve deliberate human attention. RocketCourse clears the setup so designers and instructors have
              the time to do that work well.
            </p>
          </article>
        </div>
      </section>

      {/* Who it's for */}
      <section className="landing-section about-audience" aria-labelledby="about-audience-title">
        <span className="section-eyebrow">
          <Users size={14} /> Who it's for
        </span>
        <h2 id="about-audience-title">Made for the people who build courses</h2>
        <p>
          RocketCourse fits a range of roles that share the same starting-line problem — an empty course shell and
          a lot of repetitive setup standing between an idea and a course students can actually use.
        </p>
        <div className="feature-grid">
          <article className="feature-card">
            <span className="feature-icon cyan">
              <GraduationCap size={22} />
            </span>
            <h3>Instructors and faculty</h3>
            <p>
              Professors, teachers, adjuncts, and first-time online instructors who want a structured, professional
              course to start from instead of a blank Canvas shell — and who still want full control over every
              detail.
            </p>
          </article>
          <article className="feature-card">
            <span className="feature-icon orchid">
              <Layers size={22} />
            </span>
            <h3>Designers and technologists</h3>
            <p>
              Instructional designers and instructional technologists who build and review many courses, and who
              benefit from a consistent baseline they can refine, standardize, and align to their own quality
              expectations.
            </p>
          </article>
          <article className="feature-card">
            <span className="feature-icon orange">
              <ShieldCheck size={22} />
            </span>
            <h3>Departments and institutions</h3>
            <p>
              Programs, departments, and institutions standardizing course structure across sections and terms —
              giving teams a shared, predictable starting point while local experts handle review, accessibility,
              and final approval.
            </p>
          </article>
        </div>
      </section>

      {/* Why a strong starting point matters */}
      <section className="landing-section about-research" aria-labelledby="about-research-title">
        <span className="section-eyebrow">
          <Sparkles size={14} /> The value
        </span>
        <h2 id="about-research-title">Why a strong starting point matters</h2>
        <p>
          Course development and quality review are widely recognized as time-intensive work. Designing modules,
          writing clear instructions, formatting pages, and reviewing a course for quality all take real effort —
          and that effort competes with everything else instructors and designers are responsible for. A strong,
          well-structured starting point is valuable precisely because it absorbs the repetitive part of that
          labor.
        </p>
        <p>
          Consistent, well-structured LMS course design also supports the student experience. Established quality
          frameworks in higher education — such as <strong>Quality Matters</strong> and{" "}
          <strong>SUNY OSCQR</strong> — emphasize clear organization, navigability, measurable objectives, and
          usability, and accessibility standards such as <strong>WCAG 2.1 AA</strong> and{" "}
          <strong>Section 508</strong> set expectations for inclusive, accessible content. RocketCourse is built
          to produce a baseline that gives you a head start toward the kind of structure these frameworks reward —
          while leaving the actual review, judgment, and compliance work to the humans those standards are written
          for.
        </p>
        <div className="how-grid">
          <article className="step-card">
            <span className="step-index">1</span>
            <h3>Start from structure, not a blank page</h3>
            <p>
              RocketCourse turns your inputs into organized modules and consistent pages, so you skip the
              mechanical scaffolding and begin with something to react to and shape.
            </p>
          </article>
          <article className="step-card">
            <span className="step-index">2</span>
            <h3>Reduce the repetitive labor</h3>
            <p>
              The most repeatable parts of course setup — duplicated patterns, formatting, and boilerplate — are
              handled up front, freeing your time for teaching design and quality.
            </p>
          </article>
          <article className="step-card">
            <span className="step-index">3</span>
            <h3>Spend your time where it counts</h3>
            <p>
              With the shell in place, you can focus on accuracy, alignment, accessibility, and the student
              experience — and on testing the import in a blank Canvas course before going live.
            </p>
          </article>
        </div>
        <p className="muted-note">
          Sources &amp; assumptions: Costs and time for course development vary widely by institution, course
          type, media production, review requirements, and accessibility needs, so any single figure would be
          misleading. RocketCourse makes no guaranteed percentage cost or time savings claim — it reduces
          repetitive setup labor and provides a strong baseline. Quality Matters, SUNY OSCQR, and WCAG 2.1 AA /
          Section 508 are independent, real frameworks referenced here for context; RocketCourse is not affiliated
          with or endorsed by them, and a generated draft is not a substitute for human quality and accessibility
          review.
        </p>
      </section>

      {/* Final CTA */}
      <section className="landing-cta" aria-labelledby="about-cta-title">
        <h2 id="about-cta-title">Start with a strong draft, then make it yours</h2>
        <p>
          Build a structured Canvas-oriented course shell in minutes, or explore the demo first to see how it
          works. However you start, you stay in control of the final course.
        </p>
        <div className="hero-actions">
          <button className="primary" onClick={onStartBuilding}>
            <Rocket size={16} /> Build your first course <ArrowRight size={16} />
          </button>
          <button className="secondary" onClick={onTryDemo}>
            Explore the demo
          </button>
          <button className="ghost-button" onClick={onContact}>
            Contact us
          </button>
        </div>
      </section>
    </main>
  );
}
