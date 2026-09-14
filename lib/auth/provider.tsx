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
  const rolesRef = useRef<UserRoles | null>(null);

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
          rolesRef.current = userRoles;
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
        // Only gate the UI on a GENUINE fresh sign-in — i.e. when we don't yet
        // have roles for this identity. Supabase also re-emits SIGNED_IN when the
        // tab regains focus; if roles are already loaded we refresh them silently
        // rather than flashing the full-page loader (which looked like a full
        // reload on every tab switch). The first login is still gated so route
        // guards don't evaluate empty roles and bounce to /no-access.
        const gate = event === "SIGNED_IN" && !rolesRef.current;
        if (gate) setLoading(true);
        try {
          const userRoles = await getUserRoles(session.access_token);
          rolesRef.current = userRoles;
          setRoles(userRoles);
        } catch (err) {
          console.error("Role fetch error:", err);
        } finally {
          if (gate) setLoading(false);
        }
      } else {
        rolesRef.current = null;
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
    // Hard-navigate to a clean login screen. Without this, the just-cleared
    // roles make the client route guards treat the user as "no access" and
    // bounce them to /no-access — which then gets captured as ?redirectTo, so
    // the next sign-in lands back on /no-access and strands them.
    if (typeof window !== "undefined") window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, roles, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
