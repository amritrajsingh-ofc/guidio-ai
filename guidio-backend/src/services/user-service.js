import { clerkClient } from "@clerk/express";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/app-error.js";
import { logger } from "../utils/logger.js";

/*
 * Maps the verified Clerk user id to our database user.
 *
 * Fast path (almost every request): ONE indexed database lookup.
 * Clerk's API is only called when the user is new, or when the saved
 * name/email/photo is older than 24 hours.
 */

const PROFILE_REFRESH_MS = 24 * 60 * 60 * 1000;

// First page load fires several requests at once. Share one lookup per user.
const inFlight = new Map();

async function readClerkProfile(clerkId) {
  const clerkUser = await clerkClient.users.getUser(clerkId);
  const primaryEmail = clerkUser.primaryEmailAddress;
  const email = primaryEmail?.emailAddress;

  if (!email) {
    throw new AppError(
      "Your account does not have a primary email address.",
      400,
      { code: "email_missing" }
    );
  }

  return {
    email,
    emailVerified: primaryEmail.verification?.status === "verified",
    firstName: clerkUser.firstName || null,
    lastName: clerkUser.lastName || null,
    imageUrl: clerkUser.imageUrl || null,
  };
}

async function refreshUser(user) {
  const profile = await readClerkProfile(user.clerkId);

  const data = {
    firstName: profile.firstName,
    lastName: profile.lastName,
    imageUrl: profile.imageUrl,
  };

  if (profile.email !== user.email) {
    const owner = await prisma.user.findUnique({
      where: { email: profile.email },
      select: { id: true },
    });

    // Keep the old email if another account already uses the new one.
    if (!owner) {
      data.email = profile.email;
    }
  }

  // Saving also refreshes updatedAt, which restarts the 24-hour timer.
  return prisma.user.update({ where: { id: user.id }, data });
}

async function createOrLinkUser(clerkId) {
  const profile = await readClerkProfile(clerkId);

  const existingByEmail = await prisma.user.findUnique({
    where: { email: profile.email },
  });

  if (existingByEmail) {
    // Re-attach an older record (for example after switching Clerk instances),
    // but only when Clerk confirms the email address belongs to this person.
    if (!profile.emailVerified) {
      throw new AppError(
        "Please verify your email address before continuing.",
        403,
        { code: "email_not_verified" }
      );
    }

    return prisma.user.update({
      where: { id: existingByEmail.id },
      data: {
        clerkId,
        firstName: profile.firstName,
        lastName: profile.lastName,
        imageUrl: profile.imageUrl,
      },
    });
  }

  try {
    return await prisma.user.create({
      data: {
        clerkId,
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        imageUrl: profile.imageUrl,
      },
    });
  } catch (error) {
    // Another request created the same user a moment ago.
    if (error?.code === "P2002") {
      const created = await prisma.user.findUnique({ where: { clerkId } });

      if (created) return created;
    }

    throw error;
  }
}

async function resolveUser(clerkId) {
  const user = await prisma.user.findUnique({ where: { clerkId } });

  if (!user) {
    return createOrLinkUser(clerkId);
  }

  if (Date.now() - user.updatedAt.getTime() < PROFILE_REFRESH_MS) {
    return user;
  }

  try {
    return await refreshUser(user);
  } catch (error) {
    // A Clerk outage must not block a user who is already signed in.
    logger.warn("clerk_profile_refresh_failed", { error });
    return user;
  }
}

/** Same name and signature as before, so no controller needs to change. */
export async function syncCurrentUser(clerkId) {
  if (!clerkId) {
    throw new AppError("Unauthorized. Please sign in first.", 401, {
      code: "unauthorized",
    });
  }

  const running = inFlight.get(clerkId);

  if (running) return running;

  const promise = resolveUser(clerkId).finally(() => {
    inFlight.delete(clerkId);
  });

  inFlight.set(clerkId, promise);

  return promise;
}

export async function getUserWithProfile(clerkId) {
  return prisma.user.findUnique({
    where: { clerkId },
    include: { profile: true },
  });
}