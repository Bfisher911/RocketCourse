// One-off: create (idempotently) the Founding Cohort Stripe coupon + promotion code in the SAME
// Stripe account the app uses (reads STRIPE_SECRET_KEY straight from .env), then print the IDs as
// JSON so they can be linked into Supabase. Test-mode only is expected. Safe to re-run.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Stripe from "stripe";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = readFileSync(join(root, ".env"), "utf8");
const pick = (k) => (env.match(new RegExp(`^${k}=(.+)$`, "m"))?.[1] ?? "").trim().replace(/^['"]|['"]$/g, "");

const key = pick("STRIPE_SECRET_KEY");
if (!key) throw new Error("STRIPE_SECRET_KEY not found in .env");
const mode = key.startsWith("sk_live_") ? "LIVE" : "TEST";

const PROMO_CODE = "FOUNDING40";
const MAX_REDEMPTIONS = 100;

const stripe = new Stripe(key);

const main = async () => {
  // Idempotent: reuse an existing active FOUNDING40 promo if present.
  const existing = await stripe.promotionCodes.list({ code: PROMO_CODE, limit: 1 });
  if (existing.data[0]) {
    const promo = existing.data[0];
    console.log(JSON.stringify({ mode, reused: true, couponId: promo.coupon.id, promoId: promo.id, code: promo.code, maxRedemptions: promo.max_redemptions ?? null }));
    return;
  }

  const coupon = await stripe.coupons.create({
    percent_off: 40,
    duration: "repeating",
    duration_in_months: 3,
    name: "Founding Cohort 40% off 3 months",
    metadata: { campaign: "founding-cohort" }
  });

  const promo = await stripe.promotionCodes.create({
    coupon: coupon.id,
    code: PROMO_CODE,
    max_redemptions: MAX_REDEMPTIONS,
    metadata: { campaign: "founding-cohort" }
  });

  console.log(JSON.stringify({ mode, reused: false, couponId: coupon.id, promoId: promo.id, code: promo.code, maxRedemptions: promo.max_redemptions ?? null }));
};

main().catch((e) => {
  console.error("STRIPE_ERROR:", e?.message ?? e);
  process.exit(1);
});
