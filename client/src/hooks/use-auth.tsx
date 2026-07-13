import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { apiRequest } from "@/lib/queryClient";
import type { Session } from "@supabase/supabase-js";

export interface AppUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "admin" | "teacher";
}

interface AuthContextType {
  user: AppUser | null;
  session: Session | null;
  isLoading: boolean;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Rol server-side `user_roles` jadvalidan keladi (Supabase user_metadata'dan emas) —
// shuning uchun haqiqiy manba sifatida har doim /api/auth/me chaqiriladi.
async function fetchMe(): Promise<AppUser | null> {
  try {
    const res = await apiRequest("GET", "/api/auth/me");
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

let lastProcessedToken: string | null = "INITIAL_UNPROCESSED";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    async function syncUser(nextSession: Session | null) {
      const token = nextSession?.access_token ?? null;
      if (token === lastProcessedToken) {
        return;
      }
      lastProcessedToken = token;

      setSession(nextSession);
      if (token) {
        localStorage.setItem("auth_token", token);
        const me = await fetchMe();
        setUser(me);
      } else {
        localStorage.removeItem("auth_token");
        setUser(null);
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      syncUser(session).finally(() => setIsLoading(false));
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      syncUser(session);
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    if (data.session) {
      localStorage.setItem("auth_token", data.session.access_token);
      setSession(data.session);
      setUser(await fetchMe());
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    localStorage.removeItem("auth_token");
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, token: session?.access_token ?? null, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
