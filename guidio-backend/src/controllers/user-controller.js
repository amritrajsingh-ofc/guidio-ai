import { sendSuccess } from "../utils/api-response.js";
import {
  getUserWithProfile,
  syncCurrentUser,
} from "../services/user-service.js";

export async function getCurrentUser(req, res, next) {
  try {
    const syncedUser = await syncCurrentUser(req.authenticatedUserId);

    const user = await getUserWithProfile(syncedUser.clerkId);

    return sendSuccess(res, user, "User synchronized and retrieved");
  } catch (error) {
    return next(error);
  }
}