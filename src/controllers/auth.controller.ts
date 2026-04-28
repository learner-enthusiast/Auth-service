import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import { eq, or } from "drizzle-orm";

import { db } from "../db";
import { users } from "../models/user.schema";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt";

function sanitizeUser(user: any) {
  // Avoid returning secrets (hashes/tokens)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, refreshToken, ...safe } = user;
  return safe;
}

export async function register(req: Request, res: Response) {
  const { username, email, password, fullName, phone } = req.body ?? {};

  if (!username || !email || !password) {
    return res
      .status(400)
      .json({ message: "username, email, password are required" });
  }

  const existing = await db.query.users.findFirst({
    where: or(eq(users.email, email), eq(users.username, username)),
    columns: { id: true },
  });

  if (existing) {
    return res.status(409).json({ message: "User already exists" });
  }

  const passwordHash = await bcrypt.hash(String(password), 12);

  try {
    const [created] = await db
      .insert(users)
      .values({
        username: String(username),
        email: String(email).toLowerCase(),
        fullName: fullName ? String(fullName) : null,
        phone: phone ? String(phone) : null,
        passwordHash,
      })
      .returning({
        id: users.id,
        username: users.username,
        email: users.email,
        fullName: users.fullName,
        phone: users.phone,
        picture: users.picture,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    const accessToken = signAccessToken({
      userId: created.id,
      email: created.email,
      username: created.username,
    });

    const refreshTokenRaw = signRefreshToken({ userId: created.id });
    const refreshTokenHash = await bcrypt.hash(refreshTokenRaw, 12);

    await db
      .update(users)
      .set({ refreshToken: refreshTokenHash, updatedAt: new Date() })
      .where(eq(users.id, created.id));

    return res.status(201).json({
      user: created,
      tokens: {
        accessToken,
        refreshToken: refreshTokenRaw,
      },
    });
  } catch (err: any) {
    if (err?.code === "23505") {
      return res.status(409).json({ message: "User already exists" });
    }
    return res.status(500).json({ message: "Registration failed" });
  }
}

export async function login(req: Request, res: Response) {
  const { emailOrUsername, password } = req.body ?? {};

  if (!emailOrUsername || !password) {
    return res
      .status(400)
      .json({ message: "emailOrUsername and password are required" });
  }

  const user = await db.query.users.findFirst({
    where: or(
      eq(users.email, String(emailOrUsername).toLowerCase()),
      eq(users.username, String(emailOrUsername)),
    ),
  });

  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  if (user.isActive === false || user.isLocked === true) {
    return res.status(403).json({ message: "Account disabled" });
  }

  const ok = await bcrypt.compare(String(password), user.passwordHash);
  if (!ok) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const accessToken = signAccessToken({
    userId: user.id,
    email: user.email,
    username: user.username,
  });

  const refreshTokenRaw = signRefreshToken({ userId: user.id });
  const refreshTokenHash = await bcrypt.hash(refreshTokenRaw, 12);

  await db
    .update(users)
    .set({
      refreshToken: refreshTokenHash,
      lastLoginAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  return res.json({
    user: sanitizeUser(user),
    tokens: {
      accessToken,
      refreshToken: refreshTokenRaw,
    },
  });
}

export async function refreshToken(req: Request, res: Response) {
  const { refreshToken: token } = req.body ?? {};
  if (!token) {
    return res.status(400).json({ message: "refreshToken is required" });
  }

  let payload: { sub: string };
  try {
    payload = verifyRefreshToken(String(token));
  } catch {
    return res.status(401).json({ message: "Invalid refresh token" });
  }

  const userId = Number(payload.sub);
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user || !user.refreshToken) {
    return res.status(401).json({ message: "Invalid refresh token" });
  }

  const matches = await bcrypt.compare(String(token), user.refreshToken);
  if (!matches) {
    return res.status(401).json({ message: "Invalid refresh token" });
  }

  const accessToken = signAccessToken({
    userId: user.id,
    email: user.email,
    username: user.username,
  });

  const refreshTokenRaw = signRefreshToken({ userId: user.id });
  const refreshTokenHash = await bcrypt.hash(refreshTokenRaw, 12);

  await db
    .update(users)
    .set({ refreshToken: refreshTokenHash, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  return res.json({
    tokens: {
      accessToken,
      refreshToken: refreshTokenRaw,
    },
  });
}

export async function logout(req: Request, res: Response) {
  const { refreshToken: token } = req.body ?? {};

  // Prefer refresh token logout (works even if access expired)
  if (token) {
    try {
      const payload = verifyRefreshToken(String(token));
      const userId = Number(payload.sub);
      await db
        .update(users)
        .set({ refreshToken: null, updatedAt: new Date() })
        .where(eq(users.id, userId));
      return res.status(204).send();
    } catch {
      return res.status(204).send();
    }
  }

  // Fallback: if already authenticated, revoke the stored refresh token
  if (req.user?.id) {
    await db
      .update(users)
      .set({ refreshToken: null, updatedAt: new Date() })
      .where(eq(users.id, req.user.id));
  }

  return res.status(204).send();
}
