/*
 * Tests for logging, health reporting and the profile service.
 *
 *   npm test
 *
 * No database, no internet and no real keys are needed. The profile test uses
 * a fake Prisma object, so it proves the service logic, not a real MongoDB.
 */

process.env.NODE_ENV = "production";
process.env.DATABASE_URL ||= "mongodb://localhost:27017/test";
process.env.CLERK_SECRET_KEY ||= "sk_test_dummy";
process.env.CLERK_PUBLISHABLE_KEY ||= "pk_test_dummy";
process.env.GROQ_API_KEY ||= "gsk_dummy";
process.env.CORS_ORIGINS = "https://example.test";
process.env.LOG_LEVEL = "debug";

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

const { logger } = await import("../src/utils/logger.js");
const { createHealthService } = await import("../src/services/health-service.js");

/* ---------------------------------------------------------
   Logger
   --------------------------------------------------------- */

describe("logger", () => {
  let lines;
  const original = { log: console.log, error: console.error };

  beforeEach(() => {
    lines = [];
    console.log = (line) => lines.push(String(line));
    console.error = (line) => lines.push(String(line));
  });

  afterEach(() => {
    console.log = original.log;
    console.error = original.error;
  });

  test("redacts sensitive field names", () => {
    logger.info("test", {
      email: "student@example.com",
      firstName: "Asha",
      authorization: "Bearer abc",
      content: "my private question",
      apiKey: "x",
      port: 5000,
    });

    const entry = JSON.parse(lines[0]);

    assert.equal(entry.email, "[REDACTED]");
    assert.equal(entry.firstName, "[REDACTED]");
    assert.equal(entry.authorization, "[REDACTED]");
    assert.equal(entry.content, "[REDACTED]");
    assert.equal(entry.apiKey, "[REDACTED]");
    assert.equal(entry.port, 5000);
    assert.equal(entry.level, "info");
    assert.equal(entry.msg, "test");
  });

  test("keeps token counters but hides real tokens", () => {
    logger.info("test", { maxOutputTokens: 2048, accessToken: "secret" });

    const entry = JSON.parse(lines[0]);

    assert.equal(entry.maxOutputTokens, 2048);
    assert.equal(entry.accessToken, "[REDACTED]");
  });

  test("masks secrets and personal data inside text", () => {
    const jwt =
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyXzEyMyJ9.c2lnbmF0dXJlMTIz";

    logger.error("test", {
      error: new Error(
        `failed for student@example.com using ${jwt} at mongodb+srv://user:pass@cluster0.mongodb.net/db ` +
          "and https://api.test/v1?key=AIzaSyA1234567890abcdefghijklmnopqrstu&alt=sse"
      ),
    });

    const text = lines[0];

    assert.ok(!text.includes("student@example.com"));
    assert.ok(!text.includes(jwt));
    assert.ok(!text.includes("user:pass"));
    assert.ok(!text.includes("AIzaSy"));
    assert.ok(text.includes("[REDACTED"));
  });

  test("keeps only the reason line of a Prisma error", () => {
    const error = Object.assign(
      new Error(
        'Invalid `prisma.user.create()` invocation:\n{ data: { email: "kid@school.org" } }\n\nUnique constraint failed on the constraint: `User_email_key`'
      ),
      { name: "PrismaClientKnownRequestError", code: "P2002" }
    );

    logger.error("test", { error });

    const entry = JSON.parse(lines[0]);

    assert.equal(entry.error.code, "P2002");
    assert.ok(entry.error.message.includes("Unique constraint failed"));
    assert.ok(!lines[0].includes("kid@school.org"));
  });

  test("never throws, even for circular or BigInt data", () => {
    const circular = {};
    circular.self = circular;

    assert.doesNotThrow(() => logger.info("test", { circular, big: 10n }));
    assert.equal(lines.length, 1);
  });

  test("handles a non-Error rejection reason", () => {
    assert.doesNotThrow(() => logger.error("unhandled_rejection", { error: "plain text" }));
    assert.equal(JSON.parse(lines[0]).error, "plain text");
  });
});

/* ---------------------------------------------------------
   Health service
   --------------------------------------------------------- */

function makeHealth(overrides = {}) {
  const calls = { ping: 0 };
  let clock = 1_000_000;

  const service = createHealthService({
    pingDatabase: async () => {
      calls.ping += 1;
      return true;
    },
    getAiStatus: () => [
      { provider: "gemini", model: "secret-model", available: true, pausedSeconds: 0, lastErrorCode: "x" },
      { provider: "groq", model: "other-model", available: true, pausedSeconds: 0 },
    ],
    isShuttingDown: () => false,
    now: () => clock,
    ...overrides,
  });

  return { service, calls, advance: (ms) => (clock += ms) };
}

