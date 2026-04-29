import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { users } from "../models/user.schema";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
const options = {
  httpOnly: true,
  secure: true,
};
export const getCurrentUser = asyncHandler(
  async (req: Request, res: Response) => {
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.user.id),
      columns: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        phone: true,
        picture: true,
        emailVerified: true,
        phoneVerified: true,
        isActive: true,
        isLocked: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({ user });
  },
);
export const changePassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body ?? {};
    if (!currentPassword || !newPassword) {
      throw new ApiError(400, "currentPassword and newPassword are required");
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, req.user.id),
    });

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const ok = await bcrypt.compare(String(currentPassword), user.passwordHash);
    if (!ok) {
      throw new ApiError(401, "Invalid current password");
    }

    const passwordHash = await bcrypt.hash(String(newPassword), 12);
    await db
      .update(users)
      .set({
        passwordHash,
        refreshToken: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return res.status(200).json(new ApiResponse(200, {}, "Password changed"));
  },
);
export const updateProfile = asyncHandler(
  async (req: Request, res: Response) => {
    const { fullName, phone, picture } = req.body ?? {};

    const update: {
      fullName?: string | null;
      phone?: string | null;
      picture?: string | null;
      updatedAt: Date;
    } = { updatedAt: new Date() };

    if (fullName !== undefined)
      update.fullName = fullName ? String(fullName) : null;
    if (phone !== undefined) update.phone = phone ? String(phone) : null;
    if (picture !== undefined)
      update.picture = picture ? String(picture) : null;

    const [updated] = await db
      .update(users)
      .set(update)
      .where(eq(users.id, req.user.id))
      .returning({
        id: users.id,
        username: users.username,
        email: users.email,
        fullName: users.fullName,
        phone: users.phone,
        picture: users.picture,
        updatedAt: users.updatedAt,
      });

    if (!updated) {
      throw new ApiError(404, "User not found");
    }

    return res
      .status(200)
      .json(
        new ApiResponse(200, { user: updated }, "User Updated Succesfully"),
      );
  },
);
