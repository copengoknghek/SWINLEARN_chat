import multer from 'multer'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { parseOfficeAsync } from 'officeparser'
import WordExtractor from 'word-extractor'

import { httpError } from '../http.js'
import { htmlToPlainText } from './courseContentImport.js'
import { defaultSwinlearnContextChars } from './swinlearnGroq.js'

export const defaultSwinlearnMaxFileBytes =
  Number(process.env.SWINLEARN_MAX_FILE_MB ?? 20) * 1024 * 1024

const documentExtensions = new Set([
  '.doc',
  '.docx',
  '.html',
  '.md',
  '.pdf',
  '.ppt',
  '.pptx',
  '.rtf',
  '.txt',
  '.xlsx',
])

const legacyWordExtensions = new Set(['.doc'])

const officeParserExtensions = new Set(['.docx', '.pdf', '.pptx', '.rtf', '.xlsx'])

const officeDocumentExtensions = new Set([
  ...legacyWordExtensions,
  ...officeParserExtensions,
  '.ppt',
])

const imageExtensions = new Set(['.gif', '.jpeg', '.jpg', '.png', '.webp'])

const documentMimeTypes = new Set([
  'application/msword',
  'application/pdf',
  'application/rtf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/html',
  'text/markdown',
  'text/plain',
])

const readableTextExtensions = new Set(['.html', '.md', '.txt'])
const readableTextMimeTypes = new Set(['text/html', 'text/markdown', 'text/plain'])

export const swinlearnUpload = multer({
  dest: 'uploads/swinlearn',
  limits: {
    fileSize: defaultSwinlearnMaxFileBytes,
    files: 5,
  },
})

export function validateSwinlearnUpload(file, { maxBytes = defaultSwinlearnMaxFileBytes } = {}) {
  const extension = path.extname(String(file?.originalname ?? '')).toLowerCase()
  const mimetype = String(file?.mimetype ?? '').toLowerCase()
  const size = Number(file?.size ?? 0)

  if (!Number.isFinite(size) || size <= 0) {
    throw httpError(400, 'Uploaded file is empty.')
  }

  if (size > maxBytes) {
    throw httpError(400, `Uploaded file is too large. Maximum size is ${Math.floor(maxBytes / 1024 / 1024)} MB.`)
  }

  if (documentExtensions.has(extension) || (!extension && documentMimeTypes.has(mimetype))) {
    const readableAsText =
      readableTextExtensions.has(extension) ||
      readableTextMimeTypes.has(mimetype) ||
      officeDocumentExtensions.has(extension)

    return {
      kind: 'document',
      readableAsText,
      supportedByFileSearch: readableAsText,
    }
  }

  if (imageExtensions.has(extension) || mimetype.startsWith('image/')) {
    return {
      kind: 'image',
      readableAsText: false,
      supportedByFileSearch: false,
    }
  }

  throw httpError(400, 'Unsupported SWINLEARN upload type.')
}

export async function parseStudyDocumentFile(
  filePath,
  extension,
  {
    parseLegacyDoc = parseLegacyWordDocument,
    parseOffice = parseOfficeAsync,
    readBytes = readFile,
  } = {},
) {
  const normalizedExtension = String(extension ?? '').toLowerCase()

  if (legacyWordExtensions.has(normalizedExtension)) {
    return parseLegacyDoc(filePath)
  }

  if (normalizedExtension === '.ppt') {
    throw httpError(
      400,
      'Legacy PowerPoint (.ppt) is not supported. Save the file as .pptx and upload again.',
    )
  }

  if (officeParserExtensions.has(normalizedExtension)) {
    const buffer = await readBytes(filePath)
    return String(await parseOffice(buffer)).trim()
  }

  return ''
}

export async function parseLegacyWordDocument(filePath, { extractor = new WordExtractor() } = {}) {
  const document = await extractor.extract(filePath)

  return String(document.getBody() ?? '').trim()
}

export async function extractUploadText(
  file,
  validation,
  {
    maxChars = defaultSwinlearnContextChars,
    parseOffice = parseOfficeAsync,
    parseStudyDocument = parseStudyDocumentFile,
  } = {},
) {
  if (!validation?.readableAsText) {
    return ''
  }

  const extension = path.extname(String(file.originalname ?? '')).toLowerCase()
  const mimetype = String(file.mimetype ?? '').toLowerCase()
  let plainText = ''

  if (officeDocumentExtensions.has(extension)) {
    plainText = await parseStudyDocument(file.path, extension, { parseOffice })
  } else {
    const rawText = await readFile(file.path, 'utf8')
    plainText =
      extension === '.html' || mimetype === 'text/html' ? htmlToPlainText(rawText) : rawText
  }

  return String(plainText ?? '').trim().slice(0, maxChars)
}

export async function readSwinlearnUploadText(file, validation, options = {}) {
  return extractUploadText(file, validation, options)
}
