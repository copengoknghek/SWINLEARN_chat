import crypto from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { inflateRawSync } from 'node:zlib'

import { httpError } from '../http.js'
import { markSwinlearnIndexesStaleForOffering } from './swinlearnKnowledge.js'

const courseDataPattern = /window\.COURSE_DATA\s*=\s*/
const localFileMarker = 'viewer/files/'
const unsafeAssetPattern = /(^|\/)\.\.(\/|$)/
const blockedHtmlTags = [
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'option',
  'link',
  'meta',
]

const assignmentType = 'Assignment'

function safeDecodeUri(value) {
  try {
    return decodeURIComponent(value)
  } catch (_error) {
    return value
  }
}

function safeZipEntryName(buffer, generalPurposeFlag) {
  const encoding = (generalPurposeFlag & 0x0800) === 0x0800 ? 'utf8' : 'utf8'

  return buffer.toString(encoding).replace(/\\/g, '/')
}

function findEndOfCentralDirectory(buffer) {
  const signature = 0x06054b50
  const maxSearch = Math.max(0, buffer.length - 65_557)

  for (let offset = buffer.length - 22; offset >= maxSearch; offset -= 1) {
    if (buffer.readUInt32LE(offset) === signature) {
      return offset
    }
  }

  throw httpError(400, 'ZIP file is invalid.')
}

function readZipDirectory(buffer) {
  const endOffset = findEndOfCentralDirectory(buffer)
  const totalEntries = buffer.readUInt16LE(endOffset + 10)
  const centralDirectoryOffset = buffer.readUInt32LE(endOffset + 16)
  const entries = []
  let offset = centralDirectoryOffset

  for (let index = 0; index < totalEntries; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw httpError(400, 'ZIP central directory is invalid.')
    }

    const generalPurposeFlag = buffer.readUInt16LE(offset + 8)
    const compressionMethod = buffer.readUInt16LE(offset + 10)
    const compressedSize = buffer.readUInt32LE(offset + 20)
    const uncompressedSize = buffer.readUInt32LE(offset + 24)
    const fileNameLength = buffer.readUInt16LE(offset + 28)
    const extraLength = buffer.readUInt16LE(offset + 30)
    const commentLength = buffer.readUInt16LE(offset + 32)
    const localHeaderOffset = buffer.readUInt32LE(offset + 42)
    const fileName = safeZipEntryName(
      buffer.subarray(offset + 46, offset + 46 + fileNameLength),
      generalPurposeFlag,
    )

    entries.push({
      compressedSize,
      compressionMethod,
      fileName,
      generalPurposeFlag,
      isDirectory: fileName.endsWith('/'),
      localHeaderOffset,
      uncompressedSize,
    })

    offset += 46 + fileNameLength + extraLength + commentLength
  }

  return entries
}

function readZipEntryData(buffer, entry) {
  const offset = entry.localHeaderOffset

  if (buffer.readUInt32LE(offset) !== 0x04034b50) {
    throw httpError(400, `ZIP local header is invalid for ${entry.fileName}.`)
  }

  if ((entry.generalPurposeFlag & 0x0001) === 0x0001) {
    throw httpError(400, 'Password-protected ZIP files are not supported.')
  }

  const fileNameLength = buffer.readUInt16LE(offset + 26)
  const extraLength = buffer.readUInt16LE(offset + 28)
  const dataStart = offset + 30 + fileNameLength + extraLength
  const compressed = buffer.subarray(dataStart, dataStart + entry.compressedSize)

  if (entry.compressionMethod === 0) {
    return compressed
  }

  if (entry.compressionMethod === 8) {
    return inflateRawSync(compressed)
  }

  throw httpError(400, `Unsupported ZIP compression method ${entry.compressionMethod}.`)
}

async function readZipArchive(zipPath) {
  const buffer = await readFile(zipPath)
  const entries = readZipDirectory(buffer)

  return { buffer, entries }
}

