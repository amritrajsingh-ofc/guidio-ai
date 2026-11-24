import { sendSuccess } from "../utils/api-response.js";
import { syncCurrentUser } from "../services/user-service.js";
import { getProfileByUserId, saveProfile } from "../services/profile-service.js";

export async function getProfile(req, res, next) {
  try {
    const user = await syncCurrentUser(req.authenticatedUserId);

    const profile = await getProfileByUserId(user.id);

    return sendSuccess(res, profile, "Profile retrieved");
  } catch (error) {
    return next(error);
  }
}

export async function upsertProfile(req, res, next) {
  try {
    const user = await syncCurrentUser(req.authenticatedUserId);

    const profile = await saveProfile(user.id, req.validatedProfileData);

    return sendSuccess(res, profile, "Profile saved successfully");
  } catch (error) {
    return next(error);
  }
}