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
