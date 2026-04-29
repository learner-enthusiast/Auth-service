import { api } from "./axios";

export type RegisterInput = {
  username: string;
  email: string;
  password: string;
  fullName?: string;
  phone?: string;
};

export type LoginInput = {
  emailOrUsername: string;
  password: string;
};

type Tokens = {
  accessToken: string;
  refreshToken?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractTokensFromLoginResponse(payload: unknown): Tokens | undefined {
  if (!isRecord(payload)) return undefined;

  // Backend may respond in one of these shapes:
  // 1) { tokens: { accessToken, refreshToken? } }
  // 2) { data: { tokens: { ... } } } (ApiResponse wrapper)
  // 3) { accessToken, refreshToken? } (direct)
  const maybeData = payload.data;
  const candidate =
    (isRecord(maybeData) && maybeData.tokens) || payload.tokens || payload;

  if (!isRecord(candidate)) return undefined;
  const accessToken = candidate.accessToken;
  const refreshToken = candidate.refreshToken;
  if (typeof accessToken !== "string" || !accessToken) return undefined;

  const tokens: Tokens = { accessToken };
  if (typeof refreshToken === "string" && refreshToken) {
    tokens.refreshToken = refreshToken;
  }
  return tokens;
}

export async function register(input: RegisterInput) {
  // POST http://localhost:3000/api/auth/register
  const res = await api.post("/api/auth/register", input);
  return res.data as unknown;
}

export async function login(input: LoginInput): Promise<Tokens> {
  // POST http://localhost:3000/api/auth/login
  const res = await api.post("/api/auth/login", input);

  const tokens = extractTokensFromLoginResponse(res.data);
  if (!tokens) {
    throw new Error("Missing accessToken in login response");
  }
  return tokens;
}
