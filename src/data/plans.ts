// Canonical plan catalog — the single source of truth for pricing, entitlement limits,
// and Stripe product/price sync. The pricing page renders from this, the entitlement
// service enforces these limits, and the Stripe sync script (scripts/stripe-sync) creates
// matching test-mode products/prices. The Supabase `plans` table is seeded to agree with
// this catalog (supabase/migrations/0002_seed_plans.sql) — keep them in sync.
//
// IMPORTANT: limits here are the contract the SERVER enforces against a trusted Supabase
// subscription row. They are never the source of a user's *actual* entitlement at runtime
// (that comes from their `subscriptions` row, written only by the Stripe webhook). This
// catalog defines what each plan *grants*; the subscription row records what's been *used*.

export type PlanKey =
  | "free_preview"
  | "individual_semester"
  | "individual_annual"
  | "monthly_instructor"
  | "designer_pro"
  | "team"
  | "department_pilot"
  | "institution";

/** How a plan is purchased. `payment` = one-time (semester pass). `contact` = sales/invoice. */
export type PlanCheckoutMode = "free" | "subscription" | "payment" | "contact";

/** Stripe recurring interval, or one_time / contact for non-recurring plans. */
export type PlanBillingInterval = "month" | "year" | "one_time" | "contact";

export interface PlanCapabilities {
  /** Can save private (non-demo) course projects to the account. */
  privateProjects: boolean;
  /** Can run server-side AI generation (blueprint + full course) and AI revise. */
  aiGeneration: boolean;
  /** Can export a private generated course to `.imscc`. */
  privateExport: boolean;
  /** Can create + save custom school themes (colors + logo). */
  customThemes: boolean;
  /** Can upload and parse source material (syllabus/notes) — advanced tier. */
  sourceParsing: boolean;
  /** Advanced AI revise tools (alternative versions, rigor/tone passes). */
  advancedRevise: boolean;
  /** Can create a shared team workspace with multiple seats. */
  teamWorkspace: boolean;
}

export interface Plan {
  key: PlanKey;
  name: string;
  tagline: string;
  /** Price in cents for the billing period below. 0 for free/contact. */
  priceCents: number;
  billingInterval: PlanBillingInterval;
  checkoutMode: PlanCheckoutMode;
  /**
   * Entitlement duration in months granted per purchase. Used for one-time "semester pass"
   * plans to compute current_period_end (e.g. 4 months). Recurring plans use Stripe's period.
   */
  entitlementMonths: number;
  /** Hard caps. `null` = unlimited / negotiated (contact-sales tiers). */
  aiGenerationsLimit: number | null;
  exportsLimit: number | null;
  seatsLimit: number | null;
  /** Max private course projects retained. `null` = unlimited. */
  projectsLimit: number | null;
  capabilities: PlanCapabilities;
  /** Bullet points shown on the pricing card. */
  features: string[];
  /** Audience targeting copy for the pricing card. */
  audience: string;
  /** Highlight as the recommended plan on the pricing page. */
  highlighted?: boolean;
  /** Display order on the pricing page. */
  order: number;
  active: boolean;
  /**
   * Stripe Price ID, resolved at runtime from env (set after running the Stripe sync script).
   * Never hardcode a live price id here. The env var name is derived: STRIPE_PRICE_<KEY_UPPER>.
   */
  stripePriceEnvVar?: string;
}

const noCapabilities: PlanCapabilities = {
  privateProjects: false,
  aiGeneration: false,
  privateExport: false,
  customThemes: false,
  sourceParsing: false,
  advancedRevise: false,
  teamWorkspace: false
};