describe("health service", () => {
  test("healthy: 200 with database and AI status", async () => {
    const { service } = makeHealth();
    const { httpStatus, body } = await service.check();

    assert.equal(httpStatus, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.status, "healthy");
    assert.equal(body.data.database, "up");
    assert.equal(body.data.ai.status, "up");
    assert.equal(body.data.ai.providers.length, 2);
  });

  test("does not expose models or error codes", async () => {
    const { service } = makeHealth();
    const { body } = await service.check();
    const text = JSON.stringify(body);

    assert.ok(!text.includes("secret-model"));
    assert.ok(!text.includes("lastErrorCode"));
  });

  test("database down: 503", async () => {
    const { service } = makeHealth({ pingDatabase: async () => false });
    const { httpStatus, body } = await service.check();

    assert.equal(httpStatus, 503);
    assert.equal(body.data.status, "degraded");
    assert.equal(body.data.database, "down");
  });

  test("a throwing database check counts as down", async () => {
    const { service } = makeHealth({
      pingDatabase: async () => {
        throw new Error("boom");
      },
    });

    assert.equal((await service.check()).httpStatus, 503);
  });

  test("all AI providers paused: still 200, ai is down", async () => {
    const { service } = makeHealth({
      getAiStatus: () => [
        { provider: "gemini", available: false, pausedSeconds: 42 },
        { provider: "groq", available: false, pausedSeconds: 10 },
      ],
    });

    const { httpStatus, body } = await service.check();

    assert.equal(httpStatus, 200);
    assert.equal(body.data.ai.status, "down");
    assert.equal(body.data.ai.providers[0].retryInSeconds, 42);
  });

  test("one provider paused: ai is degraded", async () => {
    const { service } = makeHealth({
      getAiStatus: () => [
        { provider: "gemini", available: false, pausedSeconds: 5 },
        { provider: "groq", available: true, pausedSeconds: 0 },
      ],
    });

    assert.equal((await service.check()).body.data.ai.status, "degraded");
  });

  test("AI status failure does not break the health check", async () => {
    const { service } = makeHealth({
      getAiStatus: () => {
        throw new Error("boom");
      },
    });

    const { httpStatus, body } = await service.check();

    assert.equal(httpStatus, 200);
    assert.equal(body.data.ai.status, "unknown");
  });

  test("shutting down: 503 and the database is not pinged", async () => {
    const { service, calls } = makeHealth({ isShuttingDown: () => true });
    const { httpStatus, body } = await service.check();

    assert.equal(httpStatus, 503);
    assert.equal(body.data.status, "shutting_down");
    assert.equal(calls.ping, 0);
  });

  test("caches the database result for 10 seconds", async () => {
    const { service, calls, advance } = makeHealth();

    await service.check();
    await service.check();
    assert.equal(calls.ping, 1);

    advance(10_001);
    await service.check();
    assert.equal(calls.ping, 2);
  });

  test("simultaneous requests share one database ping", async () => {
    const { service, calls } = makeHealth();

    await Promise.all([service.check(), service.check(), service.check()]);

    assert.equal(calls.ping, 1);
  });
});

/* ---------------------------------------------------------
   Profile service (fake Prisma)
   --------------------------------------------------------- */

const profileCalls = [];
let upsertError = null;

// prisma.js reuses this object instead of creating a real client.
globalThis.__GuidioPrisma = {
  studentProfile: {
    findUnique: async (args) => {
      profileCalls.push(["findUnique", args]);
      return null;
    },
    upsert: async (args) => {
      profileCalls.push(["upsert", args]);
      if (upsertError) throw upsertError;
      return { id: "p1" };
    },
    update: async (args) => {
      profileCalls.push(["update", args]);
      return { id: "p1", updated: true };
    },
  },
};

const { getProfileByUserId, saveProfile } = await import("../src/services/profile-service.js");

describe("profile service", () => {
  beforeEach(() => {
    profileCalls.length = 0;
    upsertError = null;
  });

  test("reads the profile scoped to the user id", async () => {
    await getProfileByUserId("user1");

    assert.deepEqual(profileCalls[0], ["findUnique", { where: { userId: "user1" } }]);
  });

  test("create branch fills defaults, update branch only sends given fields", async () => {
    await saveProfile("user1", { targetRole: "Backend Developer", skills: ["Node.js"] });

    const [, args] = profileCalls[0];

    assert.deepEqual(args.where, { userId: "user1" });
    assert.deepEqual(args.update, { targetRole: "Backend Developer", skills: ["Node.js"] });
    assert.equal(args.create.userId, "user1");
    assert.equal(args.create.college, null);
    assert.deepEqual(args.create.interests, []);
  });

  test("a concurrent first save (P2002) falls back to an update", async () => {
    upsertError = Object.assign(new Error("duplicate"), { code: "P2002" });

    const result = await saveProfile("user1", { degree: "B.Tech" });

    assert.equal(result.updated, true);
    assert.deepEqual(profileCalls[1], [
      "update",
      { where: { userId: "user1" }, data: { degree: "B.Tech" } },
    ]);
  });

  test("other database errors are not hidden", async () => {
    upsertError = Object.assign(new Error("down"), { code: "P1001" });

    await assert.rejects(() => saveProfile("user1", {}), { code: "P1001" });
  });
});