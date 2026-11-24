import { inngest } from "./client.js";
import { prisma } from "../config/prisma.js";

function getWeekKey(date = new Date()) {
  const targetDate = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );

  const dayNumber = targetDate.getUTCDay() || 7;

  targetDate.setUTCDate(targetDate.getUTCDate() + 4 - dayNumber);

  const yearStart = new Date(Date.UTC(targetDate.getUTCFullYear(), 0, 1));

  const weekNumber = Math.ceil(
    ((targetDate - yearStart) / 86400000 + 1) / 7
  );

  return `${targetDate.getUTCFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
}

function createReminderContent({
  profile,
  latestSkillGap,
  completedInterviewCount,
}) {
  if (!profile.targetRole) {
    return {
      title: "Choose your target role",
      message:
        "Choose a target role so Guidio AI can personalize your career roadmap, skill-gap analysis, and interview questions.",
      actionLabel: "Update profile",
      actionHref: "/profile",
    };
  }

  if (!profile.skills?.length) {
    return {
      title: "Add your current skills",
      message:
        "Add your skills so Guidio AI can identify the most useful next topics for your target role.",
      actionLabel: "Add skills",
      actionHref: "/profile",
    };
  }

  if (!latestSkillGap) {
    return {
      title: "Analyze your skill gap",
      message: `You have selected ${profile.targetRole}. Run Skill Gap Analysis to discover which skills to learn next.`,
      actionLabel: "Analyze skills",
      actionHref: "/skill-gap",
    };
  }

  if (completedInterviewCount === 0) {
    return {
      title: "Practice your first mock interview",
      message: `You have a ${latestSkillGap.matchPercentage}% skill match for ${profile.targetRole}. Practice explaining what you know in a mock interview.`,
      actionLabel: "Start interview",
      actionHref: "/mock-interview",
    };
  }

  return {
    title: "Keep your preparation consistent",
    message: `You have completed ${completedInterviewCount} mock interview(s). Review one priority skill and complete one small practice task this week.`,
    actionLabel: "View dashboard",
    actionHref: "/dashboard",
  };
}

export const createWeeklyReadinessReminders = inngest.createFunction(
  {
    id: "create-weekly-readiness-reminders",
    name: "Create Weekly Readiness Reminders",
    triggers: [
      {
        cron: "TZ=Asia/Kolkata 0 9 * * 1",
      },
    ],
    retries: 2,
  },
  async ({ step, logger }) => {
    const users = await step.run("load-active-students", async () => {
      return prisma.user.findMany({
        where: {
          profile: {
            isNot: null,
          },
        },
        select: {
          id: true,
          profile: {
            select: {
              targetRole: true,
              skills: true,
            },
          },
        },
      });
    });

    const weekKey = getWeekKey();

    const result = await step.run("create-weekly-reminders", async () => {
      const reminders = [];

      for (const user of users) {
        const [latestSkillGap, completedInterviewCount] = await Promise.all([
          prisma.skillGapReport.findFirst({
            where: {
              userId: user.id,
            },
            orderBy: {
              createdAt: "desc",
            },
            select: {
              matchPercentage: true,
            },
          }),

          prisma.interviewSession.count({
            where: {
              userId: user.id,
              status: "COMPLETED",
            },
          }),
        ]);

        const reminder = createReminderContent({
          profile: user.profile,
          latestSkillGap,
          completedInterviewCount,
        });

        const savedReminder = await prisma.weeklyReadinessReminder.upsert({
          where: {
            userId_weekKey: {
              userId: user.id,
              weekKey,
            },
          },
          update: {
            title: reminder.title,
            message: reminder.message,
            actionLabel: reminder.actionLabel,
            actionHref: reminder.actionHref,
          },
          create: {
            userId: user.id,
            weekKey,
            title: reminder.title,
            message: reminder.message,
            actionLabel: reminder.actionLabel,
            actionHref: reminder.actionHref,
          },
        });

        reminders.push(savedReminder.id);
      }

      return reminders;
    });

    logger.info("Weekly readiness reminders created.", {
      studentCount: users.length,
      reminderCount: result.length,
      weekKey,
    });

    return {
      success: true,
      weekKey,
      studentCount: users.length,
      reminderCount: result.length,
    };
  }
);