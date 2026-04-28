import { Router } from "express";
import {
  changePassword,
  getCurrentUser,
  updateProfile,
} from "../controllers/users.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

router.get("/me", requireAuth, getCurrentUser);
router.post("/change-password", requireAuth, changePassword);
router.patch("/me", requireAuth, updateProfile);

export default router;
