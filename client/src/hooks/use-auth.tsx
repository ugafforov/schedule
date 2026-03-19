import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { User, LoginRequest } from "@shared/schema";

const API_BASE = "";

async function apiPost(path: string, body: any, token?: string | null) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  return res;
}

async function apiGet(path: string, token?: string | null) {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { headers });
  return res;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  token: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("auth_token"));
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(!!localStorage.getItem("auth_token"));
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    apiGet("/api/auth/me", token)
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setUser(data);
        } else {
          setToken(null);
          setUser(null);
          localStorage.removeItem("auth_token");
        }
      })
      .catch(() => {
        setToken(null);
        setUser(null);
        localStorage.removeItem("auth_token");
      })
      .finally(() => setIsLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const originalFetch = window.fetch;
    window.fetch = function (url, options: RequestInit = {}) {
      const isApi = typeof url === "string" && url.startsWith("/api");
      if (!isApi) return originalFetch(url, options);
      const headers = new Headers(options.headers || {});
      if (!headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      return originalFetch(url, { ...options, headers });
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, [token]);

  const login = async (credentials: LoginRequest) => {
    const res = await apiPost("/api/auth/login", credentials);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Kirish kodi noto'g'ri" }));
      throw new Error(err.message || "Kirish amalga oshmadi");
    }
    const data = await res.json();
    localStorage.setItem("auth_token", data.token);
    setToken(data.token);
    setUser(data.user);
    queryClient.clear();
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("auth_token");
    queryClient.clear();
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
