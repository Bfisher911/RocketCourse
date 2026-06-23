// Hook that loads the signed-in user's platform access (super-admin flag + workspaces with role)
// from the server (RLS-scoped). Drives server-informed navigation gating and the admin screens.

import { useCallback, useEffect, useState } from "react";
import type { AuthSession } from "../auth/authClient";
import { EMPTY_ACCESS, loadPlatformAccess, type PlatformAccess } from "./platformClient";

export interface UsePlatformAccess extends PlatformAccess {
  loading: boolean;
  reload: () => Promise<void>;
}

export const usePlatformAccess = (session: AuthSession | null): UsePlatformAccess => {
  const [access, setAccess] = useState<PlatformAccess>(EMPTY_ACCESS);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!session) {
      setAccess(EMPTY_ACCESS);
      return;
    }
    setLoading(true);
    try {
      setAccess(await loadPlatformAccess(session.user.id, session.user.email));
    } catch {
      setAccess(EMPTY_ACCESS);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...access, loading, reload };
};
