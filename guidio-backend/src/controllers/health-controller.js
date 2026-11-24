import { pingDatabase } from "../config/prisma.js";
import { aiService } from "../ai/ai-service.js";
import { isShuttingDown } from "../utils/lifecycle.js";
import { createHealthService } from "../services/health-service.js";

/*
 * Public health check (used by Render and uptime monitors).
 * The database result is cached for 10 seconds so frequent checks do not
 * hammer MongoDB. No secrets, versions or environment details are exposed.
 */

const healthService = createHealthService({
  pingDatabase,
  getAiStatus: () => aiService.getStatus(),
  isShuttingDown,
});

export async function getHealthStatus(req, res, next) {
  try {
    const { httpStatus, body } = await healthService.check();

    res.setHeader("Cache-Control", "no-store");

    if (body.data.status === "shutting_down") {
      res.setHeader("Connection", "close");
    }

    return res.status(httpStatus).json(body);
  } catch (error) {
    return next(error);
  }
}