import { sendError, sendSuccess } from "../utils/api-response.js";
import {
  getUnreadReminderCount,
  getUserReminders,
  markAllRemindersAsRead,
  markReminderAsRead,
} from "../services/reminder-service.js";
import { syncCurrentUser } from "../services/user-service.js";

export async function listReminders(req, res, next) {
  try {
    const user = await syncCurrentUser(req.authenticatedUserId);

    const [reminders, unreadCount] = await Promise.all([
      getUserReminders(user.id),
      getUnreadReminderCount(user.id),
    ]);

    return sendSuccess(
      res,
      {
        reminders,
        unreadCount,
      },
      "Reminders retrieved successfully"
    );
  } catch (error) {
    return next(error);
  }
}

export async function readReminder(req, res, next) {
  try {
    const user = await syncCurrentUser(req.authenticatedUserId);

    const reminder = await markReminderAsRead(
      req.params.reminderId,
      user.id
    );

    if (!reminder) {
      return sendError(res, "Reminder not found.", 404);
    }

    return sendSuccess(res, reminder, "Reminder marked as read");
  } catch (error) {
    return next(error);
  }
}

export async function readAllReminders(req, res, next) {
  try {
    const user = await syncCurrentUser(req.authenticatedUserId);

    const result = await markAllRemindersAsRead(user.id);

    return sendSuccess(
      res,
      {
        updatedCount: result.count,
      },
      "All reminders marked as read"
    );
  } catch (error) {
    return next(error);
  }
}