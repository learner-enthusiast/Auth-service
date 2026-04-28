import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import { and, eq, isNull, or } from "drizzle-orm";

import { db } from "../db";
import { users } from "../models/user.schema";
import {
  oidcAccessTokens,
  oidcAuthCodes,
  oidcRefreshTokens,
} from "../models/oidc.schema";
import {
  getOidcClient,
  hashToken,
  issuer,
  isValidRedirectUri,
  parseBasicAuth,
  parseScope,
  pkceVerifyS256,
  randomToken,
  requireOpenIdScope,
} from "../utils/oidc";
import { signIdToken } from "../utils/oidcSign";
import fs from "node:fs";
import path from "node:path";

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60_000);
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

function oauthError(
  redirectUri: string,
  error: string,
  state?: string,
  description?: string,
) {
  return oauthRedirect(redirectUri, {
    error,
    error_description: description,
    state,
  });
}

function clientAuthOk(
  req: Request,
  client: { clientId: string; clientSecret?: string },
) {
  if (!client.clientSecret) {
    // public client
    return true;
  }

  const basic = parseBasicAuth(req.header("authorization"));
  if (basic) {
    return (
      basic.username === client.clientId &&
      basic.password === client.clientSecret
    );
  }

  const bodySecret = (req.body?.client_secret ?? "") as string;
  return bodySecret === client.clientSecret;
}

