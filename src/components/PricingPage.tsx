import { ArrowRight, Building2, Check, Sparkles, Star } from "lucide-react";
import {
  contactSalesPlans,
  formatPlanPrice,
  planPriceSuffix,
  plans,
  selfServePlans,
  type Plan,
  type PlanKey
} from "../data/plans";

// Public pricing page. Renders entirely from the plan catalog (src/data/plans.ts) so the cards,
// the entitlement limits, and the Stripe sync never drift. The CTA is delegated to the parent
// (`onChoosePlan`) which routes self-serve plans to Stripe Checkout (when configured) or the
// signup flow, and contact-sales plans to a sales email.

const SALES_EMAIL = "sales@courseforge.app";

export function PricingPage({
  onChoosePlan,
  onTryDemo,
  currentPlanKey
}: {
  onChoosePlan: (plan: Plan) => void;
  onTryDemo: () => void;
  currentPlanKey?: PlanKey;
}) {
  const free = plans.find((plan) => plan.key === "free_preview");
  const paid = selfServePlans();
  const sales = contactSalesPlans();

  return (
    <main className="pricing page-shell">
      <section className="page-heading pricing-heading">
        <div>
          <span className="section-eyebrow">
            <Sparkles size={14} /> Pricing
          </span>
          <h1>
            Plans for instructors, designers, and <span className="gradient-text">whole departments</span>
          </h1>
          <p>
            CourseForge is a Canvas-first AI course builder. Start free with a static sample, then pick a plan to
            generate, edit, theme, and export your own Canvas-importable <strong>.imscc</strong> packages.
          </p>
        </div>
      </section>

      {/* Free preview banner — public, no AI, no account */}
      {free && (
        <section className="pricing-free-banner">
          <div>
            <span className="hp-eyebrow">
              <Star size={14} /> {free.name} · {formatPlanPrice(free)}
            </span>
            <h2>{free.tagline}</h2>
            <ul className="pricing-free-points">
              {free.features.map((feature) => (
                <li key={feature}>
                  <Check size={15} /> {feature}
                </li>
              ))}
            </ul>
          </div>
          <button className="secondary" onClick={onTryDemo}>
            Try the static demo <ArrowRight size={16} />
          </button>
        </section>
      )}

      {/* Self-serve plans */}
      <section className="pricing-grid" aria-label="Self-serve plans">
        {paid.map((plan) => {
          const isCurrent = plan.key === currentPlanKey;
          return (
            <article key={plan.key} className={`pricing-card ${plan.highlighted ? "featured" : ""}`}>
              {plan.highlighted && <span className="pricing-flag">Most popular</span>}
              <header className="pricing-card-head">
                <h3>{plan.name}</h3>
                <p className="pricing-audience">{plan.audience}</p>
                <div className="pricing-price">
                  <strong>{formatPlanPrice(plan)}</strong>
                  <small>{planPriceSuffix(plan)}</small>
                </div>
                <p className="pricing-tagline">{plan.tagline}</p>
              </header>
              <ul className="pricing-features">
                {plan.features.map((feature) => (
                  <li key={feature}>
                    <Check size={15} /> {feature}
                  </li>
                ))}
              </ul>
              <button
                className={plan.highlighted ? "primary" : "secondary"}
                onClick={() => onChoosePlan(plan)}
                disabled={isCurrent}
              >
                {isCurrent ? "Current plan" : `Choose ${plan.name}`}
                {!isCurrent && <ArrowRight size={16} />}
              </button>
            </article>
          );
        })}
      </section>

      {/* Contact-sales plans */}
      <section className="pricing-sales" aria-label="Department and institution plans">
        <div className="pricing-sales-head">
          <span className="section-eyebrow">
            <Building2 size={14} /> Departments & institutions
          </span>
          <h2>Bigger rollouts, invoicing, and admin controls</h2>
          <p>Seat-based access, custom onboarding, and a security/data review path. Billed by invoice.</p>
        </div>
        <div className="pricing-sales-grid">
          {sales.map((plan) => (
            <article key={plan.key} className="pricing-sales-card">
              <h3>{plan.name}</h3>
              <p className="pricing-tagline">{plan.tagline}</p>
              <ul className="pricing-features">
                {plan.features.map((feature) => (
                  <li key={feature}>
                    <Check size={15} /> {feature}
                  </li>
                ))}
              </ul>
              <a className="link-button" href={`mailto:${SALES_EMAIL}?subject=CourseForge ${encodeURIComponent(plan.name)} inquiry`}>
                Contact sales <ArrowRight size={16} />
              </a>
            </article>
          ))}
        </div>
      </section>

      <p className="pricing-note">
        Prices shown in USD. Paid plans unlock AI course generation and private Canvas exports; the free preview is a
        static sample with no AI. Export limits and AI generation limits are enforced on the server against your
        subscription — never the browser.
      </p>
    </main>
  );
}
