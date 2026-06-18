import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { User as SupabaseUser, Session } from "@supabase/supabase-js";

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
  token: string | null;                          // ← qo'shildi
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function toAppUser(supabaseUser: SupabaseUser): AppUser {
  const meta = supabaseUser.user_metadata || {};
  const appMeta = supabaseUser.app_metadata || {};
  return {
    id: supabaseUser.id,
    email: supabaseUser.email || "",
    firstName: meta.first_name || meta.firstName || "",
    lastName: meta.last_name || meta.lastName || "",
    role: appMeta.role || meta.role || "teacher",
  };
}

const dummyUser: AppUser = {
  id: "dummy-admin-id",
  email: "admin@example.com",
  firstName: "Mehmon",
  lastName: "Admin",
  role: "admin",
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    // Mavjud sessionni olish
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ? toAppUser(session.user) : dummyUser);
      if (session?.access_token) {
        localStorage.setItem("auth_token", session.access_token);
      } else {
        localStorage.setItem("auth_token", "dummy-token");
      }
      setIsLoading(false);
    });

    // Auth holati o'zgarganda avtomatik yangilanish
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ? toAppUser(session.user) : dummyUser);
      if (session?.access_token) {
        localStorage.setItem("auth_token", session.access_token);
      } else {
        localStorage.setItem("auth_token", "dummy-token");
      }
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    if (data.user) {
      setUser(toAppUser(data.user));
      setSession(data.session);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(dummyUser);
    setSession(null);
    localStorage.setItem("auth_token", "dummy-token");
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, token: session?.access_token ?? "dummy-token", login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
