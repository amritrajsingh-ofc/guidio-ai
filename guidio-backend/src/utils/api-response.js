export function sendSuccess(res, data = null, message = "Success", statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

export function sendError(
  res,
  message = "Something went wrong",
  statusCode = 500,
  errors = null,
  code = undefined
) {
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
    ...(code ? { code } : {}),
  });
}