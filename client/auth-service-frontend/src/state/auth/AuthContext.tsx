/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { getAccessTokenFromCookies } from "./cookies";

type AuthContextValue = {
  accessToken: string | null;
  refreshFromCookies: () => void;
  login: (emailOrUsername: string, password: string) => Promise<void>;
};

type LoginApiResponse = {
  data?: {
    tokens?: {
      accessToken?: string;
    };
  };
  tokens?: {
    accessToken?: string;
  };
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(() =>
    getAccessTokenFromCookies(),
  );

  const refreshFromCookies = useCallback(() => {
    setAccessToken(getAccessTokenFromCookies());
  }, []);

  const login = useCallback(
    async (emailOrUsername: string, password: string) => {
      const apiBase = import.meta.env.VITE_API_URL ?? "";

      const res = await fetch(`${apiBase}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailOrUsername, password }),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Login failed");
      }

      const jsonUnknown: unknown = await res.json();
      const json = jsonUnknown as LoginApiResponse;
      const token =
        json?.data?.tokens?.accessToken ?? json?.tokens?.accessToken;

      if (!token) {
        throw new Error("Missing access token");
      }

      // Store token in a cookie so ProtectedRoute can read it.
      // (This requires a non-HttpOnly cookie; for production prefer HttpOnly + session-based auth.)
      document.cookie = `accessToken=${encodeURIComponent(token)}; Path=/; SameSite=Lax`;
      setAccessToken(token);
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken,
      refreshFromCookies,
      login,
    }),
    [accessToken, refreshFromCookies, login],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider>");
  }
  return ctx;
}
