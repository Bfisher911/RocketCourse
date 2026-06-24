// Pure, framework-free helpers for assembling Stripe Checkout parameters and resolving the number
// of team seats to provision. These live here (not inside a Netlify Function) so they are unit
// testable and shared: the checkout function and the webhook reason about seats the same way.
//
// IMPORTANT: resolveSeatCount drives workspace.seat_limit (invite capacity). It never multiplies a
// price. The current "team" plan is a flat bundle that *includes* its seatsLimit; a buyer cannot
// under-buy below that floor, and self-serve is capped at TEAM_SEAT_MAX (above that → contact sales
// or a per-seat price). When a per-seat Stripe price is configured, the webhook reads the Stripe
// item quantity instead and this floor/cap still applies as a safety clamp.

import type { Plan } from "../data/plans";

/** Smallest self-serve team size we will ever provision. */
export const TEAM_SEAT_MIN = 2;
/** Largest self-serve team size. Above this, route to contact-sales / per-seat pricing. */
export const TEAM_SEAT_MAX = 50;

/** A plan whose checkout/subscription can carry a buyer-chosen seat count (team-capable, recurring). */
export const isSeatSelectable = (plan: Plan): boolean =>
  plan.capabilities.teamWorkspace && plan.checkoutMode === "subscription";

/**
 * Resolve the seat count to provision for a workspace from a (possibly missing/invalid) request or
 * Stripe item quantity. Never below the plan's included seats, never above TEAM_SEAT_MAX. For
 * non-seat plans, returns the plan's own seat allowance (>= 1). Drives invite capacity, not price.
 */
export const resolveSeatCount = (plan: Plan, requested?: number | string | null): number => {
  if (!isSeatSelectable(plan)) return Math.max(plan.seatsLimit ?? 1, 1);
  const included = Math.max(plan.seatsLimit ?? TEAM_SEAT_MIN, TEAM_SEAT_MIN);
  const n = Math.floor(Number(requested));
  if (!Number.isFinite(n) || n <= 0) return included;
  return Math.min(Math.max(n, included), TEAM_SEAT_MAX);
};

/** Map a plan to the billing interval we persist on the subscription row. */
export const planBillingInterval = (plan: Plan): string => plan.billingInterval;
