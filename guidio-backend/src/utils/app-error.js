/**
 * An error whose message is safe to show to the user.
 * Messages of errors with a status below 500 are always returned as written.
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, { code, details } = {}) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details ?? null;
  }
}