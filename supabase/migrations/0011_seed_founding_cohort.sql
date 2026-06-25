-- ===========================================================================
-- RocketCourse — Seed the first campaign: the RocketCourse Founding Cohort.
--
-- Idempotent: inserted only when no campaign with slug 'founding-cohort' exists,
-- so re-running migrations never duplicates it and never clobbers Super-Admin
-- edits made after seeding. The Stripe coupon/promotion code are intentionally
-- left null — they are created server-side from the Super Admin (Stripe is the
-- source of truth) and linked via discount_record_id afterwards.
-- ===========================================================================

insert into public.campaigns (
  name, slug, type, status, placement,
  headline, subheadline, description, cta_text,
  offer_summary, discount_percent, discount_duration, discount_duration_months, annual_discount_percent,
  webinar_title, webinar_description, webinar_capacity, webinar_rsvp_status,
  referral_reward_summary, referral_threshold, referral_reward_months, referral_referred_discount_percent,
  audience_label, confirmation_message, when_full, require_approval, plan_key
)
select
  'RocketCourse Founding Cohort',
  'founding-cohort',
  'waitlist',
  'active',
  'homepage_hero',
  'Build your next Canvas course before your coffee gets cold.',
  'RocketCourse helps instructors and instructional designers turn a course idea into an editable Canvas-oriented course shell with modules, assignments, discussions, quizzes, rubrics, and export-ready structure.',
  'Join the founding cohort for early access, a live AI course-building workshop, and a launch discount.',
  'Join the Founding Cohort',
  '40% off your first 3 months as a founding member — plus workshop access, early product access, and a launch discount code.',
  40, 'repeating', 3, 30,
  'AI Course Building Workshop',
  'A practical launch workshop showing how to move from a rough course idea to a structured Canvas course shell.',
  100, 'open',
  'Invite 3 colleagues, unlock one free month after launch.',
  3, 1, 10,
  'Instructors & instructional designers',
  'You''re in! Check your email for your founding-cohort details — your launch discount code and workshop link are on the way.',
  'waitlist', false, 'individual_annual'
where not exists (select 1 from public.campaigns where slug = 'founding-cohort');