export function parseCanvasCourseDataScript(script) {
  const jsonText = String(script).replace(courseDataPattern, '').trim().replace(/;$/, '')

  return JSON.parse(jsonText)
}

export async function readCanvasCourseDataFromZip(zipPath) {
  const archive = await readZipArchive(zipPath)
  const entry = archive.entries.find(
    (candidate) =>
      !candidate.isDirectory &&
      (candidate.fileName === 'viewer/course-data.js' ||
        candidate.fileName.endsWith('/viewer/course-data.js')),
  )

  if (!entry) {
    throw httpError(400, 'The ZIP does not include viewer/course-data.js.')
  }

  return parseCanvasCourseDataScript(readZipEntryData(archive.buffer, entry).toString('utf8'))
}

export function toSafeAssetRelativePath(sourcePath) {
  const normalizedSource = String(sourcePath).replace(/\\/g, '/')
  const markerIndex = normalizedSource.indexOf(localFileMarker)
  const rawRelativePath =
    markerIndex >= 0
      ? normalizedSource.slice(markerIndex + localFileMarker.length)
      : normalizedSource
  const decodedRelativePath = safeDecodeUri(rawRelativePath)
  const normalizedRelativePath = path.posix.normalize(decodedRelativePath)

  if (
    normalizedRelativePath === '.' ||
    normalizedRelativePath.startsWith('/') ||
    unsafeAssetPattern.test(normalizedRelativePath)
  ) {
    throw httpError(400, `Unsafe asset path: ${sourcePath}`)
  }

  return normalizedRelativePath
}

