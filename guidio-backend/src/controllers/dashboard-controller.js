import { sendSuccess } from "../utils/api-response.js";
import { getDashboardData } from "../services/dashboard-service.js";
import { syncCurrentUser } from "../services/user-service.js";

export async function getDashboard(req, res, next) {
  try {
    const user = await syncCurrentUser(req.authenticatedUserId);

    const dashboardData = await getDashboardData(user.id);

    return sendSuccess(
      res,
      dashboardData,
      "Dashboard data retrieved successfully"
    );
  } catch (error) {
    return next(error);
  }
}