export const plans: Plan[] = [
  {
    key: "free_preview",
    name: "Free Preview",
    tagline: "See CourseForge with a prebuilt sample course.",
    priceCents: 0,
    billingInterval: "contact",
    checkoutMode: "free",
    entitlementMonths: 0,
    aiGenerationsLimit: 0,
    exportsLimit: 0,
    seatsLimit: 1,
    projectsLimit: 0,
    capabilities: { ...noCapabilities },
    audience: "Anyone evaluating CourseForge",
    features: [
      "Public static demo course",
      "Browse the read-only sample editor",
      "Download a sample .imscc package",
      "No AI generation — no account required",
      "No private projects"
    ],
    order: 0,
    active: true
  },
  {
    key: "individual_semester",
    name: "Individual Semester",
    tagline: "One semester of AI course building for a single instructor.",
    priceCents: 7900,
    billingInterval: "one_time",
    checkoutMode: "payment",
    entitlementMonths: 4,
    aiGenerationsLimit: 10,
    exportsLimit: 15,
    seatsLimit: 1,
    projectsLimit: 5,
    capabilities: {
      ...noCapabilities,
      privateProjects: true,
      aiGeneration: true,
      privateExport: true,
      customThemes: true
    },
    audience: "Individual instructors",
    features: [
      "4 months of access (semester pass)",
      "10 AI course generations",
      "15 Canvas .imscc exports",
      "Built-in + custom themes",
      "Save up to 5 private courses"
    ],
    highlighted: true,
    order: 1,
    active: true,
    stripePriceEnvVar: "STRIPE_PRICE_INDIVIDUAL_SEMESTER"
  },
  {
    key: "individual_annual",
    name: "Individual Annual",
    tagline: "A full year of AI course building for a single instructor.",
    priceCents: 19900,
    billingInterval: "year",
    checkoutMode: "subscription",
    entitlementMonths: 12,
    aiGenerationsLimit: 30,
    exportsLimit: 50,
    seatsLimit: 1,
    projectsLimit: 25,
    capabilities: {
      ...noCapabilities,
      privateProjects: true,
      aiGeneration: true,
      privateExport: true,
      customThemes: true
    },
    audience: "Individual instructors",
    features: [
      "12 months of access",
      "30 AI course generations",
      "50 Canvas .imscc exports",
      "Built-in + custom themes",
      "Save up to 25 private courses"
    ],
    order: 2,
    active: true,
    stripePriceEnvVar: "STRIPE_PRICE_INDIVIDUAL_ANNUAL"
  },
  {
    key: "monthly_instructor",
    name: "Monthly Instructor",
    tagline: "Month-to-month access for short bursts of building.",
    priceCents: 2900,
    billingInterval: "month",
    checkoutMode: "subscription",
    entitlementMonths: 1,
    aiGenerationsLimit: 8,
    exportsLimit: 12,
    seatsLimit: 1,
    projectsLimit: 5,
    capabilities: {
      ...noCapabilities,
      privateProjects: true,
      aiGeneration: true,
      privateExport: true,
      customThemes: true
    },
    audience: "Individual instructors",
    features: [
      "Billed monthly, cancel anytime",
      "8 AI course generations / month",
      "12 Canvas .imscc exports / month",
      "Built-in + custom themes",
      "Save up to 5 private courses"
    ],
    order: 3,
    active: true,
    stripePriceEnvVar: "STRIPE_PRICE_MONTHLY_INSTRUCTOR"
  },
  {
    key: "designer_pro",
    name: "Designer Pro",
    tagline: "For instructional designers building many courses.",
    priceCents: 39900,
    billingInterval: "year",
    checkoutMode: "subscription",
    entitlementMonths: 12,
    aiGenerationsLimit: 100,
    exportsLimit: 200,
    seatsLimit: 1,
    projectsLimit: null,
    capabilities: {
      ...noCapabilities,
      privateProjects: true,
      aiGeneration: true,
      privateExport: true,
      customThemes: true,
      sourceParsing: true,
      advancedRevise: true
    },
    audience: "Instructional designers",
    features: [
      "100 AI course generations / year",
      "200 Canvas .imscc exports / year",
      "Unlimited saved courses",
      "Source upload + parsing",
      "Advanced AI revise tools"
    ],
    order: 4,
    active: true,
    stripePriceEnvVar: "STRIPE_PRICE_DESIGNER_PRO"
  },
  {
    key: "team",
    name: "Team",
    tagline: "A shared workspace for a teaching team or small program.",
    priceCents: 99900,
    billingInterval: "year",
    checkoutMode: "subscription",
    entitlementMonths: 12,
    aiGenerationsLimit: 300,
    exportsLimit: 600,
    seatsLimit: 5,
    projectsLimit: null,
    capabilities: {
      ...noCapabilities,
      privateProjects: true,
      aiGeneration: true,
      privateExport: true,
      customThemes: true,
      sourceParsing: true,
      advancedRevise: true,
      teamWorkspace: true
    },
    audience: "Departments & teaching teams",
    features: [
      "5 seats in a shared workspace",
      "300 AI course generations / year",
      "600 Canvas .imscc exports / year",
      "Shared templates & themes",
      "Billing portal & invoices"
    ],
    order: 5,
    active: true,
    stripePriceEnvVar: "STRIPE_PRICE_TEAM"
  },
  {
    key: "department_pilot",
    name: "Department Pilot",
    tagline: "A guided pilot for a department or program.",
    priceCents: 0,
    billingInterval: "contact",
    checkoutMode: "contact",
    entitlementMonths: 12,
    aiGenerationsLimit: null,
    exportsLimit: null,
    seatsLimit: 15,
    projectsLimit: null,
    capabilities: {
      ...noCapabilities,
      privateProjects: true,
      aiGeneration: true,
      privateExport: true,
      customThemes: true,
      sourceParsing: true,
      advancedRevise: true,
      teamWorkspace: true
    },
    audience: "Departments & programs",
    features: [
      "Invoice billing ($2,500–$5,000 / year)",
      "Custom onboarding",
      "Up to 15 seats",
      "Admin controls",
      "Security & data review path"
    ],
    order: 6,
    active: true
  },
  {
    key: "institution",
    name: "Institution",
    tagline: "Campus-wide deployment with admin and security review.",
    priceCents: 0,
    billingInterval: "contact",
    checkoutMode: "contact",
    entitlementMonths: 12,
    aiGenerationsLimit: null,
    exportsLimit: null,
    seatsLimit: null,
    projectsLimit: null,
    capabilities: {
      ...noCapabilities,
      privateProjects: true,
      aiGeneration: true,
      privateExport: true,
      customThemes: true,
      sourceParsing: true,
      advancedRevise: true,
      teamWorkspace: true
    },
    audience: "Institutions",
    features: [
      "Invoice billing (from $7,500 / year)",
      "Custom onboarding & training",
      "Unlimited seats",
      "Admin controls & audit",
      "SSO roadmap & DPA"
    ],
    order: 7,
    active: true
  }
];

