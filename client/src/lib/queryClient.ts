import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { supabase } from "./supabase";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    let message = text;
    try {
      const parsed = JSON.parse(text);
      if (parsed?.message) message = parsed.message;
    } catch {
      // Server JSON qaytarmagan (masalan tarmoq xatosi) — xom matnni ishlatamiz
    }
    throw new Error(message);
  }
}

/**
 * Supabase session dan fresh token olish.
 * Supabase auto-refresh qilganda ham har doim yangi token ishlatiladi.
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    // localStorage ni ham yangilab qo'yamiz (sync uchun)
    localStorage.setItem("auth_token", session.access_token);
    return { Authorization: `Bearer ${session.access_token}` };
  }
  // Fallback: localStorage dan olish (session yo'q bo'lsa)
  const cached = localStorage.getItem("auth_token");
  return cached ? { Authorization: `Bearer ${cached}` } : {};
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown,
  signal?: AbortSignal,
): Promise<Response> {
  const headers = await getAuthHeaders();
  const res = await fetch(url, {
    method,
    headers: {
      ...headers,
      ...(data ? { "Content-Type": "application/json" } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
    signal,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const headers = await getAuthHeaders();
    const res = await fetch(queryKey[0] as string, { headers });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true,
      staleTime: 30_000,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
