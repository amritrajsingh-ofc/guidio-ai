import { Router } from "express";

import {
  createSkillGapReport,
  getSkillGapReport,
  listSkillGapReports,
} from "../controllers/skill-gap-controller.js";

import { requireAuth } from "../middleware/require-auth.js";
import { validateObjectId } from "../middleware/validate-object-id.js";
import { aiLimiter } from "../middleware/rate-limiters.js";

const skillGapRouter = Router();

skillGapRouter.post("/reports", requireAuth, aiLimiter, createSkillGapReport);

skillGapRouter.get("/reports", requireAuth, listSkillGapReports);

skillGapRouter.get(
  "/reports/:reportId",
  requireAuth,
  validateObjectId("reportId"),
  getSkillGapReport
);

export default skillGapRouter;