import dotenv from "dotenv";
dotenv.config({
  path: `.env.${process.env.NODE_ENV || "development"}`,
});
type EnvKeys =
  | "DATABASE_URL"
  | "FRONTEND_URL"
  | "NODE_ENV"
  | "OIDC_PUBLIC_JWKS_PATH"
  | "JWT_ACCESS_SECRET"
  | "JWT_REFRESH_SECRET"
  | "OIDC_ISSUER"
  | "OIDC_PRIVATE_KEY_PATH"
  | "OIDC_KID_PATH"
  | "REFRESH_TOKEN_TTL"
  | "ACCESS_TOKEN_TTL"
  | "CORS_ORIGIN"
  | "PORT";

function requireEnv(key: EnvKeys): string {
  const value = process.env[key];

  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

export const ENV = {
  DATABASE_URL: requireEnv("DATABASE_URL"),
  NODE_ENV: requireEnv("NODE_ENV"),
  OIDC_PUBLIC_JWKS_PATH: requireEnv("OIDC_PUBLIC_JWKS_PATH"),
  JWT_ACCESS_SECRET: requireEnv("JWT_ACCESS_SECRET"),
  JWT_REFRESH_SECRET: requireEnv("JWT_REFRESH_SECRET"),
  OIDC_ISSUER: requireEnv("OIDC_ISSUER"),
  OIDC_PRIVATE_KEY_PATH: requireEnv("OIDC_PRIVATE_KEY_PATH"),
  OIDC_KID_PATH: requireEnv("OIDC_KID_PATH"),
  ACCESS_TOKEN_TTL: requireEnv("ACCESS_TOKEN_TTL"),
  REFRESH_TOKEN_TTL: requireEnv("REFRESH_TOKEN_TTL"),
  FRONTEND_URL: requireEnv("FRONTEND_URL"),
  CORS_ORIGIN: requireEnv("CORS_ORIGIN"),
  PORT: requireEnv("PORT"),
} as const;
