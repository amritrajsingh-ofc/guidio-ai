import { prisma } from "../config/prisma.js";

function calculateProfileCompletion(profile) {
  if (!profile) {
    return 0;
  }

  const fields = [
    profile.education,
    profile.college,
    profile.degree,
    profile.graduationYear,
    profile.experienceLevel,
    profile.targetRole,
    profile.skills?.length > 0,
    profile.interests?.length > 0,
  ];

  const completedFields = fields.filter(Boolean).length;

  return Math.round((completedFields / fields.length) * 100);
}

function calculateAverageInterviewScore(interviews) {
  const completedInterviews = interviews.filter(
    (interview) =>
      interview.status === "COMPLETED" &&
      typeof interview.overallScore === "number"
  );

  if (!completedInterviews.length) {
    return null;
  }

  const totalScore = completedInterviews.reduce(
    (total, interview) => total + interview.overallScore,
    0
  );

  return Math.round(totalScore / completedInterviews.length);
}

function calculateReadinessScore({
  profileCompletion,
  skillMatch,
  averageInterviewScore,
}) {
  const profileContribution = profileCompletion * 0.2;

  const skillContribution =
    typeof skillMatch === "number" ? skillMatch * 0.4 : 0;

  const interviewContribution =
    typeof averageInterviewScore === "number"
      ? averageInterviewScore * 0.4
      : 0;

  const availableWeight =
    0.2 +
    (typeof skillMatch === "number" ? 0.4 : 0) +
    (typeof averageInterviewScore === "number" ? 0.4 : 0);

  if (availableWeight === 0) {
    return 0;
  }

  return Math.round(
    (profileContribution + skillContribution + interviewContribution) /
      availableWeight
  );
}

function getActivityIcon(type) {
  const icons = {
    profile: "profile",
    assistant: "assistant",
    career: "career",
    skillGap: "skillGap",
    interview: "interview",
  };

  return icons[type] || "profile";
}

function createActivity({
  type,
  title,
  description,
  createdAt,
  href,
}) {
  return {
    type,
    icon: getActivityIcon(type),
    title,
    description,
    createdAt,
    href,
  };
}

export async function getDashboardData(userId) {
  const [
    profile,
    interviewSessions,
    userMessageCount,
    latestSkillGapReport,
    latestCareerPlan,
    latestConversation,
    latestInterview,
    latestProfileUpdate,
  ] = await Promise.all([
    prisma.studentProfile.findUnique({
      where: {
        userId,
      },
    }),

    prisma.interviewSession.findMany({
      where: {
        userId,
      },
      select: {
        status: true,
        overallScore: true,
      },
    }),

    prisma.assistantMessage.count({
      where: {
        role: "user",
        conversation: {
          userId,
        },
      },
    }),

    prisma.skillGapReport.findFirst({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        targetRole: true,
        matchPercentage: true,
        createdAt: true,
      },
    }),

    prisma.careerPlan.findFirst({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        primaryRole: true,
        readinessScore: true,
        createdAt: true,
      },
    }),

    prisma.assistantConversation.findFirst({
      where: {
        userId,
      },
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        id: true,
        title: true,
        updatedAt: true,
      },
    }),

    prisma.interviewSession.findFirst({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        targetRole: true,
        status: true,
        overallScore: true,
        createdAt: true,
      },
    }),

    prisma.studentProfile.findUnique({
      where: {
        userId,
      },
      select: {
        updatedAt: true,
      },
    }),
  ]);

  const profileCompletion = calculateProfileCompletion(profile);

  const completedInterviewCount = interviewSessions.filter(
    (interview) => interview.status === "COMPLETED"
  ).length;

  const averageInterviewScore =
    calculateAverageInterviewScore(interviewSessions);

  const latestSkillMatch = latestSkillGapReport?.matchPercentage ?? null;

  const readinessScore = calculateReadinessScore({
    profileCompletion,
    skillMatch: latestSkillMatch,
    averageInterviewScore,
  });

  const activities = [];

  if (latestProfileUpdate) {
    activities.push(
      createActivity({
        type: "profile",
        title: "Profile updated",
        description: profile?.targetRole
          ? `Target role: ${profile.targetRole}`
          : "Add your target role to personalize Guidio AI.",
        createdAt: latestProfileUpdate.updatedAt,
        href: "/profile",
      })
    );
  }

  if (latestConversation) {
    activities.push(
      createActivity({
        type: "assistant",
        title: "AI Assistant conversation",
        description: latestConversation.title,
        createdAt: latestConversation.updatedAt,
        href: "/assistant",
      })
    );
  }

  if (latestCareerPlan) {
    activities.push(
      createActivity({
        type: "career",
        title: "Career roadmap generated",
        description: `Recommended role: ${latestCareerPlan.primaryRole}`,
        createdAt: latestCareerPlan.createdAt,
        href: "/career-guidance",
      })
    );
  }

  if (latestSkillGapReport) {
    activities.push(
      createActivity({
        type: "skillGap",
        title: "Skill gap analysis completed",
        description: `${latestSkillGapReport.matchPercentage}% match for ${latestSkillGapReport.targetRole}`,
        createdAt: latestSkillGapReport.createdAt,
        href: "/skill-gap",
      })
    );
  }

  if (latestInterview) {
    activities.push(
      createActivity({
        type: "interview",
        title:
          latestInterview.status === "COMPLETED"
            ? "Mock interview completed"
            : "Mock interview started",
        description:
          latestInterview.status === "COMPLETED"
            ? `${latestInterview.targetRole} · Score: ${latestInterview.overallScore ?? "—"}/100`
            : `${latestInterview.targetRole} · Continue your practice`,
        createdAt: latestInterview.createdAt,
        href: "/mock-interview",
      })
    );
  }

  activities.sort(
    (firstActivity, secondActivity) =>
      new Date(secondActivity.createdAt) - new Date(firstActivity.createdAt)
  );

  return {
    profile: {
      completion: profileCompletion,
      targetRole: profile?.targetRole || null,
      skillsCount: profile?.skills?.length || 0,
      interestsCount: profile?.interests?.length || 0,
      education: profile?.education || null,
      degree: profile?.degree || null,
      experienceLevel: profile?.experienceLevel || null,
    },

    metrics: {
      readinessScore,
      interviewsTaken: interviewSessions.length,
      completedInterviews: completedInterviewCount,
      averageInterviewScore,
      doubtsAsked: userMessageCount,
      skillMatch: latestSkillMatch,
    },

    latest: {
      skillGapReport: latestSkillGapReport,
      careerPlan: latestCareerPlan,
      interview: latestInterview,
    },

    activities: activities.slice(0, 5),
  };
}