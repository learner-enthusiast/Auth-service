import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import { and, eq, isNull, or } from "drizzle-orm";

import { db } from "../db";
import { users } from "../models/user.schema";
import {
  oidcAccessTokens,
  oidcAuthCodes,
  oidcClients,
} from "../models/oidc.schema";
import {
  hashToken,
  issuer,
  isValidRedirectUri,
  parseScope,
  randomToken,
} from "../utils/oidc";
import { signIdToken } from "../utils/oidcSign";
import fs from "node:fs";
import path from "node:path";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function oauthRedirect(
  redirectUri: string,
  params: Record<string, string | undefined>,
) {
  const u = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") u.searchParams.set(k, v);
  }
  return u.toString();
}

function parseRedirectUrisRaw(raw: string): string[] {
  return String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function getOidcClientAnySource(clientId: string): Promise<{
  clientId: string;
  redirectUris: string[];
  clientSecret?: string;
  clientSecretHash?: string;
  clientName: string;
} | null> {
  if (!clientId) return null;

  const row = await db.query.oidcClients.findFirst({
    where: eq(oidcClients.clientId, clientId),
  });

  if (row) {
    const secret = row.clientSecret ?? undefined;
    const looksBcrypt = typeof secret === "string" && secret.startsWith("$2");
    return {
      clientId: row.clientId,
      clientSecretHash: looksBcrypt ? secret : undefined,
      clientSecret: !looksBcrypt ? secret : undefined,
      redirectUris: parseRedirectUrisRaw(row.redirectUris),
      clientName: row.clientName,
    };
  }

  // Fallback: env-configured client (legacy MVP behavior) Whitelisted IPS
  const envClientId = process.env.OIDC_CLIENT_ID ?? "oidc-client";
  if (clientId !== envClientId) return null;

  const redirectUrisRaw =
    process.env.OIDC_REDIRECT_URIS ?? "http://localhost:5173/callback";
  const redirectUris = parseRedirectUrisRaw(redirectUrisRaw);
  const clientSecret = process.env.OIDC_CLIENT_SECRET;

  return {
    clientId: envClientId,
    clientSecret: clientSecret?.trim() ? clientSecret : undefined,
    redirectUris,
  };
}

export async function oidcDiscovery(_req: Request, res: Response) {
  const iss = issuer();
  return res.json({
    issuer: iss,
    authorization_endpoint: `${iss}/oidc/authorize`,
    token_endpoint: `${iss}/oidc/token`,
    userinfo_endpoint: `${iss}/oidc/userinfo`,
    jwks_uri: `${iss}/.well-known/jwks.json`,

    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    subject_types_supported: ["public"],
    scopes_supported: ["openid", "profile", "email", "offline_access"],
    id_token_signing_alg_values_supported: ["RS256"],
    token_endpoint_auth_methods_supported: [
      "client_secret_basic",
      "client_secret_post",
      "none",
    ],
    code_challenge_methods_supported: ["S256"],
  });
}

export async function oidcJwks(_req: Request, res: Response) {
  const jwksPath = process.env.OIDC_PUBLIC_JWKS_PATH ?? "./keys/oidc/jwks.json";
  const p = path.resolve(process.cwd(), jwksPath);
  const raw = fs.readFileSync(p, "utf8");
  res.type("json").send(raw);
}

export const authorizeGet = asyncHandler(
  async (req: Request, res: Response) => {
    const clientId = String((req.query.client_id || req.body.client_id) ?? "");
    const redirectUri = String(
      (req.query.redirect_uri || req.body.redirect_uri) ?? "",
    );

    const client = await getOidcClientAnySource(clientId);
    if (!client) {
      throw new ApiError(400, "invalid_client");
    }
    if (!redirectUri || !isValidRedirectUri(client, redirectUri)) {
      throw new ApiError(400, "invalid redirect_uri");
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          {
            clientName: client.clientName,
            redirectUri: redirectUri,
            clientId: client.clientId,
          },
          "Client_id is valid",
        ),
      );
  },
);
export const authorizePost = asyncHandler(
  async (req: Request, res: Response) => {
    const clientId = String(req.body?.client_id ?? "");

    const redirectUri = String(req.body?.redirect_uri ?? "");

    const emailOrUsername = String(req.body?.emailOrUsername ?? "");

    const password = String(req.body?.password ?? "");

    /* validate required fields */
    if (!clientId || !redirectUri || !emailOrUsername || !password) {
      throw new ApiError(400, "Missing required fields");
    }

    /* verify client */
    const client = await getOidcClientAnySource(clientId);

    if (!client) {
      throw new ApiError(400, "Invalid client");
    }

    /* verify redirect uri */
    if (!isValidRedirectUri(client, redirectUri)) {
      throw new ApiError(400, "Invalid redirect uri");
    }

    /* authenticate user */
    const user = await db.query.users.findFirst({
      where: or(
        eq(users.email, emailOrUsername.toLowerCase()),
        eq(users.username, emailOrUsername),
      ),
    });

    if (!user) {
      throw new ApiError(401, "Invalid credentials");
    }

    const validPassword = await bcrypt.compare(
      String(password),
      user.passwordHash,
    );

    if (!validPassword) {
      throw new ApiError(401, "Invalid credentials");
    }

    /* generate auth code */
    const authCode = randomToken(32);

    const expiresAt = addMinutes(new Date(), 10);

    /* save authorization code */
    await db.insert(oidcAuthCodes).values({
      code: authCode,
      clientId,
      redirectUri,
      userId: user.id,
      scope: "openid",
      expiresAt,
    });
    if (process.env.ENVIRONMENT === "production") {
      /* redirect back to client */
      return res.redirect(
        oauthRedirect(redirectUri, {
          code: authCode,
        }),
      );
    } else {
      return res.status(200).json({
        code: authCode,
      });
    }
  },
);