function renderLoginForm(input: {
  action: string;
  clientId: string;
  redirectUri: string;
  responseType: string;
  scope: string;
  state?: string;
  nonce?: string;
  codeChallenge: string;
  codeChallengeMethod: string;
}) {
  const hidden = (name: string, value?: string) =>
    `<input type="hidden" name="${name}" value="${(value ?? "").replaceAll('"', "&quot;")}" />`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Login</title>
  </head>
  <body>
    <main style="max-width: 420px; margin: 40px auto; font-family: system-ui, sans-serif;">
      <h1 style="margin: 0 0 12px;">Sign in</h1>
      <p style="margin: 0 0 20px; color: #444;">Client: ${input.clientId}</p>
      <form method="post" action="${input.action}">
        ${hidden("client_id", input.clientId)}
        ${hidden("redirect_uri", input.redirectUri)}
        ${hidden("response_type", input.responseType)}
        ${hidden("scope", input.scope)}
        ${hidden("state", input.state)}
        ${hidden("nonce", input.nonce)}
        ${hidden("code_challenge", input.codeChallenge)}
        ${hidden("code_challenge_method", input.codeChallengeMethod)}

        <label style="display:block; margin: 0 0 6px;">Email or username</label>
        <input name="emailOrUsername" autocomplete="username" required style="width: 100%; padding: 10px;" />

        <label style="display:block; margin: 12px 0 6px;">Password</label>
        <input name="password" type="password" autocomplete="current-password" required style="width: 100%; padding: 10px;" />

        <button type="submit" style="margin-top: 16px; width: 100%; padding: 10px;">Continue</button>
      </form>
    </main>
  </body>
</html>`;
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

export async function authorizeGet(req: Request, res: Response) {
  const clientId = String(req.query.client_id ?? "");
  const redirectUri = String(req.query.redirect_uri ?? "");
  const responseType = String(req.query.response_type ?? "");
  const scope = String(req.query.scope ?? "");
  const state = req.query.state ? String(req.query.state) : undefined;
  const nonce = req.query.nonce ? String(req.query.nonce) : undefined;
  const codeChallenge = String(req.query.code_challenge ?? "");
  const codeChallengeMethod = String(req.query.code_challenge_method ?? "");

  const client = getOidcClient(clientId);
  if (!client) {
    return res.status(400).json({ error: "invalid_client" });
  }
  if (!redirectUri || !isValidRedirectUri(client, redirectUri)) {
    return res.status(400).json({
      error: "invalid_request",
      error_description: "invalid redirect_uri",
    });
  }

  if (responseType !== "code") {
    return res.redirect(
      oauthError(
        redirectUri,
        "unsupported_response_type",
        state,
        "response_type must be code",
      ),
    );
  }

  if (!scope || !requireOpenIdScope(scope)) {
    return res.redirect(
      oauthError(
        redirectUri,
        "invalid_scope",
        state,
        "scope must include openid",
      ),
    );
  }

  if (!codeChallenge || codeChallengeMethod !== "S256") {
    return res.redirect(
      oauthError(
        redirectUri,
        "invalid_request",
        state,
        "PKCE S256 is required",
      ),
    );
  }

  return res
    .status(200)
    .type("html")
    .send(
      renderLoginForm({
        action: "/oidc/authorize",
        clientId,
        redirectUri,
        responseType,
        scope,
        state,
        nonce,
        codeChallenge,
        codeChallengeMethod,
      }),
    );
}

export async function authorizePost(req: Request, res: Response) {
  const clientId = String(req.body?.client_id ?? "");
  const redirectUri = String(req.body?.redirect_uri ?? "");
  const responseType = String(req.body?.response_type ?? "");
  const scope = String(req.body?.scope ?? "");
  const state = req.body?.state ? String(req.body?.state) : undefined;
  const nonce = req.body?.nonce ? String(req.body?.nonce) : undefined;
  const codeChallenge = String(req.body?.code_challenge ?? "");
  const codeChallengeMethod = String(req.body?.code_challenge_method ?? "");

  const emailOrUsername = String(req.body?.emailOrUsername ?? "");
  const password = String(req.body?.password ?? "");

  const client = getOidcClient(clientId);
  if (!client) {
    return res.status(400).json({ error: "invalid_client" });
  }
  if (!redirectUri || !isValidRedirectUri(client, redirectUri)) {
    return res.status(400).json({
      error: "invalid_request",
      error_description: "invalid redirect_uri",
    });
  }

  if (responseType !== "code") {
    return res.redirect(
      oauthError(
        redirectUri,
        "unsupported_response_type",
        state,
        "response_type must be code",
      ),
    );
  }

  if (!scope || !requireOpenIdScope(scope)) {
    return res.redirect(
      oauthError(
        redirectUri,
        "invalid_scope",
        state,
        "scope must include openid",
      ),
    );
  }

  if (!codeChallenge || codeChallengeMethod !== "S256") {
    return res.redirect(
      oauthError(
        redirectUri,
        "invalid_request",
        state,
        "PKCE S256 is required",
      ),
    );
  }

  if (!emailOrUsername || !password) {
    return res.status(400).type("html").send("Missing credentials");
  }

  const user = await db.query.users.findFirst({
    where: or(
      eq(users.email, emailOrUsername.toLowerCase()),
      eq(users.username, emailOrUsername),
    ),
  });

  if (!user) {
    return res.status(401).type("html").send("Invalid credentials");
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).type("html").send("Invalid credentials");
  }

  const code = randomToken(32);
  const expiresAt = addMinutes(new Date(), 10);

  await db.insert(oidcAuthCodes).values({
    code,
    clientId,
    redirectUri,
    userId: user.id,
    scope,
    nonce: nonce ?? null,
    codeChallenge,
    codeChallengeMethod,
    expiresAt,
  });

  return res.redirect(
    oauthRedirect(redirectUri, {
      code,
      state,
    }),
  );
}

export async function token(req: Request, res: Response) {
  // Accept both JSON and x-www-form-urlencoded (Express will parse based on middleware)
  const grantType = String(req.body?.grant_type ?? "");
  const clientId = String(req.body?.client_id ?? "");

  const client = getOidcClient(clientId);
  if (!client) {
    return res.status(400).json({ error: "invalid_client" });
  }

  if (!clientAuthOk(req, client)) {
    return res.status(401).json({ error: "invalid_client" });
  }

  if (grantType === "authorization_code") {
    const code = String(req.body?.code ?? "");
    const redirectUri = String(req.body?.redirect_uri ?? "");
    const codeVerifier = String(req.body?.code_verifier ?? "");

    if (!code || !redirectUri || !codeVerifier) {
      return res.status(400).json({ error: "invalid_request" });
    }

    const codeRow = await db.query.oidcAuthCodes.findFirst({
      where: eq(oidcAuthCodes.code, code),
    });

    if (!codeRow) {
      return res.status(400).json({ error: "invalid_grant" });
    }

    if (codeRow.clientId !== clientId || codeRow.redirectUri !== redirectUri) {
      return res.status(400).json({ error: "invalid_grant" });
    }

    if (codeRow.consumedAt) {
      return res.status(400).json({ error: "invalid_grant" });
    }

    if (new Date() > codeRow.expiresAt) {
      return res.status(400).json({ error: "invalid_grant" });
    }

    if (!pkceVerifyS256(codeVerifier, codeRow.codeChallenge)) {
      return res.status(400).json({ error: "invalid_grant" });
    }

    // consume code
    await db
      .update(oidcAuthCodes)
      .set({ consumedAt: new Date() })
      .where(eq(oidcAuthCodes.id, codeRow.id));

    const user = await db.query.users.findFirst({
      where: eq(users.id, codeRow.userId),
    });

    if (!user) {
      return res.status(400).json({ error: "invalid_grant" });
    }

    const scopeParts = parseScope(codeRow.scope);

    const accessTokenRaw = randomToken(32);
    const accessTokenHash = hashToken(accessTokenRaw);
    const accessExpiresAt = addMinutes(new Date(), 15);

    await db.insert(oidcAccessTokens).values({
      tokenHash: accessTokenHash,
      clientId,
      userId: user.id,
      scope: codeRow.scope,
      expiresAt: accessExpiresAt,
    });

    const includeRefresh = scopeParts.includes("offline_access");
    let refreshTokenRaw: string | undefined;

    if (includeRefresh) {
      refreshTokenRaw = randomToken(48);
      const refreshTokenHash = hashToken(refreshTokenRaw);
      const refreshExpiresAt = addDays(new Date(), 30);

      await db.insert(oidcRefreshTokens).values({
        tokenHash: refreshTokenHash,
        clientId,
        userId: user.id,
        scope: codeRow.scope,
        expiresAt: refreshExpiresAt,
      });
    }

    const iss = issuer();
    const claims: any = {
      iss,
      sub: String(user.id),
      aud: clientId,
      nonce: codeRow.nonce ?? undefined,
      auth_time: nowSeconds(),
    };

    if (scopeParts.includes("email")) {
      claims.email = user.email;
      claims.email_verified = Boolean(user.emailVerified);
    }

    if (scopeParts.includes("profile")) {
      claims.name = user.fullName ?? user.username;
      claims.picture = user.picture ?? undefined;
    }

    const idToken = signIdToken({ claims });

    return res.json({
      access_token: accessTokenRaw,
      token_type: "Bearer",
      expires_in: 15 * 60,
      scope: codeRow.scope,
      id_token: idToken,
      refresh_token: refreshTokenRaw,
    });
  }

  if (grantType === "refresh_token") {
    const refreshTokenRaw = String(req.body?.refresh_token ?? "");
    if (!refreshTokenRaw) {
      return res.status(400).json({ error: "invalid_request" });
    }

    const refreshTokenHash = hashToken(refreshTokenRaw);
    const tokenRow = await db.query.oidcRefreshTokens.findFirst({
      where: and(
        eq(oidcRefreshTokens.tokenHash, refreshTokenHash),
        isNull(oidcRefreshTokens.revokedAt),
      ),
    });

    if (!tokenRow) {
      return res.status(400).json({ error: "invalid_grant" });
    }

    if (tokenRow.clientId !== clientId) {
      return res.status(400).json({ error: "invalid_grant" });
    }

    if (new Date() > tokenRow.expiresAt) {
      return res.status(400).json({ error: "invalid_grant" });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, tokenRow.userId),
    });

    if (!user) {
      return res.status(400).json({ error: "invalid_grant" });
    }

    // rotate refresh token
    const newRefreshTokenRaw = randomToken(48);
    const newRefreshTokenHash = hashToken(newRefreshTokenRaw);

    await db
      .update(oidcRefreshTokens)
      .set({
        revokedAt: new Date(),
        replacedByTokenHash: newRefreshTokenHash,
      })
      .where(eq(oidcRefreshTokens.id, tokenRow.id));

    await db.insert(oidcRefreshTokens).values({
      tokenHash: newRefreshTokenHash,
      clientId,
      userId: user.id,
      scope: tokenRow.scope,
      expiresAt: addDays(new Date(), 30),
    });

    const accessTokenRaw = randomToken(32);
    const accessTokenHash = hashToken(accessTokenRaw);
    const accessExpiresAt = addMinutes(new Date(), 15);

    await db.insert(oidcAccessTokens).values({
      tokenHash: accessTokenHash,
      clientId,
      userId: user.id,
      scope: tokenRow.scope,
      expiresAt: accessExpiresAt,
    });

    const scopeParts = parseScope(tokenRow.scope);
    const iss = issuer();

    const claims: any = {
      iss,
      sub: String(user.id),
      aud: clientId,
      auth_time: nowSeconds(),
    };

    if (scopeParts.includes("email")) {
      claims.email = user.email;
      claims.email_verified = Boolean(user.emailVerified);
    }

    if (scopeParts.includes("profile")) {
      claims.name = user.fullName ?? user.username;
      claims.picture = user.picture ?? undefined;
    }

    const idToken = signIdToken({ claims });

    return res.json({
      access_token: accessTokenRaw,
      token_type: "Bearer",
      expires_in: 15 * 60,
      scope: tokenRow.scope,
      id_token: idToken,
      refresh_token: newRefreshTokenRaw,
    });
  }

  return res.status(400).json({ error: "unsupported_grant_type" });
}

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
