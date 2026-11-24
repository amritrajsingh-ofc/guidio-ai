import { Router } from "express";

import {
  createCareerPlan,
  getCareerPlan,
  listCareerPlans,
} from "../controllers/career-controller.js";

import { requireAuth } from "../middleware/require-auth.js";
import { validateObjectId } from "../middleware/validate-object-id.js";
import { aiLimiter } from "../middleware/rate-limiters.js";

const careerRouter = Router();

careerRouter.post("/plans", requireAuth, aiLimiter, createCareerPlan);

careerRouter.get("/plans", requireAuth, listCareerPlans);

careerRouter.get(
  "/plans/:planId",
  requireAuth,
  validateObjectId("planId"),
  getCareerPlan
);

export default careerRouter;