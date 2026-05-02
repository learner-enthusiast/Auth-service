import crypto from "node:crypto";
import { ENV } from "./env_constants";

export type OidcClient = {
  clientId: string;
  clientSecret?: string;
  redirectUris: string[];
};

export function issuer(): string {
  return ENV.OIDC_ISSUER ?? `http://localhost:${ENV.PORT ?? 3000}`;
}

// export function getOidcClient(clientId: string): OidcClient | null {
//   // MVP: a single env-configured client.
//   // You can extend this to multiple clients by encoding JSON in env.
//   const envClientId = ENV.OIDC_CLIENT_ID ?? "oidc-client";
//   if (clientId !== envClientId) return null;

//   const redirectUrisRaw =
//     ENV.OIDC_REDIRECT_URIS ?? "http://localhost:5173/callback";
//   const redirectUris = redirectUrisRaw
//     .split(",")
//     .map((s) => s.trim())
//     .filter(Boolean);

//   const clientSecret = ENV.OIDC_CLIENT_SECRET;

//   return {
//     clientId: envClientId,
//     clientSecret: clientSecret?.trim() ? clientSecret : undefined,
//     redirectUris,
//   };
// }

export function isValidRedirectUri(client: OidcClient, redirectUri: string) {
  return client.redirectUris.includes(redirectUri);
}

export function parseScope(scope: string): string[] {
  return String(scope)
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function requireOpenIdScope(scope: string): boolean {
  return parseScope(scope).includes("openid");
}

function base64Url(input: Buffer) {
  return input
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export function sha256Base64Url(value: string) {
  return base64Url(crypto.createHash("sha256").update(value).digest());
}

export function randomToken(bytes = 32) {
  return base64Url(crypto.randomBytes(bytes));
}

export function hashToken(token: string) {
  // store token hashes, never raw tokens
  return sha256Base64Url(token);
}

export function pkceVerifyS256(codeVerifier: string, codeChallenge: string) {
  return sha256Base64Url(codeVerifier) === codeChallenge;
}

export function parseBasicAuth(header: string | undefined): {
  username: string;
  password: string;
} | null {
  if (!header) return null;
  const [scheme, value] = header.split(" ");
  if (scheme !== "Basic" || !value) return null;
  const raw = Buffer.from(value, "base64").toString("utf8");
  const index = raw.indexOf(":");
  if (index < 0) return null;
  return { username: raw.slice(0, index), password: raw.slice(index + 1) };
}
