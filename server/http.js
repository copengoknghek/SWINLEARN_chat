export function asyncHandler(handler) {
  return async (request, response, next) => {
    try {
      await handler(request, response, next)
    } catch (error) {
      next(error)
    }
  }
}

export function httpError(statusCode, message) {
  const error = new Error(message)
  error.statusCode = statusCode

  return error
}

export function resolveHttpError(error) {
  if (error && typeof error === 'object' && Number.isInteger(error.statusCode)) {
    return {
      statusCode: error.statusCode,
      message: error.message || 'Request failed',
    }
  }

  if (error && typeof error === 'object' && error.code === 'P2002') {
    return {
      statusCode: 409,
      message: 'A record with this value already exists.',
    }
  }

  if (error && typeof error === 'object' && error.code === 'P2025') {
    return {
      statusCode: 404,
      message: 'Record not found.',
    }
  }

  if (error && typeof error === 'object' && error.code === 'P2003') {
    return {
      statusCode: 400,
      message: 'Related record could not be found.',
    }
  }

  return {
    statusCode: 500,
    message: error instanceof Error ? error.message : 'Something went wrong',
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
    throw httpError(400, `${fieldName} is required.`)
  }

  return value.trim()
}
