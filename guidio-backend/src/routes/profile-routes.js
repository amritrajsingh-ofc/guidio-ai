import { Router } from "express";
import {
  getProfile,
  upsertProfile,
} from "../controllers/profile-controller.js";
import { requireAuth } from "../middleware/require-auth.js";
import { validateProfile } from "../middleware/validate-profile.js";
import { writeLimiter } from "../middleware/rate-limiters.js";

const profileRouter = Router();

profileRouter.get("/", requireAuth, getProfile);

profileRouter.put(
  "/",
  requireAuth,
  writeLimiter,
  validateProfile,
  upsertProfile
);

export default profileRouter;