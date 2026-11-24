import { sendError, sendSuccess } from "../utils/api-response.js";
import {
  generateCareerPlan,
  getCareerPlanById,
  getCareerPlans,
} from "../services/career-service.js";
import { syncCurrentUser } from "../services/user-service.js";

export async function createCareerPlan(req, res, next) {
  try {
    const user = await syncCurrentUser(req.authenticatedUserId);

    const plan = await generateCareerPlan(user.id);

    return sendSuccess(
      res,
      plan,
      "Career guidance generated successfully",
      201
    );
  } catch (error) {
    return next(error);
  }
}

export async function listCareerPlans(req, res, next) {
  try {
    const user = await syncCurrentUser(req.authenticatedUserId);

    const plans = await getCareerPlans(user.id);

    return sendSuccess(res, plans, "Career plans retrieved successfully");
  } catch (error) {
    return next(error);
  }
}

export async function getCareerPlan(req, res, next) {
  try {
    const user = await syncCurrentUser(req.authenticatedUserId);

    const plan = await getCareerPlanById(req.params.planId, user.id);

    if (!plan) {
      return sendError(res, "Career plan not found.", 404);
    }

    return sendSuccess(res, plan, "Career plan retrieved successfully");
  } catch (error) {
    return next(error);
  }
}