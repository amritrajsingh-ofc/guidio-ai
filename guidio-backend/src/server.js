import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { createApp } from "./app.js";
import { connectDatabase, disconnectDatabase } from "./config/prisma.js";
import { beginShutdown, isShuttingDown } from "./utils/lifecycle.js";

const app = createApp();

// Listen first, so Render sees the open port straight away (free-tier cold starts).
// The database connects in the background; /api/health reports its state.
const server = app.listen(env.port, "0.0.0.0", (error) => {
  // Express 5 passes startup errors (for example EADDRINUSE) to this callback.
  if (error) {
    logger.error("server_start_failed", { error });
    process.exit(1);
  }

  logger.info("server_started", {
    port: env.port,
    environment: env.nodeEnv,
    allowedOrigins: env.corsOrigins,
  });

  if (env.isProduction && !env.inngestConfigured) {
    logger.warn(
      "inngest_not_configured: set INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY to enable background jobs"
    );
  }

  connectDatabase();
});

// Errors after startup. (Startup errors are handled in the listen callback above.)
server.on("error", (error) => {
  logger.error("server_error", { error });
  process.exit(1);
});

// Render's proxy keeps connections open for up to 60 seconds.
// Node's default (5 seconds) would occasionally cause 502 errors.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

/* ---------------------------------------------------------
   GRACEFUL SHUTDOWN (Render sends SIGTERM on every deploy)
   --------------------------------------------------------- */

function shutdown(signal, exitCode = 0) {
  if (isShuttingDown()) return;

  // From now on /api/health answers 503, so no new traffic is routed here.
  beginShutdown();

  logger.info("shutdown_started", { signal });

  // Render waits about 30 seconds before it force-kills the process.
  const forceExit = setTimeout(() => {
    logger.error("shutdown_forced");
    process.exit(1);
  }, 25_000);
  forceExit.unref();

  // Give running AI streams a chance to finish, then cut what is left.
  const cutConnections = setTimeout(() => server.closeAllConnections(), 15_000);
  cutConnections.unref();

  server.close(async () => {
    await disconnectDatabase();
    clearTimeout(forceExit);
    logger.info("shutdown_complete", { exitCode });
    process.exit(exitCode);
  });

  server.closeIdleConnections();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// A rejected promise nobody handled: log it and keep serving.
// (Every database / AI / Inngest call in this project is awaited inside try/catch.)
process.on("unhandledRejection", (reason) => {
  logger.error("unhandled_rejection", { error: reason });
});

// The process state is unknown after this: finish what is running, then exit
// with code 1 so Render restarts the service.
process.on("uncaughtException", (error) => {
  logger.error("uncaught_exception", { error });
  shutdown("uncaughtException", 1);
});