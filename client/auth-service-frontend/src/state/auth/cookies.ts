export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;

  const cookies = document.cookie ? document.cookie.split("; ") : [];
  for (const cookie of cookies) {
    const index = cookie.indexOf("=");
    const key = index >= 0 ? cookie.slice(0, index) : cookie;
    if (key === name) {
      const value = index >= 0 ? cookie.slice(index + 1) : "";
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
  }

  return null;
}

export function getAccessTokenFromCookies(): string | null {
  const token = getCookie("accessToken");
  return token && token.trim() ? token : null;
}
export function setRefreshTokenCookie(token?: string) {
  if (!token) return;
  document.cookie = `refreshToken=${encodeURIComponent(token)}; Path=/; SameSite=Lax`;
}
export function setAccessTokenCookie(token: string) {
  document.cookie = `accessToken=${encodeURIComponent(token)}; Path=/; SameSite=Lax`;
}
