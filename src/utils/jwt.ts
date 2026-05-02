import jwt, {
  type JwtPayload,
  type Secret,
  type SignOptions,
} from "jsonwebtoken";
import crypto from "node:crypto";
import { ApiError } from "./ApiError";
import "dotenv/config";
import { ENV } from "./env_constants";
export type AccessTokenPayload = {
  sub: string;
  email: string;
  username: string;
  typ: "access";
};

export type RefreshTokenPayload = {
  sub: string;
  typ: "refresh";
  jti: string;
};

function requireEnv(name: string): string {
  const value = ENV[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function accessSecret(): string {
  return ENV.JWT_ACCESS_SECRET ?? requireEnv("JWT_SECRET");
}

function refreshSecret(): string {
  return ENV.JWT_REFRESH_SECRET ?? requireEnv("JWT_SECRET");
}

const ACCESS_TTL = (ENV.ACCESS_TOKEN_TTL ?? "15m") as SignOptions["expiresIn"];
const REFRESH_TTL = (ENV.REFRESH_TOKEN_TTL ?? "7d") as SignOptions["expiresIn"];

export function signAccessToken(input: {
  userId: number;
  email: string;
  username: string;
}) {
  const payload: AccessTokenPayload = {
    sub: String(input.userId),
    email: input.email,
    username: input.username,
    typ: "access",
  };

  return jwt.sign(payload, accessSecret() as Secret, { expiresIn: ACCESS_TTL });
}

export function signRefreshToken(input: { userId: number }) {
  const payload: RefreshTokenPayload = {
    sub: String(input.userId),
    typ: "refresh",
    jti: crypto.randomUUID(),
  };

  return jwt.sign(payload, refreshSecret() as Secret, {
    expiresIn: REFRESH_TTL,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, accessSecret()) as JwtPayload;
  if (decoded?.typ !== "access") {
    throw new ApiError(400, "Invalid access token");
  }
  return decoded as unknown as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = jwt.verify(token, refreshSecret()) as JwtPayload;
  if (decoded?.typ !== "refresh") {
    throw new ApiError(400, "Invalid refresh token");
  }
  return decoded as unknown as RefreshTokenPayload;
}
