export function asyncHandler(handler) {
  return async (request, response, next) => {
    try {
      await handler(request, response, next)
    } catch (error) {
      next(error)
    }
  }
}

export function sendError(response, statusCode, message) {
  response.status(statusCode).json({
    error: message,
  })
}

export function requireBodyString(body, fieldName) {
  const value = body[fieldName]

  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${fieldName} is required.`)
  }

  return value.trim()
}
