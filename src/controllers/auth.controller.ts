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
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";

function sanitizeUser(user: any) {
  // Avoid returning secrets (hashes/tokens)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, refreshToken, ...safe } = user;
  return safe;
}
const options = {
  httpOnly: true,
  secure: true,
};
export const register = asyncHandler(async (req: Request, res: Response) => {
  const { username, email, password, fullName, phone } = req.body ?? {};

  if (!username || !email || !password) {
    throw new ApiError(400, "username, email, password are required");
  }

  const existing = await db.query.users.findFirst({
    where: or(eq(users.email, email), eq(users.username, username)),
    columns: { id: true },
  });

  if (existing) {
    throw new ApiError(409, "User already exists");
  }

  const passwordHash = await bcrypt.hash(String(password), 12);

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

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        user: created,
        tokens: {
          accessToken,
          refreshToken: refreshTokenRaw,
        },
      },
      "User Registered Succesfully",
    ),
  );
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { emailOrUsername, password } = req.body ?? {};

  if (!emailOrUsername || !password) {
    throw new ApiError(400, "emailOrUsername and password are required");
  }

  const user = await db.query.users.findFirst({
    where: or(
      eq(users.email, String(emailOrUsername).toLowerCase()),
      eq(users.username, String(emailOrUsername)),
    ),
  });

  if (!user) {
    throw new ApiError(401, "Invalid credentials");
  }

  if (user.isActive === false || user.isLocked === true) {
    throw new ApiError(403, "Account disabled");
  }

  const ok = await bcrypt.compare(String(password), user.passwordHash);
  if (!ok) {
    throw new ApiError(401, "Invalid credentials");
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

  return res
    .status(201)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        201,
        {
          user: sanitizeUser(user),
          tokens: {
            accessToken,
            refreshToken: refreshTokenRaw,
          },
        },
        "Login Succesfully",
      ),
    );
});

export const refreshToken = asyncHandler(
  async (req: Request, res: Response) => {
    const { refreshToken: token } = (req.body || req.cookies) ?? {};
    if (!token) {
      return res.status(400).json({ message: "refreshToken is required" });
    }

    let payload: { sub: string };

    payload = verifyRefreshToken(String(token));

    const userId = Number(payload.sub);
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!user || !user.refreshToken) {
      throw new ApiError(401, "Invalid refresh token");
    }

    const matches = await bcrypt.compare(String(token), user.refreshToken);
    if (!matches) {
      throw new ApiError(401, "Invalid refresh token");
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

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new ApiResponse(
          200,
          {
            tokens: {
              accessToken,
              refreshToken: refreshTokenRaw,
            },
          },
          "Token recreated",
        ),
      );
  },
);

export async function logout(req: Request, res: Response) {
  const { refreshToken: token } = req.body ?? {};

  // Prefer refresh token logout (works even if access expired)
  if (token) {
    const payload = verifyRefreshToken(String(token));
    const userId = Number(payload.sub);
    await db
      .update(users)
      .set({ refreshToken: null, updatedAt: new Date() })
      .where(eq(users.id, userId));
    return res
      .status(204)
      .clearCookie("accessToken", options)
      .clearCookie("refreshToken", options);
  }

  // Fallback: if already authenticated, revoke the stored refresh token
  if (req.user?.id) {
    await db
      .update(users)
      .set({ refreshToken: null, updatedAt: new Date() })
      .where(eq(users.id, req.user.id));
  }

  return res
    .status(204)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options);
}
