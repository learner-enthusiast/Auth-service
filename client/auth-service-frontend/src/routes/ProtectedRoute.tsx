import { useEffect, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../state/auth/AuthContext";
import { getAccessTokenFromCookies } from "../state/auth/cookies";

type ProtectedRouteProps = {
  children: ReactNode;
};

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { accessToken, refreshFromCookies } = useAuth();
  const location = useLocation();
  const cookieToken = getAccessTokenFromCookies();

  useEffect(() => {
    if (!accessToken && cookieToken) {
      refreshFromCookies();
    }
  }, [accessToken, cookieToken, refreshFromCookies]);

  if (!accessToken) {
    // If a cookie token exists, give AuthContext a chance to hydrate.
    // (Otherwise we'd redirect before the effect runs.)
    if (cookieToken) return null;
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
