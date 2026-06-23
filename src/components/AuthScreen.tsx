import { ArrowRight, Loader2, Lock, Mail, ShieldCheck, User } from "lucide-react";
import { useState } from "react";

export type AuthScreenMode = "login" | "signup";

// Login / signup screen. Presentational: all auth work is delegated to the handlers passed in
// (which call useAuthSession → authClient). Handles loading + error + email-confirmation states.
export function AuthScreen({
  mode,
  onModeChange,
  isLocalMode,
  onSignIn,
  onSignUp,
  onCancel
}: {
  mode: AuthScreenMode;
  onModeChange: (mode: AuthScreenMode) => void;
  isLocalMode: boolean;
  onSignIn: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  onSignUp: (
    email: string,
    password: string,
    fullName: string
  ) => Promise<{ ok: boolean; message?: string; needsEmailConfirmation?: boolean }>;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isSignup = mode === "signup";

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);
    setInfo(null);
    if (!email.trim() || !password.trim() || (isSignup && !fullName.trim())) {
      setError("Please fill in all fields.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      const result = isSignup ? await onSignUp(email.trim(), password, fullName.trim()) : await onSignIn(email.trim(), password);
      if (!result.ok) {
        setError(result.message ?? "Something went wrong.");
        return;
      }
      if ("needsEmailConfirmation" in result && result.needsEmailConfirmation) {
        setInfo("Check your email to confirm your account, then sign in.");
        onModeChange("login");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <main id="main-content" tabIndex={-1} className="auth-screen page-shell">
      <section className="auth-card">
        <span className="section-eyebrow">
          <ShieldCheck size={14} /> {isSignup ? "Create your account" : "Welcome back"}
        </span>
        <h1>{isSignup ? "Start building Canvas courses" : "Sign in to RocketCourse"}</h1>
        <p className="auth-sub">
          {isSignup
            ? "Create an account to generate, edit, theme, and export your own Canvas courses."
            : "Sign in to reach your dashboard, projects, and exports."}
        </p>

        {isLocalMode && (
          <p className="auth-local-note">
            <Lock size={13} /> Local dev mode — accounts are stored in your browser only (no Supabase configured).
          </p>
        )}

        <form onSubmit={submit} className="auth-form">
          {isSignup && (
            <label className="field">
              <span>
                <User size={13} /> Full name
              </span>
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" placeholder="Dr. Jane Smith" />
            </label>
          )}
          <label className="field">
            <span>
              <Mail size={13} /> Email
            </span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@university.edu" />
          </label>
          <label className="field">
            <span>
              <Lock size={13} /> Password
            </span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={isSignup ? "new-password" : "current-password"}
              placeholder="••••••••"
            />
          </label>

          {error && <p className="auth-error">{error}</p>}
          {info && <p className="auth-info">{info}</p>}

          <button className="primary" type="submit" disabled={busy}>
            {busy ? <Loader2 size={17} className="spin" /> : <ArrowRight size={17} />}
            {isSignup ? "Create account" : "Sign in"}
          </button>
        </form>

        <div className="auth-switch">
          {isSignup ? (
            <span>
              Already have an account?{" "}
              <button className="link" onClick={() => onModeChange("login")}>
                Sign in
              </button>
            </span>
          ) : (
            <span>
              New to RocketCourse?{" "}
              <button className="link" onClick={() => onModeChange("signup")}>
                Create an account
              </button>
            </span>
          )}
          <button className="link subtle" onClick={onCancel}>
            Back to site
          </button>
        </div>
      </section>
    </main>
  );
}
