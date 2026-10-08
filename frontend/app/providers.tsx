"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { ApiError, apiRequest } from "../lib/api";

export type User = {
  id: string;
  email: string;
  created_at: string;
};

type AuthStatus = "checking" | "authenticated" | "anonymous" | "unavailable";

type AuthContextValue = {
  user: User | null;
  status: AuthStatus;
  error: string;
  refreshUser: () => Promise<User>;
  signOut: () => Promise<void>;
  retry: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const publicPaths = new Set(["/", "/login", "/register"]);
const authPaths = new Set(["/login", "/register"]);

export function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (publicPaths.has(pathname)) {
      setStatus("anonymous");
      setError("");
      return;
    }

    let cancelled = false;
    setStatus("checking");
    setError("");
    apiRequest<User>("/auth/me")
      .then((currentUser) => {
        if (!cancelled) {
          setUser(currentUser);
          setStatus("authenticated");
        }
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        if (cause instanceof ApiError && cause.status === 401) {
          setUser(null);
          setStatus("anonymous");
          return;
        }
        setError(
          cause instanceof Error
            ? cause.message
            : "Your session could not be checked.",
        );
        setStatus("unavailable");
      });

    return () => {
      cancelled = true;
    };
  }, [pathname, retryCount]);

  useEffect(() => {
    if (authPaths.has(pathname) && user) {
      router.replace("/dashboard");
    } else if (!publicPaths.has(pathname) && status === "anonymous") {
      router.replace("/login");
    }
  }, [pathname, router, status, user]);

  const refreshUser = useCallback(async () => {
    const currentUser = await apiRequest<User>("/auth/me");
    setUser(currentUser);
    setStatus("authenticated");
    setError("");
    return currentUser;
  }, []);

  const signOut = useCallback(async () => {
    await apiRequest<void>("/auth/logout", { method: "POST" });
    setUser(null);
    setStatus("anonymous");
    router.replace("/login");
  }, [router]);

  const retry = useCallback(() => setRetryCount((count) => count + 1), []);
  const value = useMemo(
    () => ({ user, status, error, refreshUser, signOut, retry }),
    [user, status, error, refreshUser, signOut, retry],
  );

  return (
    <AuthContext.Provider value={value}>
      {publicPaths.has(pathname) ? (
        children
      ) : status === "authenticated" ? (
        children
      ) : status === "unavailable" ? (
        <main className="auth-gate">
          <div className="auth-gate-card" role="alert">
            <span className="auth-brand">thread<span>.</span></span>
            <h1>We can’t check your session.</h1>
            <p>{error}</p>
            <button className="auth-submit" onClick={retry}>Try again</button>
          </div>
        </main>
      ) : (
        <main className="auth-gate" aria-label="Checking your session">
          <span className="auth-brand">thread<span>.</span></span>
          <span className="auth-loading" aria-hidden="true" />
        </main>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return value;
}
