import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
type EnvKey = "VITE_ENVIRONMENT" | "VITE_API_URL";

function requireEnv(key: EnvKey): string {
  const value = import.meta.env[key];

  if (!value || value.trim() === "") {
    throw new Error(`Missing Vite environment variable: ${key}`);
  }

  return value;
}

export const ENV = {
  API_URL: requireEnv("VITE_API_URL"),
  ENVIRONMENT: requireEnv("VITE_ENVIRONMENT"),
} as const;
