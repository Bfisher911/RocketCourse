-- Seed the public.plans catalog. Values mirror src/data/plans.ts (the app's source of truth).
-- Idempotent: re-running updates existing rows. stripe_price_id is left null here; the Stripe
-- sync step (scripts/stripe-sync.md) creates test-mode prices and records their ids.

insert into public.plans
  (key, name, billing_interval, checkout_mode, price_cents, entitlement_months,
   exports_limit, ai_generations_limit, seats_limit, projects_limit, capabilities, features, active, sort_order)
values
  ('free_preview', 'Free Preview', 'contact', 'free', 0, 0,
   0, 0, 1, 0,
   '{"privateProjects":false,"aiGeneration":false,"privateExport":false,"customThemes":false,"sourceParsing":false,"advancedRevise":false,"teamWorkspace":false}'::jsonb,
   '["Public static demo course","Browse the read-only sample editor","Download a sample .imscc package","No AI generation — no account required","No private projects"]'::jsonb,
   true, 0),

  ('individual_semester', 'Individual Semester', 'one_time', 'payment', 7900, 4,
   15, 10, 1, 5,
   '{"privateProjects":true,"aiGeneration":true,"privateExport":true,"customThemes":true,"sourceParsing":false,"advancedRevise":false,"teamWorkspace":false}'::jsonb,
   '["4 months of access (semester pass)","10 AI course generations","15 Canvas .imscc exports","Built-in + custom themes","Save up to 5 private courses"]'::jsonb,
   true, 1),

  ('individual_annual', 'Individual Annual', 'year', 'subscription', 19900, 12,
   50, 30, 1, 25,
   '{"privateProjects":true,"aiGeneration":true,"privateExport":true,"customThemes":true,"sourceParsing":false,"advancedRevise":false,"teamWorkspace":false}'::jsonb,
   '["12 months of access","30 AI course generations","50 Canvas .imscc exports","Built-in + custom themes","Save up to 25 private courses"]'::jsonb,
   true, 2),

  ('monthly_instructor', 'Monthly Instructor', 'month', 'subscription', 2900, 1,
   12, 8, 1, 5,
   '{"privateProjects":true,"aiGeneration":true,"privateExport":true,"customThemes":true,"sourceParsing":false,"advancedRevise":false,"teamWorkspace":false}'::jsonb,
   '["Billed monthly, cancel anytime","8 AI course generations / month","12 Canvas .imscc exports / month","Built-in + custom themes","Save up to 5 private courses"]'::jsonb,
   true, 3),

  ('designer_pro', 'Designer Pro', 'year', 'subscription', 39900, 12,
   200, 100, 1, null,
   '{"privateProjects":true,"aiGeneration":true,"privateExport":true,"customThemes":true,"sourceParsing":true,"advancedRevise":true,"teamWorkspace":false}'::jsonb,
   '["100 AI course generations / year","200 Canvas .imscc exports / year","Unlimited saved courses","Source upload + parsing","Advanced AI revise tools"]'::jsonb,
   true, 4),

  ('team', 'Team', 'year', 'subscription', 99900, 12,
   600, 300, 5, null,
   '{"privateProjects":true,"aiGeneration":true,"privateExport":true,"customThemes":true,"sourceParsing":true,"advancedRevise":true,"teamWorkspace":true}'::jsonb,
   '["5 seats in a shared workspace","300 AI course generations / year","600 Canvas .imscc exports / year","Shared templates & themes","Billing portal & invoices"]'::jsonb,
   true, 5),

  ('department_pilot', 'Department Pilot', 'contact', 'contact', 0, 12,
   null, null, 15, null,
   '{"privateProjects":true,"aiGeneration":true,"privateExport":true,"customThemes":true,"sourceParsing":true,"advancedRevise":true,"teamWorkspace":true}'::jsonb,
   '["Invoice billing ($2,500–$5,000 / year)","Custom onboarding","Up to 15 seats","Admin controls","Security & data review path"]'::jsonb,
   true, 6),

  ('institution', 'Institution', 'contact', 'contact', 0, 12,
   null, null, null, null,
   '{"privateProjects":true,"aiGeneration":true,"privateExport":true,"customThemes":true,"sourceParsing":true,"advancedRevise":true,"teamWorkspace":true}'::jsonb,
   '["Invoice billing (from $7,500 / year)","Custom onboarding & training","Unlimited seats","Admin controls & audit","SSO roadmap & DPA"]'::jsonb,
   true, 7)

on conflict (key) do update set
  name = excluded.name,
  billing_interval = excluded.billing_interval,
  checkout_mode = excluded.checkout_mode,
  price_cents = excluded.price_cents,
  entitlement_months = excluded.entitlement_months,
  exports_limit = excluded.exports_limit,
  ai_generations_limit = excluded.ai_generations_limit,
  seats_limit = excluded.seats_limit,
  projects_limit = excluded.projects_limit,
  capabilities = excluded.capabilities,
  features = excluded.features,
  active = excluded.active,
  sort_order = excluded.sort_order;
