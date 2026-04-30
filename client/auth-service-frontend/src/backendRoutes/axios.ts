import axios, {
  AxiosHeaders,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";

import { getAccessTokenFromCookies } from "@/state/auth/cookies";

export function getApiBaseUrl() {
  const envBase = import.meta.env.VITE_API_URL;
  return envBase && String(envBase).trim()
    ? String(envBase).trim()
    : "http://localhost:3000";
}

export const api: AxiosInstance = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // If you store accessToken in a readable cookie, automatically attach it.
    // If your backend uses HttpOnly cookies, you can remove this and rely on withCredentials.
    const token = getAccessTokenFromCookies();
    if (token) {
      const headers = AxiosHeaders.from(config.headers);
      if (!headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      config.headers = headers;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

export function setApiBaseUrl(baseURL: string) {
  api.defaults.baseURL = baseURL;
}

export async function apiRequest<T>(config: AxiosRequestConfig) {
  const res = await api.request<T>(config);
  return res.data;
}
let refreshPromise: Promise<string> | null = null;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function extractAccessToken(payload: unknown): string | null {
  if (!isRecord(payload)) return null;

  const maybeData = payload.data;
  const candidate =
    (isRecord(maybeData) && (maybeData as any).tokens) ||
    (payload as any).tokens ||
    payload;

  const accessToken = (candidate as any)?.accessToken;
  return typeof accessToken === "string" && accessToken ? accessToken : null;
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const status = error?.response?.status;
    const original = error?.config;

    if (!original || status !== 401) return Promise.reject(error);

    const url: string = String(original.url ?? "");
    const isAuthEndpoint =
      url.includes("/api/auth/login") ||
      url.includes("/api/auth/register") ||
      url.includes("/api/auth/refresh-token") ||
      url.includes("/api/auth/logout");

    if (isAuthEndpoint) return Promise.reject(error);

    if ((original as any)._retry) return Promise.reject(error);
    (original as any)._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = api
          .post("/api/auth/refresh-token") // relies on HttpOnly refreshToken cookie
          .then((res) => {
            const newToken = extractAccessToken(res.data);
            if (!newToken)
              throw new Error("Refresh succeeded but no accessToken returned");
            // optional: store readable accessToken cookie (your app uses this)
            document.cookie = `accessToken=${encodeURIComponent(newToken)}; Path=/; SameSite=Lax`;
            return newToken;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }

      const newAccessToken = await refreshPromise;

      original.headers = original.headers ?? {};
      original.headers.Authorization = `Bearer ${newAccessToken}`;
      return api.request(original);
    } catch (e) {
      // Refresh failed → treat as logged out
      document.cookie = "accessToken=; Path=/; Max-Age=0; SameSite=Lax";
      document.cookie = "refreshToken=; Path=/; Max-Age=0; SameSite=Lax";
      window.location.href = "/login";
      return Promise.reject(e);
    }
  },
);
