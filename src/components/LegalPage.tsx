import { FileText, ShieldCheck, Sparkles } from "lucide-react";

// Terms and Privacy. Plain-language, honest, and scoped to what RocketCourse actually does today.
// These are good-faith summaries, not legal advice; the owner should have counsel review before a
// commercial launch (noted in docs/SAAS_SETUP.md).

export function LegalPage({ kind, onContact }: { kind: "terms" | "privacy"; onContact: () => void }) {
  return kind === "terms" ? <Terms onContact={onContact} /> : <Privacy onContact={onContact} />;
}

function Terms({ onContact }: { onContact: () => void }) {
  return (
    <main id="main-content" tabIndex={-1} className="legal page-shell" aria-labelledby="terms-heading">
      <section className="page-heading">
        <div>
          <span className="section-eyebrow">
            <FileText size={14} /> Terms
          </span>
          <h1 id="terms-heading">Terms of Service</h1>
          <p>Plain-language terms for using RocketCourse. By using the product you agree to the points below.</p>
        </div>
      </section>

      <section className="landing-section legal-body">
        <h2>What RocketCourse provides</h2>
        <p>
          RocketCourse helps you generate an editable, Canvas-oriented course shell and export a Common Cartridge
          (<strong>.imscc</strong>) package along with QTI and PDF files. Generated content is a starting draft. You are
          responsible for reviewing accuracy, quality, accessibility, grading, dates, policies, and academic standards
          before using anything with students.
        </p>

        <h2>Human review is required</h2>
        <p>
          AI-assisted and template-generated content — including quizzes and answer keys — may contain errors. You must
          verify every object before publishing. RocketCourse does not replace instructors, instructional designers, or
          institutional review.
        </p>

        <h2>Canvas compatibility</h2>
        <p>
          Exports follow Common Cartridge structure and public Canvas exporter conventions. Canvas import behavior can
          vary by version and configuration, so test in a blank or sandbox Canvas course first. RocketCourse is not
          affiliated with or endorsed by Instructure or Canvas.
        </p>

        <h2>Accounts, plans, and acceptable use</h2>
        <p>
          Paid features (AI generation and private export) require an account and an active plan. Don't attempt to
          circumvent entitlement, upload content you don't have the rights to use, or use the service unlawfully. We may
          suspend access for abuse.
        </p>

        <h2>No warranty; limitation of liability</h2>
        <p>
          The service is provided "as is" without warranties. To the extent permitted by law, RocketCourse is not liable
          for indirect or consequential damages arising from use of the product or generated content.
        </p>

        <h2>Changes</h2>
        <p>
          These terms may be updated as the product evolves. Material changes will be reflected here. Questions?{" "}
          <button className="link-inline" onClick={onContact}>
            Contact us
          </button>
          .
        </p>
      </section>
    </main>
  );
}

function Privacy({ onContact }: { onContact: () => void }) {
  return (
    <main id="main-content" tabIndex={-1} className="legal page-shell" aria-labelledby="privacy-heading">
      <section className="page-heading">
        <div>
          <span className="section-eyebrow">
            <ShieldCheck size={14} /> Privacy
          </span>
          <h1 id="privacy-heading">Privacy</h1>
          <p>What RocketCourse collects, why, and how your course content and uploads are handled.</p>
        </div>
      </section>

      <section className="landing-section legal-body">
        <h2>What we collect</h2>
        <p>
          If you create an account, we store your email and authentication record, your subscription/entitlement status,
          and the course projects and custom themes you save. The public demo saves nothing to an account.
        </p>

        <h2>Course prompts and uploaded sources</h2>
        <p>
          When you generate a course, your prompt and any text extracted from uploaded sources are sent to the AI
          provider to produce your draft. Source files you attach are parsed in your browser to extract text; that text
          is used to inform generation. We don't sell your content, and we don't use it to train third-party models
          beyond what's needed to fulfill your request.
        </p>
        <p className="muted-note">
          <Sparkles size={13} /> Source retention: uploaded files are processed for text and are not retained as files
          on our servers. Saved course projects (your generated/edited content) are stored to your account so you can
          return to them, and you can delete them.
        </p>

        <h2>Payments</h2>
        <p>
          Payments are handled by Stripe. We don't store full card details; Stripe processes them under its own terms and
          security.
        </p>

        <h2>Contact form</h2>
        <p>
          When you send a message through the contact form, we use your name, email, and message to reply. The form
          includes basic spam protection and does not set advertising trackers.
        </p>

        <h2>Your choices</h2>
        <p>
          You can edit or delete your saved projects, and you can request account deletion. For privacy questions or
          requests,{" "}
          <button className="link-inline" onClick={onContact}>
            contact us
          </button>
          .
        </p>
      </section>
    </main>
  );
}
