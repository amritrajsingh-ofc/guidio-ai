import { prisma } from "../config/prisma.js";

/*
 * Student profile data access.
 * `userId` is always the DATABASE user id returned by syncCurrentUser(),
 * never a value taken from the request, so one user can never read or
 * change another user's profile.
 */

export function getProfileByUserId(userId) {
  return prisma.studentProfile.findUnique({
    where: { userId },
  });
}

export async function saveProfile(userId, profileData) {
  try {
    return await prisma.studentProfile.upsert({
      where: { userId },
      update: { ...profileData },
      create: {
        userId,
        education: profileData.education || null,
        college: profileData.college || null,
        degree: profileData.degree || null,
        graduationYear: profileData.graduationYear || null,
        experienceLevel: profileData.experienceLevel || null,
        targetRole: profileData.targetRole || null,
        skills: profileData.skills || [],
        interests: profileData.interests || [],
      },
    });
  } catch (error) {
    // Two saves for a brand-new profile arrived together and the other one
    // created it first (userId is unique). Apply this save as an update.
    if (error?.code === "P2002") {
      return prisma.studentProfile.update({
        where: { userId },
        data: { ...profileData },
      });
    }

    throw error;
  }
}