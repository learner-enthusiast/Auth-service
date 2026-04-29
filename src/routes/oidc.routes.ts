import { Router } from "express";
import {
  authorizeGet,
  authorizePost,
  createOidcClient,
  getMyOidcClientByClientId,
  listMyOidcClients,
  token,
  userinfo,
} from "../controllers/oidc.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

router.get("/authorize", authorizeGet);
router.post("/authorize", authorizePost);
router.post("/clients", requireAuth, createOidcClient);
router.post("/token", token);
router.get("/userinfo", userinfo);
router.get("/clients", requireAuth, listMyOidcClients);
router.get("/clients/:clientId", requireAuth, getMyOidcClientByClientId);

export default router;
