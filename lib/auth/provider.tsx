"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { getUserRoles, type UserRoles } from "./roles";

interface AuthContextValue {
  user: User | null;
  roles: UserRoles | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  roles: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<UserRoles | null>(null);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const supabase = createClient();

    const loadUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: { session } } = await supabase.auth.getSession();
        setUser(user);
        if (user && session?.access_token) {
          const userRoles = await getUserRoles(session.access_token);
          setRoles(userRoles);
        }
      } catch (err) {
        console.error("Auth init error:", err);
      } finally {
        setLoading(false);
      }
    };

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser && session?.access_token) {
        // On a fresh sign-in we don't yet have roles for this identity. Hold
        // `loading` until they resolve so route guards don't evaluate against
        // empty roles and bounce the user to /no-access before the fetch lands
        // (the bug where you'd hit /no-access on login but a refresh worked).
        // Token refreshes keep the existing roles, so we skip the loader flash.
        if (event === "SIGNED_IN") setLoading(true);
        try {
          const userRoles = await getUserRoles(session.access_token);
          setRoles(userRoles);
        } catch (err) {
          console.error("Role fetch error:", err);
        } finally {
          if (event === "SIGNED_IN") setLoading(false);
        }
      } else {
        setRoles(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setRoles(null);
  };

  return (
    <AuthContext.Provider value={{ user, roles, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
