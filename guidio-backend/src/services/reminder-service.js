import { prisma } from "../config/prisma.js";

export async function getUserReminders(userId) {
  return prisma.weeklyReadinessReminder.findMany({
    where: {
      userId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 10,
  });
}

export async function getUnreadReminderCount(userId) {
  return prisma.weeklyReadinessReminder.count({
    where: {
      userId,
      isRead: false,
    },
  });
}

export async function markReminderAsRead(reminderId, userId) {
  const reminder = await prisma.weeklyReadinessReminder.findFirst({
    where: {
      id: reminderId,
      userId,
    },
  });

  if (!reminder) {
    return null;
  }

  return prisma.weeklyReadinessReminder.update({
    where: {
      id: reminder.id,
    },
    data: {
      isRead: true,
    },
  });
}

export async function markAllRemindersAsRead(userId) {
  return prisma.weeklyReadinessReminder.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
    },
  });
}