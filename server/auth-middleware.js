import { getSessionUser } from './services/session.js'
import { sendError } from './http.js'

export async function attachUser(request, _response, next) {
  request.currentUser = await getSessionUser(request)
  next()
}

export function requireAuth(request, response) {
  if (!request.currentUser) {
    sendError(response, 401, 'You must be signed in.')
    return null
  }

  return request.currentUser
}

export function requireRole(request, response, allowedRoles) {
  const user = requireAuth(request, response)

  if (!user) {
    return null
  }

  if (!allowedRoles.includes(user.role)) {
    sendError(response, 403, 'You do not have permission to use this endpoint.')
    return null
  }

  return user
}