export const token = asyncHandler(async (req: Request, res: Response) => {
  const clientId = String(req.body?.client_id ?? "");

  const clientSecret = String(req.body?.client_secret ?? "");

  const code = String(req.body?.code ?? "");

  if (!clientId || !clientSecret || !code) {
    throw new ApiError(400, "client_id, client_secret and code are required");
  }

  /* find client */
  const client = await db.query.oidcClients.findFirst({
    where: eq(oidcClients.clientId, clientId),
  });

  if (!client) {
    throw new ApiError(401, "invalid_client");
  }

  /* verify client secret */
  const secretValid = await bcrypt.compare(
    clientSecret,
    client.clientSecret ?? "",
  );

  if (!secretValid) {
    throw new ApiError(401, "invalid_client_secret");
  }

  /* verify auth code */
  const codeRow = await db.query.oidcAuthCodes.findFirst({
    where: eq(oidcAuthCodes.code, code),
  });

  if (!codeRow) {
    throw new ApiError(400, "invalid_code");
  }

  if (codeRow.clientId !== clientId) {
    throw new ApiError(400, "code does not belong to client");
  }

  if (codeRow.consumedAt) {
    throw new ApiError(400, "code already used");
  }

  if (new Date() > codeRow.expiresAt) {
    throw new ApiError(400, "code expired");
  }

  /* consume one-time code */
  await db
    .update(oidcAuthCodes)
    .set({
      consumedAt: new Date(),
    })
    .where(eq(oidcAuthCodes.id, codeRow.id));

  /* fetch user */
  const user = await db.query.users.findFirst({
    where: eq(users.id, codeRow.userId),
  });

  if (!user) {
    throw new ApiError(404, "user not found");
  }

  /* sign JWT using private key */
  const accessToken = signIdToken({
    claims: {
      iss: issuer(),
      sub: String(user.id),
      aud: clientId,

      email: user.email,
      userName: user.username,
      name: user.fullName ?? user.username,

      picture: user.picture ?? undefined,
    },
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        token_type: "Bearer",
        access_token: accessToken,
        expires_in: 900,
      },
      "Token Generated Successfully",
    ),
  );
});

export const createOidcClient = asyncHandler(
  //TODO: Same client cannot have organisations of same name

  async (req: Request, res: Response) => {
    // Expects form fields (x-www-form-urlencoded or JSON).
    // Note: Express does NOT parse multipart/form-data without extra middleware.
    const organisationName = String(
      req.body?.organisationName ?? req.body?.organisation ?? "",
    ).trim();
    const redirectUrisRaw = String(
      req.body?.redirectUris ?? req.body?.redirect_uris ?? "",
    ).trim();

    if (!organisationName) {
      throw new ApiError(400, "organisationName is required");
    }

    const redirectUris = parseRedirectUrisRaw(redirectUrisRaw);
    if (redirectUris.length === 0) {
      throw new ApiError(400, "redirectUris (comma-separated) is required");
    }

    for (const uri of redirectUris) {
      try {
        // eslint-disable-next-line no-new
        new URL(uri);
      } catch {
        throw new ApiError(400, `Invalid redirect URI: ${uri}`);
      }
    }

    const clientSecretRaw = randomToken(48);
    const clientSecretHash = clientSecretRaw
      ? await bcrypt.hash(clientSecretRaw, 12)
      : null;

    // Retry a few times in the unlikely case of collision.
    for (let attempt = 0; attempt < 3; attempt++) {
      const clientId = `client_${randomToken(16)}`;

      const [created] = await db
        .insert(oidcClients)
        .values({
          clientId,
          clientName: organisationName,
          clientSecret: clientSecretHash,
          redirectUris: redirectUris.join(","),
        })
        .returning({
          clientId: oidcClients.clientId,
          redirectUris: oidcClients.redirectUris,

          createdAt: oidcClients.createdAt,
          clientName: oidcClients.clientName,
        });

      return res.status(201).json(
        new ApiResponse(200, {
          clientName: created.clientName,
          client_id: created.clientId,
          client_secret: clientSecretRaw,
          redirect_uris: parseRedirectUrisRaw(created.redirectUris),

          created_at: created.createdAt,
        }),
      );
    }
  },
);

export async function userinfo(req: Request, res: Response) {
  const header = req.header("authorization") ?? req.header("Authorization");
  if (!header) {
    return res.status(401).json({ error: "invalid_token" });
  }

  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "invalid_token" });
  }

  const tokenHash = hashToken(token);
  const accessRow = await db.query.oidcAccessTokens.findFirst({
    where: and(
      eq(oidcAccessTokens.tokenHash, tokenHash),
      isNull(oidcAccessTokens.revokedAt),
    ),
  });

  if (!accessRow) {
    return res.status(401).json({ error: "invalid_token" });
  }

  if (new Date() > accessRow.expiresAt) {
    return res.status(401).json({ error: "invalid_token" });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, accessRow.userId),
  });
  if (!user) {
    return res.status(401).json({ error: "invalid_token" });
  }

  const scopes = parseScope(accessRow.scope);

  const claims: any = { sub: String(user.id) };
  if (scopes.includes("email")) {
    claims.email = user.email;
    claims.email_verified = Boolean(user.emailVerified);
  }
  if (scopes.includes("profile")) {
    claims.name = user.fullName ?? user.username;
    claims.picture = user.picture ?? undefined;
  }

  return res.json(claims);
}
