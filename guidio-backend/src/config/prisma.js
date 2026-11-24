import { PrismaClient } from "@prisma/client";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.__GuidioPrisma ||
  new PrismaClient({
    log: env.isDevelopment ? ["error", "warn"] : ["error"],
  });

if (!env.isProduction) {
  globalForPrisma.__GuidioPrisma = prisma;
}

/** Connects with a few short retries. Never throws; returns true or false. */
export async function connectDatabase({ attempts = 3, delayMs = 2000 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await prisma.$connect();
      logger.info("database_connected");
      return true;
    } catch (error) {
      logger.error("database_connect_failed", { attempt, attempts, error });

      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  return false;
}

export async function disconnectDatabase() {
  try {
    await prisma.$disconnect();
  } catch (error) {
    logger.warn("database_disconnect_failed", { error });
  }
}

/** True if MongoDB answers a ping within the timeout. Never throws. */
export async function pingDatabase(timeoutMs = 3000) {
  let timer;

  try {
    await Promise.race([
      prisma.$runCommandRaw({ ping: 1 }),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("ping timeout")), timeoutMs);
      }),
    ]);

    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}