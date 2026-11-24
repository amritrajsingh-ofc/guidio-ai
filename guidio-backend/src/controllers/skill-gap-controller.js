import { sendError, sendSuccess } from "../utils/api-response.js";
import {
  generateSkillGapReport,
  getSkillGapReportById,
  getSkillGapReports,
} from "../services/skill-gap-service.js";
import { syncCurrentUser } from "../services/user-service.js";

export async function createSkillGapReport(req, res, next) {
  try {
    const user = await syncCurrentUser(req.authenticatedUserId);

    const report = await generateSkillGapReport(user.id);

    return sendSuccess(
      res,
      report,
      "Skill-gap analysis generated successfully",
      201
    );
  } catch (error) {
    return next(error);
  }
}

export async function listSkillGapReports(req, res, next) {
  try {
    const user = await syncCurrentUser(req.authenticatedUserId);

    const reports = await getSkillGapReports(user.id);

    return sendSuccess(
      res,
      reports,
      "Skill-gap reports retrieved successfully"
    );
  } catch (error) {
    return next(error);
  }
}

export async function getSkillGapReport(req, res, next) {
  try {
    const user = await syncCurrentUser(req.authenticatedUserId);

    const report = await getSkillGapReportById(
      req.params.reportId,
      user.id
    );

    if (!report) {
      return sendError(res, "Skill-gap report not found.", 404);
    }

    return sendSuccess(
      res,
      report,
      "Skill-gap report retrieved successfully"
    );
  } catch (error) {
    return next(error);
  }
}