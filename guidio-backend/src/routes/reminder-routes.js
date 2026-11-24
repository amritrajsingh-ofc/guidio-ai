
import { Router } from "express";
import {
  listReminders,
  readAllReminders,
  readReminder,
} from "../controllers/reminder-controller.js";
import { requireAuth } from "../middleware/require-auth.js";
import { validateObjectId } from "../middleware/validate-object-id.js";
import { writeLimiter } from "../middleware/rate-limiters.js";

const reminderRouter = Router();

reminderRouter.get("/", requireAuth, listReminders);

reminderRouter.patch(
  "/read-all",
  requireAuth,
  writeLimiter,
  readAllReminders
);

reminderRouter.patch(
  "/:reminderId/read",
  requireAuth,
  validateObjectId("reminderId"),
  writeLimiter,
  readReminder
);

export default reminderRouter;
