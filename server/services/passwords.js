import crypto from 'node:crypto'

const keyLength = 64

export function generateTemporaryPassword() {
  return `Swin${crypto.randomBytes(4).toString('hex')}!`
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const key = crypto.scryptSync(password, salt, keyLength).toString('hex')

  return `scrypt$${salt}$${key}`
}

export function verifyPassword(password, storedHash) {
  const [algorithm, salt, expectedKey] = storedHash.split('$')

  if (algorithm !== 'scrypt' || !salt || !expectedKey) {
    return false
  }

  const key = crypto.scryptSync(password, salt, keyLength)
  const expected = Buffer.from(expectedKey, 'hex')

  return expected.length === key.length && crypto.timingSafeEqual(expected, key)
}