function encodePublicPath(relativePath) {
  return relativePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

function normalizeViewerFileUrl(value) {
  const [pathPart] = String(value).split(/[?#]/)
  const normalizedPath = pathPart.replace(/^\/+/, '').replace(/\\/g, '/')
  const markerIndex = normalizedPath.indexOf(localFileMarker)

  if (markerIndex < 0) {
    return null
  }

  const safeRelativePath = toSafeAssetRelativePath(normalizedPath.slice(markerIndex))

  return `${localFileMarker}${safeRelativePath}`
}

export function rewriteCourseContentHtml(html, assetUrlByViewerPath) {
  return String(html ?? '').replace(
    /\s(src|href)=("([^"]*)"|'([^']*)')/gi,
    (match, attributeName, quotedValue, doubleQuotedValue, singleQuotedValue) => {
      const value = doubleQuotedValue ?? singleQuotedValue ?? ''
      const normalizedViewerPath = normalizeViewerFileUrl(value)

      if (!normalizedViewerPath) {
        return match
      }

      const rewrittenUrl = assetUrlByViewerPath.get(normalizedViewerPath)

      if (!rewrittenUrl) {
        return match
      }

      const quote = quotedValue.startsWith("'") ? "'" : '"'

      return ` ${attributeName}=${quote}${rewrittenUrl}${quote}`
    },
  )
}

function sanitizeUrlAttributes(html) {
  return html.replace(
    /\s(src|href)=("([^"]*)"|'([^']*)')/gi,
    (match, attributeName, quotedValue, doubleQuotedValue, singleQuotedValue) => {
      const value = String(doubleQuotedValue ?? singleQuotedValue ?? '').trim()
      const lowerValue = value.replace(/\s/g, '').toLowerCase()

      if (
        lowerValue.startsWith('javascript:') ||
        lowerValue.startsWith('vbscript:') ||
        lowerValue.startsWith('data:')
      ) {
        return ''
      }

      const quote = quotedValue.startsWith("'") ? "'" : '"'

      return ` ${attributeName.toLowerCase()}=${quote}${value}${quote}`
    },
  )
}

export function sanitizeRichHtml(html) {
  let sanitized = String(html ?? '')

  for (const tagName of blockedHtmlTags) {
    sanitized = sanitized.replace(
      new RegExp(`<\\s*${tagName}\\b[^>]*>[\\s\\S]*?<\\s*\\/\\s*${tagName}\\s*>`, 'gi'),
      '',
    )
    sanitized = sanitized.replace(new RegExp(`<\\s*${tagName}\\b[^>]*\\/?>`, 'gi'), '')
  }

  sanitized = sanitized
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\ssrcdoc\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')

  return sanitizeUrlAttributes(sanitized)
}

export function htmlToPlainText(html) {
  return String(html ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function toDateOrNull(value) {
  if (!value) {
    return null
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? null : date
}

function moduleItemType(item) {
  if (item?.type === 'WikiPage') {
    return 'wiki_page'
  }

  if (item?.type === 'Quizzes::Quiz') {
    return 'quiz'
  }

  if (item?.type === 'Attachment') {
    return 'attachment'
  }

  if (item?.type === 'ContextModuleSubHeader') {
    return 'sub_header'
  }

  if (item?.type === assignmentType) {
    return 'assignment'
  }

  return 'unknown'
}

function collectAssignmentSources(courseData) {
  const assignmentByExportId = new Map()

  for (const assignment of courseData.assignments ?? []) {
    if (assignment?.exportId) {
      assignmentByExportId.set(assignment.exportId, assignment)
    }
  }

  for (const module of courseData.modules ?? []) {
    for (const item of module.items ?? []) {
      if (item?.type === assignmentType && item.exportId && !assignmentByExportId.has(item.exportId)) {
        assignmentByExportId.set(item.exportId, item)
      }
    }
  }

  return assignmentByExportId
}

function normalizedAssignmentSource(courseData, item) {
  const assignmentByExportId = collectAssignmentSources(courseData)

  return assignmentByExportId.get(item.exportId) ?? item
}

function buildAssetLookup(assets) {
  const lookup = new Map()

  for (const asset of assets) {
    lookup.set(`${localFileMarker}${asset.relativePath}`, asset.publicUrl)
  }

  return lookup
}

function normalizeContentHtml(content, assetUrlByViewerPath) {
  return sanitizeRichHtml(rewriteCourseContentHtml(content ?? '', assetUrlByViewerPath))
}

async function copyAssetEntries({ archive, baseDir, importId, offeringId }) {
  const root = path.resolve(baseDir, 'uploads', 'course-content', offeringId, importId)
  const assets = []

  await rm(root, { force: true, recursive: true })

  for (const entry of archive.entries) {
    const isViewerFile =
      entry.fileName.startsWith(localFileMarker) || entry.fileName.includes(`/${localFileMarker}`)

    if (entry.isDirectory || !isViewerFile) {
      continue
    }

    const relativePath = toSafeAssetRelativePath(entry.fileName)
    const targetPath = path.resolve(root, relativePath)

    if (!targetPath.startsWith(root)) {
      throw httpError(400, `Unsafe asset path: ${entry.fileName}`)
    }

    await mkdir(path.dirname(targetPath), { recursive: true })
    await writeFile(targetPath, readZipEntryData(archive.buffer, entry))

    assets.push({
      fileType: 'file',
      mimeType: null,
      publicUrl: `/uploads/course-content/${encodeURIComponent(offeringId)}/${encodeURIComponent(importId)}/${encodePublicPath(relativePath)}`,
      relativePath,
      size: entry.uncompressedSize,
      sourcePath: `${localFileMarker}${relativePath}`,
      storedPath: path.posix.join('uploads/course-content', offeringId, importId, relativePath),
      title: path.posix.basename(relativePath),
    })
  }

  return assets
}

function normalizeCanvasCourseData(courseData, assets) {
  const assetUrlByViewerPath = buildAssetLookup(assets)
  const assignmentSources = collectAssignmentSources(courseData)
  const modules = (courseData.modules ?? []).map((module, moduleIndex) => ({
    items: (module.items ?? []).map((item, itemIndex) => {
      const assignmentSource =
        item.type === assignmentType ? normalizedAssignmentSource(courseData, item) : null

      return {
        completed: Boolean(item.completed),
        contentHtml: normalizeContentHtml(assignmentSource?.content ?? item.content ?? '', assetUrlByViewerPath),
        indent: Number(item.indent ?? 0),
        itemType: moduleItemType(item),
        locked: Boolean(item.locked),
        position: itemIndex,
        sourceExportId: item.exportId ? String(item.exportId) : null,
        sourceId: item.id === undefined || item.id === null ? null : String(item.id),
        title: String(item.title ?? 'Untitled item').trim() || 'Untitled item',
      }
    }),
    position: moduleIndex,
    sequential: Boolean(module.sequential),
    sourceExportId: module.exportId ? String(module.exportId) : null,
    sourceId: module.id === undefined || module.id === null ? null : String(module.id),
    status: module.status ? String(module.status) : null,
    title: String(module.name ?? `Module ${moduleIndex + 1}`).trim() || `Module ${moduleIndex + 1}`,
    unlockAt: toDateOrNull(module.unlockDate),
  }))
  const assignments = [...assignmentSources.values()].map((assignment) => {
    const contentHtml = normalizeContentHtml(assignment.content ?? '', assetUrlByViewerPath)

    return {
      contentHtml,
      description: htmlToPlainText(contentHtml).slice(0, 1200),
      dueAt: toDateOrNull(assignment.dueAt),
      graded: Boolean(assignment.graded),
      lockAt: toDateOrNull(assignment.lockAt),
      pointsPossible:
        assignment.pointsPossible === null || assignment.pointsPossible === undefined
          ? null
          : Number(assignment.pointsPossible),
      sourceExportId: assignment.exportId ? String(assignment.exportId) : null,
      submissionTypes: assignment.submissionTypes ? String(assignment.submissionTypes) : null,
      title: String(assignment.title ?? 'Untitled assignment').trim() || 'Untitled assignment',
      unlockAt: toDateOrNull(assignment.unlockAt),
    }
  })

  return {
    assets,
    assignments,
    language: courseData.language ? String(courseData.language) : null,
    modules,
    sourceLastDownload: toDateOrNull(courseData.lastDownload),
    sourceTitle: String(courseData.title ?? 'Imported course content').trim() || 'Imported course content',
  }
}

export async function prepareCanvasCourseImport({
  baseDir = process.cwd(),
  importId = crypto.randomUUID(),
  offeringId,
  zipPath,
}) {
  const archive = await readZipArchive(zipPath)
  const courseDataEntry = archive.entries.find(
    (entry) =>
      !entry.isDirectory &&
      (entry.fileName === 'viewer/course-data.js' || entry.fileName.endsWith('/viewer/course-data.js')),
  )

  if (!courseDataEntry) {
    throw httpError(400, 'The ZIP does not include viewer/course-data.js.')
  }

  const courseData = parseCanvasCourseDataScript(
    readZipEntryData(archive.buffer, courseDataEntry).toString('utf8'),
  )
  const assets = await copyAssetEntries({
    archive,
    baseDir,
    importId,
    offeringId,
  })

  return {
    ...normalizeCanvasCourseData(courseData, assets),
    importId,
  }
}

async function createPackageRecords(transaction, packageInput, prepared, assignmentByExportId) {
  const coursePackage = await transaction.courseContentPackage.create({
    data: packageInput,
  })
  const assetBySourcePath = new Map()

  for (const asset of prepared.assets) {
    const row = await transaction.courseContentAsset.create({
      data: {
        fileType: asset.fileType,
        mimeType: asset.mimeType,
        packageId: coursePackage.id,
        publicUrl: asset.publicUrl,
        size: asset.size,
        sourcePath: asset.sourcePath,
        storedPath: asset.storedPath,
        title: asset.title,
      },
    })

    assetBySourcePath.set(asset.sourcePath, row)
  }

  for (const module of prepared.modules) {
    const moduleRow = await transaction.courseContentModule.create({
      data: {
        packageId: coursePackage.id,
        position: module.position,
        sequential: module.sequential,
        sourceExportId: module.sourceExportId,
        sourceId: module.sourceId,
        status: module.status,
        title: module.title,
        unlockAt: module.unlockAt,
      },
    })

    for (const item of module.items) {
      const asset = item.itemType === 'attachment' ? assetBySourcePath.get(item.sourceExportId) : null
      const assignment =
        item.itemType === 'assignment' && item.sourceExportId
          ? assignmentByExportId.get(item.sourceExportId)
          : null

      await transaction.courseContentItem.create({
        data: {
          assetId: asset?.id ?? null,
          assignmentId: assignment?.id ?? null,
          completed: item.completed,
          contentHtml: item.contentHtml,
          indent: item.indent,
          itemType: item.itemType,
          locked: item.locked,
          moduleId: moduleRow.id,
          packageId: coursePackage.id,
          position: item.position,
          sourceExportId: item.sourceExportId,
          sourceId: item.sourceId,
          title: item.title,
        },
      })
    }
  }

  return coursePackage
}

async function upsertImportedAssignments(transaction, offeringId, prepared) {
  const assignmentByExportId = new Map()

  for (const assignment of prepared.assignments) {
    if (!assignment.sourceExportId) {
      continue
    }

    const existing = await transaction.assignment.findFirst({
      where: {
        offeringId,
        sourceExportId: assignment.sourceExportId,
      },
    })
    const dueAt = existing?.dueAt ?? assignment.dueAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const data = {
      contentHtml: assignment.contentHtml,
      description: assignment.description,
      lockAt: assignment.lockAt,
      pointsPossible: assignment.pointsPossible,
      sourceExportId: assignment.sourceExportId,
      submissionTypes: assignment.submissionTypes,
      title: assignment.title,
      unlockAt: assignment.unlockAt,
    }
    const row = existing
      ? await transaction.assignment.update({
          where: { id: existing.id },
          data,
        })
      : await transaction.assignment.create({
          data: {
            ...data,
            createdById: null,
            dueAt,
            offeringId,
            status: 'published',
          },
        })

    assignmentByExportId.set(assignment.sourceExportId, row)
  }

  return assignmentByExportId
}

export async function importCanvasCourseContent(prisma, {
  adminId,
  baseDir = process.cwd(),
  offering,
  originalFileName,
  zipPath,
}) {
  const prepared = await prepareCanvasCourseImport({
    baseDir,
    offeringId: offering.id,
    zipPath,
  })

  return prisma.$transaction(async (transaction) => {
    await markSwinlearnIndexesStaleForOffering(transaction, offering.id)
    await transaction.courseContentPackage.deleteMany({
      where: {
        OR: [
          { courseId: offering.courseId, scope: 'template' },
          { offeringId: offering.id, scope: 'offering' },
        ],
      },
    })

    const assignmentByExportId = await upsertImportedAssignments(transaction, offering.id, prepared)
    await createPackageRecords(
      transaction,
      {
        courseId: offering.courseId,
        importedById: adminId,
        importId: prepared.importId,
        language: prepared.language,
        offeringId: null,
        originalFileName,
        scope: 'template',
        sourceLastDownload: prepared.sourceLastDownload,
        sourceTitle: prepared.sourceTitle,
      },
      prepared,
      new Map(),
    )
    const offeringPackage = await createPackageRecords(
      transaction,
      {
        courseId: offering.courseId,
        importedById: adminId,
        importId: prepared.importId,
        language: prepared.language,
        offeringId: offering.id,
        originalFileName,
        scope: 'offering',
        sourceLastDownload: prepared.sourceLastDownload,
        sourceTitle: prepared.sourceTitle,
      },
      prepared,
      assignmentByExportId,
    )

    return {
      asset_count: prepared.assets.length,
      id: offeringPackage.id,
      import_id: prepared.importId,
      item_count: prepared.modules.reduce((count, module) => count + module.items.length, 0),
      module_count: prepared.modules.length,
      source_title: prepared.sourceTitle,
    }
  })
}
