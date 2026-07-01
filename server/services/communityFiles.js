import multer from 'multer'
import path from 'node:path'

import { httpError } from '../http.js'

export const communityMaxImageBytes = 5 * 1024 * 1024
export const communityMaxImagesPerPost = 4
export const communityMaxImagesPerComment = 4

const imageExtensions = new Set(['.gif', '.jpeg', '.jpg', '.png', '.webp'])
const documentExtensions = new Set(['.doc', '.docx', '.pdf', '.zip'])
const documentMimeTypes = new Set([
  'application/msword',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/x-zip-compressed',
  'application/zip',
])

export const communityUpload = multer({
  dest: 'uploads/community',
  limits: {
    fileSize: communityMaxImageBytes,
    files: communityMaxImagesPerPost,
  },
})

export const validateCommunityImage = (file) => {
  const extension = path.extname(String(file?.originalname ?? '')).toLowerCase()
  const mimetype = String(file?.mimetype ?? '').toLowerCase()
  const size = Number(file?.size ?? 0)

  if (!Number.isFinite(size) || size <= 0) {
    throw httpError(400, 'Uploaded image is empty.')
  }

  if (size > communityMaxImageBytes) {
    throw httpError(400, 'Each image must be 5 MB or smaller.')
  }

  if (!imageExtensions.has(extension) && !mimetype.startsWith('image/')) {
    throw httpError(400, 'Only PNG, JPG, GIF, and WebP images are supported.')
  }

  return {
    mimeType: mimetype || null,
    originalName: file.originalname || 'image.png',
    publicUrl: `/${String(file.path).replace(/\\/g, '/')}`,
    size,
    storedPath: String(file.path).replace(/\\/g, '/'),
  }
}

export const validateCommunityAttachment = (file) => {
  const extension = path.extname(String(file?.originalname ?? '')).toLowerCase()
  const mimetype = String(file?.mimetype ?? '').toLowerCase()
  const size = Number(file?.size ?? 0)

  if (!Number.isFinite(size) || size <= 0) {
    throw httpError(400, 'Uploaded file is empty.')
  }

  if (size > communityMaxImageBytes) {
    throw httpError(400, 'Each file must be 5 MB or smaller.')
  }

  const isImage = imageExtensions.has(extension) || mimetype.startsWith('image/')
  const isDocument = documentExtensions.has(extension) || documentMimeTypes.has(mimetype)

  if (!isImage && !isDocument) {
    throw httpError(400, 'Only images, PDF, Word, and ZIP files are supported.')
  }

  return {
    mimeType: mimetype || null,
    originalName: file.originalname || 'attachment',
    publicUrl: `/${String(file.path).replace(/\\/g, '/')}`,
    size,
    storedPath: String(file.path).replace(/\\/g, '/'),
  }
}

export const createCommunityPostImages = async (prisma, postId, files) => {
  const images = []

  for (const [index, file] of files.entries()) {
    const validated = validateCommunityImage(file)

    images.push(
      await prisma.communityPostImage.create({
        data: {
          mimeType: validated.mimeType,
          originalName: validated.originalName,
          postId,
          publicUrl: validated.publicUrl,
          size: validated.size,
          sortOrder: index,
          storedPath: validated.storedPath,
        },
      }),
    )
  }

  return images
}

export const createCommunityCommentImages = async (prisma, commentId, files) => {
  const images = []

  for (const [index, file] of files.entries()) {
    const validated = validateCommunityAttachment(file)

    images.push(
      await prisma.communityCommentImage.create({
        data: {
          commentId,
          mimeType: validated.mimeType,
          originalName: validated.originalName,
          publicUrl: validated.publicUrl,
          size: validated.size,
          sortOrder: index,
          storedPath: validated.storedPath,
        },
      }),
    )
  }

  return images
}