export const planByKey: Record<PlanKey, Plan> = plans.reduce(
  (map, plan) => {
    map[plan.key] = plan;
    return map;
  },
  {} as Record<PlanKey, Plan>
);

export const getPlan = (key: PlanKey): Plan => planByKey[key];

/** Plans that are purchased via Stripe Checkout (self-serve), in display order. */
export const selfServePlans = (): Plan[] =>
  plans.filter((plan) => plan.checkoutMode === "subscription" || plan.checkoutMode === "payment");

/** Plans routed to a contact-sales / invoice flow. */
export const contactSalesPlans = (): Plan[] => plans.filter((plan) => plan.checkoutMode === "contact");

export const formatPlanPrice = (plan: Plan): string => {
  if (plan.checkoutMode === "free") return "Free";
  if (plan.checkoutMode === "contact") return "Contact sales";
  const dollars = plan.priceCents / 100;
  const amount = Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
  if (plan.billingInterval === "month") return `${amount}/mo`;
  if (plan.billingInterval === "year") return `${amount}/yr`;
  if (plan.billingInterval === "one_time") return `${amount}`;
  return amount;
};

export const planPriceSuffix = (plan: Plan): string => {
  if (plan.billingInterval === "one_time") return `${plan.entitlementMonths}-month pass`;
  if (plan.billingInterval === "month") return "per month";
  if (plan.billingInterval === "year") return "per year";
  return "";
};
