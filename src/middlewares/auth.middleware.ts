import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";

export const requireAuth = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const header = req.header("authorization") ?? req.header("Authorization");
    if (!header) {
      throw new ApiError(401, "Missing Authorization header");
    }

    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
      throw new ApiError(401, "Invalid Authorization header");
    }

    try {
      const payload = verifyAccessToken(token);
      req.user = {
        id: Number(payload.sub),
        email: payload.email,
        username: payload.username,
      };
      return next();
    } catch {
      throw new ApiError(401, "Invalid or expired token");
    }
  },
);
