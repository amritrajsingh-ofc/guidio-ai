/*
 * Tiny shared flag: "the server is shutting down".
 * server.js sets it on SIGTERM / SIGINT; the health endpoint reads it so that
 * Render stops sending traffic to an instance that is about to exit.
 */

let shuttingDown = false;

export function beginShutdown() {
  shuttingDown = true;
}

export function isShuttingDown() {
  return shuttingDown;
}