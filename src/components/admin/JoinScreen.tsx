// /join?invite=<token> or /join?link=<token> — accept a workspace invite or join link. Seats are
// enforced server-side (workspace-join); this screen just drives the flow.

import { useState } from "react";
import { LogoMark } from "../brand";
import { workspaceJoin } from "../../services/platformClient";

export function JoinScreen({
  isAuthed,
  onSignIn,
  onDone
}: {
  isAuthed: boolean;
  onSignIn: () => void;
  onDone: (workspaceId: string) => void;
}) {
  const params = new URLSearchParams(window.location.search);
  const inviteToken = params.get("invite");
  const linkToken = params.get("link");
  const token = inviteToken || linkToken || "";
  const type: "invite" | "join" = inviteToken ? "invite" : "join";

  const [state, setState] = useState<"idle" | "joining" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [workspaceName, setWorkspaceName] = useState("the workspace");
  const [workspaceId, setWorkspaceId] = useState("");

  const accept = async () => {
    setState("joining");
    try {
      const res = (await workspaceJoin(token, type)) as { workspaceName?: string; workspaceId?: string };
      setWorkspaceName(res.workspaceName ?? "the workspace");
      setWorkspaceId(res.workspaceId ?? "");
      setState("done");
    } catch (error) {
      setMessage((error as Error).message);
      setState("error");
    }
  };

  return (
    <main className="page-shell join-screen">
      <section className="overview-card join-card">
        <LogoMark size={56} decorative />
        <h1>Join a RocketCourse workspace</h1>
        {!token ? (
          <p className="intake-ai-error">This link is missing its token. Ask your admin to resend it.</p>
        ) : !isAuthed ? (
          <>
            <p>Sign in or create your free RocketCourse account to accept this invitation.</p>
            <button type="button" className="primary" onClick={onSignIn}>
              Sign in to continue
            </button>
            <p className="join-hint">Your invitation stays valid — you'll come right back here.</p>
          </>
        ) : state === "done" ? (
          <>
            <p>
              You're in! You now have access to <strong>{workspaceName}</strong>.
            </p>
            <button type="button" className="primary" onClick={() => onDone(workspaceId)}>
              Open the workspace
            </button>
          </>
        ) : (
          <>
            <p>You've been invited to collaborate in a shared RocketCourse workspace.</p>
            {state === "error" && <p className="intake-ai-error">{message}</p>}
            <button type="button" className="primary" onClick={() => void accept()} disabled={state === "joining"}>
              {state === "joining" ? "Joining…" : "Accept invitation"}
            </button>
          </>
        )}
      </section>
    </main>
  );
}
