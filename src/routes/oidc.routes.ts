import { Router } from "express";
import {
  authorizeGet,
  authorizePost,
  token,
  userinfo,
} from "../controllers/oidc.controller";

const router = Router();

router.get("/authorize", authorizeGet);
router.post("/authorize", authorizePost);
router.post("/token", token);
router.get("/userinfo", userinfo);

export default router;
