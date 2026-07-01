import fs from 'node:fs/promises'
import multer from 'multer'
import path from 'node:path'

import { httpError } from '../http.js'

export const profileAvatarMaxBytes = 2 * 1024 * 1024

const imageExtensions = new Set(['.gif', '.jpeg', '.jpg', '.png', '.webp'])

export const profileAvatarUpload = multer({
  dest: 'uploads/avatars',
  limits: {
    fileSize: profileAvatarMaxBytes,
    files: 1,
  },
})

export const validateProfileAvatar = (file) => {
  const extension = path.extname(String(file?.originalname ?? '')).toLowerCase()
  const mimetype = String(file?.mimetype ?? '').toLowerCase()
  const size = Number(file?.size ?? 0)

  if (!Number.isFinite(size) || size <= 0) {
    throw httpError(400, 'Uploaded image is empty.')
  }

  if (size > profileAvatarMaxBytes) {
    throw httpError(400, 'Profile image must be 2 MB or smaller.')
  }

  if (!imageExtensions.has(extension) && !mimetype.startsWith('image/')) {
    throw httpError(400, 'Only PNG, JPG, GIF, and WebP images are supported.')
  }

  return {
    publicUrl: `/${String(file.path).replace(/\\/g, '/')}`,
    storedPath: String(file.path).replace(/\\/g, '/'),
  }
}

export const removeStoredAvatar = async (publicUrl) => {
  if (!publicUrl?.startsWith('/uploads/avatars/')) {
    return
  }

  try {
    await fs.unlink(publicUrl.slice(1))
  } catch (_error) {
    // Ignore missing files from prior uploads.
  }
}
