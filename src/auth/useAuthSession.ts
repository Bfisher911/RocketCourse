// React hook wiring auth + entitlement into one place the app consumes. Owns the session and the
// derived entitlement summary, exposes auth actions, and reloads the subscription after sign-in or
// an explicit refresh (used by the "I just paid — check status" button after Stripe Checkout).

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  authMode,
  getSession,
  onAuthChange,
  signIn as authSignIn,
  signOut as authSignOut,
  signUp as authSignUp,
  type AuthSession
} from "./authClient";
import { loadSubscription, setLocalPlan } from "../billing/subscriptionClient";
import { freeSubscription, summarizeEntitlement, type EntitlementSubscription } from "../services/entitlement";
import type { PlanKey } from "../data/plans";

export interface AuthSessionState {
  session: AuthSession | null;
  subscription: EntitlementSubscription;
  entitlement: ReturnType<typeof summarizeEntitlement>;
  loading: boolean;
  authMode: ReturnType<typeof authMode>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ ok: boolean; message?: string; needsEmailConfirmation?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  signOut: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
  /** DEV ONLY (local mode): simulate a plan so the demo works without Stripe. */
  devSetPlan: (planKey: PlanKey) => Promise<void>;
}

export const useAuthSession = (): AuthSessionState => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [subscription, setSubscription] = useState<EntitlementSubscription>(freeSubscription());
  const [loading, setLoading] = useState(true);

  const syncSubscription = useCallback(async (current: AuthSession | null) => {
    const sub = await loadSubscription(current);
    setSubscription(sub);
  }, []);

  // Initial session load + (in supabase mode) live auth subscription.
  useEffect(() => {
    let active = true;
    void (async () => {
      const current = await getSession();
      if (!active) return;
      setSession(current);
      await syncSubscription(current);
      setLoading(false);
    })();

    const unsub = onAuthChange((next) => {
      setSession(next);
      void syncSubscription(next);
    });
    return () => {
      active = false;
      unsub();
    };
  }, [syncSubscription]);

  const signUp = useCallback(
    async (email: string, password: string, fullName: string) => {
      const result = await authSignUp(email, password, fullName);
      if (result.error) return { ok: false, message: result.error };
      if (result.needsEmailConfirmation) return { ok: true, needsEmailConfirmation: true };
      setSession(result.session);
      await syncSubscription(result.session);
      return { ok: true };
    },
    [syncSubscription]
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      const result = await authSignIn(email, password);
      if (result.error || !result.session) return { ok: false, message: result.error ?? "Sign in failed." };
      setSession(result.session);
      await syncSubscription(result.session);
      return { ok: true };
    },
    [syncSubscription]
  );

  const signOut = useCallback(async () => {
    await authSignOut();
    setSession(null);
    setSubscription(freeSubscription());
  }, []);

  const refreshSubscription = useCallback(async () => {
    await syncSubscription(session);
  }, [session, syncSubscription]);

  const devSetPlan = useCallback(
    async (planKey: PlanKey) => {
      setLocalPlan(planKey);
      await syncSubscription(session);
    },
    [session, syncSubscription]
  );

  const entitlement = useMemo(() => summarizeEntitlement(subscription), [subscription]);

  return {
    session,
    subscription,
    entitlement,
    loading,
    authMode: authMode(),
    signUp,
    signIn,
    signOut,
    refreshSubscription,
    devSetPlan
  };
};
