// Auth abstraction. Two backends behind one interface:
//   • "supabase"  — real Supabase Auth (email/password, session persistence). Used whenever
//                   VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY are configured.
//   • "local"     — a clearly-labeled, NON-SECURE localStorage fallback so the app is runnable
//                   and demonstrable offline (no Supabase project yet). Never used in production;
//                   real entitlement is always re-checked server-side regardless of this layer.
//
// The UI consumes this through useAuthSession() and never talks to Supabase auth directly.

import { getSupabaseClient, supabaseConfig } from "../services/supabaseClient";

export interface AuthUser {
  id: string;
  email: string;
  fullName?: string;
}

export interface AuthSession {
  user: AuthUser;
  /** Supabase access token (JWT) when in supabase mode; undefined in local mode. */
  accessToken?: string;
}

export type AuthMode = "supabase" | "local";

export const authMode = (): AuthMode => (supabaseConfig.isConfigured ? "supabase" : "local");

export interface AuthResult {
  session: AuthSession | null;
  /** Present when sign up succeeded but email confirmation is required before a session exists. */
  needsEmailConfirmation?: boolean;
  error?: string;
}

const LOCAL_SESSION_KEY = "cf_local_session";
const LOCAL_USERS_KEY = "cf_local_users";

// ── Local (dev) backend ─────────────────────────────────────────────────────
interface LocalUserRecord {
  id: string;
  email: string;
  fullName: string;
  password: string; // dev-only, plaintext, never shipped to a real backend
}

const readLocalUsers = (): LocalUserRecord[] => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) ?? "[]") as LocalUserRecord[];
  } catch {
    return [];
  }
};

const writeLocalUsers = (users: LocalUserRecord[]): void => {
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
};

const localId = (email: string): string => `local_${btoa(email).replace(/[^a-z0-9]/gi, "").slice(0, 24)}`;

const persistLocalSession = (session: AuthSession | null): void => {
  if (session) localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(LOCAL_SESSION_KEY);
};

const localSignUp = (email: string, password: string, fullName: string): AuthResult => {
  const users = readLocalUsers();
  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    return { session: null, error: "An account with this email already exists." };
  }
  const record: LocalUserRecord = { id: localId(email), email, fullName, password };
  writeLocalUsers([...users, record]);
  const session: AuthSession = { user: { id: record.id, email, fullName } };
  persistLocalSession(session);
  return { session };
};

const localSignIn = (email: string, password: string): AuthResult => {
  const users = readLocalUsers();
  const record = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!record || record.password !== password) {
    return { session: null, error: "Invalid email or password." };
  }
  const session: AuthSession = { user: { id: record.id, email: record.email, fullName: record.fullName } };
  persistLocalSession(session);
  return { session };
};

const localGetSession = (): AuthSession | null => {
  try {
    const raw = localStorage.getItem(LOCAL_SESSION_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
};

// ── Public API ──────────────────────────────────────────────────────────────
export const signUp = async (email: string, password: string, fullName: string): Promise<AuthResult> => {
  if (authMode() === "local") return localSignUp(email, password, fullName);

  const client = await getSupabaseClient();
  if (!client) return { session: null, error: "Auth is not configured." };
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } }
  });
  if (error) return { session: null, error: error.message };
  if (!data.session) {
    // Email confirmation flow: account created, no session yet.
    return { session: null, needsEmailConfirmation: true };
  }
  return {
    session: {
      user: { id: data.user!.id, email: data.user!.email ?? email, fullName },
      accessToken: data.session.access_token
    }
  };
};

export const signIn = async (email: string, password: string): Promise<AuthResult> => {
  if (authMode() === "local") return localSignIn(email, password);

  const client = await getSupabaseClient();
  if (!client) return { session: null, error: "Auth is not configured." };
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) return { session: null, error: error.message };
  return {
    session: {
      user: {
        id: data.user.id,
        email: data.user.email ?? email,
        fullName: (data.user.user_metadata?.full_name as string | undefined) ?? undefined
      },
      accessToken: data.session?.access_token
    }
  };
};

export const signOut = async (): Promise<void> => {
  if (authMode() === "local") {
    persistLocalSession(null);
    return;
  }
  const client = await getSupabaseClient();
  await client?.auth.signOut();
};

export const getSession = async (): Promise<AuthSession | null> => {
  if (authMode() === "local") return localGetSession();

  const client = await getSupabaseClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  const session = data.session;
  if (!session) return null;
  return {
    user: {
      id: session.user.id,
      email: session.user.email ?? "",
      fullName: (session.user.user_metadata?.full_name as string | undefined) ?? undefined
    },
    accessToken: session.access_token
  };
};

/** Subscribe to auth changes (real Supabase only). Returns an unsubscribe function. */
export const onAuthChange = (callback: (session: AuthSession | null) => void): (() => void) => {
  if (authMode() === "local") return () => undefined;
  let unsub: () => void = () => undefined;
  void getSupabaseClient().then((client) => {
    if (!client) return;
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      callback(
        session
          ? {
              user: {
                id: session.user.id,
                email: session.user.email ?? "",
                fullName: (session.user.user_metadata?.full_name as string | undefined) ?? undefined
              },
              accessToken: session.access_token
            }
          : null
      );
    });
    unsub = () => data.subscription.unsubscribe();
  });
  return () => unsub();
};
