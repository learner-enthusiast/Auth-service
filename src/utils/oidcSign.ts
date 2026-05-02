import fs from "node:fs";
import path from "node:path";
import jwt, { type SignOptions } from "jsonwebtoken";
import { ENV } from "./env_constants";

let cachedPrivateKey: string | null = null;
let cachedKid: string | null = null;

function privateKeyPath() {
  return ENV.OIDC_PRIVATE_KEY_PATH ?? "./keys/oidc/private.pem";
}

function kidPath() {
  return ENV.OIDC_KID_PATH ?? "./keys/oidc/kid.txt";
}

function loadPrivateKey(): string {
  if (cachedPrivateKey) return cachedPrivateKey;
  const p = path.resolve(process.cwd(), privateKeyPath());
  cachedPrivateKey = fs.readFileSync(p, "utf8");
  return cachedPrivateKey;
}

function loadKid(): string {
  if (cachedKid) return cachedKid;
  const p = path.resolve(process.cwd(), kidPath());
  cachedKid = fs.readFileSync(p, "utf8").trim();
  return cachedKid;
}

export type IdTokenClaims = {
  iss: string;
  sub: string;
  aud: string;
  exp?: number;
  iat?: number;
  nonce?: string;
  auth_time?: number;

  // optional user claims
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  userName?: string;
};

export function signIdToken(input: {
  claims: IdTokenClaims;
  expiresIn?: string;
}) {
  const ttl = (input.expiresIn ??
    (ENV.OIDC_ID_TOKEN_TTL || "5m")) as SignOptions["expiresIn"];
  const key = loadPrivateKey();
  const kid = loadKid();

  return jwt.sign(input.claims, key, {
    algorithm: "RS256",
    expiresIn: ttl,
    keyid: kid,
  });
}
