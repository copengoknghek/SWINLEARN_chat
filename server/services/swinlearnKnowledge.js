import { htmlToPlainText } from './courseContentImport.js'
import { defaultSwinlearnContextChars } from './swinlearnGroq.js'

export function normalizeSelectedOfferingIds(selectedOfferingIds, enrolledOfferingIds) {
  const enrolled = new Set(enrolledOfferingIds)
  const requested = Array.isArray(selectedOfferingIds)
    ? [...new Set(selectedOfferingIds.map((id) => String(id)).filter(Boolean))]
    : []
  const normalized = requested.filter((id) => enrolled.has(id))

  return normalized.length > 0 ? normalized : [...enrolledOfferingIds]
}

export function indexStatusForPackage(index, currentPackageId, { requireVectors = false } = {}) {
  if (!index) {
    return 'missing'
  }

  if (index.packageId !== currentPackageId || index.status === 'stale') {
    return 'stale'
  }

  if (requireVectors && index.status === 'ready' && !index.vectorStoreId) {
    return 'stale'
  }

  return index.status
}

const courseLabel = (offering) =>
  `${offering.course.code} - ${offering.course.title}`

const formatTerm = (offering) =>
  `${String(offering.term ?? '').replace('_', ' ')} ${offering.academicYear}`

const itemType = (item) => item.itemType ?? item.item_type ?? 'item'

const looksLikeAssignmentItem = (item) => {
  const type = String(itemType(item)).toLowerCase()
  const title = String(item.title ?? '')

  return type.includes('assignment') || /\bassignment\b/i.test(title) || /^a\d+\b/i.test(title)
}

export function collectAssignmentsFromOffering(offering) {
  const contentPackage = offering.contentPackages?.[0] ?? null
  const entries = []
  const seen = new Set()

  const addEntry = (entry) => {
    const key = `${entry.source}:${entry.title}`

    if (seen.has(key)) {
      return
    }

    seen.add(key)
    entries.push(entry)
  }

  for (const assignment of offering.assignments ?? []) {
    addEntry({
      dueAt: assignment.dueAt ?? assignment.due_at ?? null,
      points: assignment.pointsPossible ?? assignment.points_possible ?? null,
      source: 'workspace',
      title: assignment.title,
    })
  }

  for (const module of contentPackage?.modules ?? []) {
    for (const item of module.items ?? []) {
      if (!looksLikeAssignmentItem(item)) {
        continue
      }

      addEntry({
        moduleTitle: module.title,
        source: 'package',
        title: item.title,
      })
    }
  }

  return entries
}

export function buildAssignmentsIndexDocument(offering) {
  const label = courseLabel(offering)
  const code = offering.course.code
  const assignments = collectAssignmentsFromOffering(offering)
  const lines = [`Course: ${label}`, 'Assignments index:']

  if (assignments.length === 0) {
    lines.push('No assignments are listed in the available knowledge for this course.')
  } else {
    for (const [index, assignment] of assignments.entries()) {
      const details = [assignment.title]

      if (assignment.moduleTitle) {
        details.push(`module: ${assignment.moduleTitle}`)
      }

      if (assignment.dueAt) {
        details.push(`due: ${new Date(assignment.dueAt).toISOString()}`)
      }

      lines.push(`${index + 1}. ${details.join(' | ')}`)
    }
  }

  return {
    courseCode: code,
    id: `assignments:${offering.id}`,
    offeringId: offering.id,
    source: 'course',
    text: lines.join('\n'),
    title: `${label} / Assignments index`,
  }
}

export function buildCourseKnowledgeDocument({ assignments = [], contentPackage = null, offering }) {
  const lines = [
    `# ${courseLabel(offering)}`,
    '',
    `Term: ${formatTerm(offering)}`,
    `Description: ${offering.course.description || 'No description provided.'}`,
  ]

  if (!contentPackage) {
    lines.push(
      '',
      'No imported course knowledge package is available yet.',
      'Only catalog metadata is available. Do not infer modules, lecture topics, readings, or files that are not explicitly listed here.',
    )
  } else {
    lines.push('', `Imported package: ${contentPackage.sourceTitle ?? contentPackage.source_title ?? 'Course content'}`)
    for (const module of contentPackage.modules ?? []) {
      lines.push('', `## Module: ${module.title}`)
      for (const item of module.items ?? []) {
        const plainText = htmlToPlainText(item.contentHtml ?? item.content_html ?? '')
        lines.push('', `### ${item.title} (${itemType(item)})`)
        if (plainText) {
          lines.push(plainText)
        }
        const asset = item.asset
        if (asset) {
          lines.push(`File: ${asset.title} (${asset.publicUrl ?? asset.public_url ?? ''})`)
        }
      }
    }

    if ((contentPackage.assets ?? []).length > 0) {
      lines.push('', '## Course files')
      for (const asset of contentPackage.assets) {
        const publicUrl = asset.publicUrl ?? asset.public_url ?? ''
        lines.push(`- ${asset.title}${publicUrl ? `: ${publicUrl}` : ''}`)
      }
    }
  }

  if (assignments.length > 0) {
    lines.push('', '## Assignments')
    for (const assignment of assignments) {
      const plainText = htmlToPlainText(assignment.contentHtml ?? assignment.content_html ?? assignment.description ?? '')
      const dueAt = assignment.dueAt ?? assignment.due_at
      const points = assignment.pointsPossible ?? assignment.points_possible
      lines.push('', `### ${assignment.title}`)
      if (dueAt) {
        lines.push(`Due: ${new Date(dueAt).toISOString()}`)
      }
      if (points !== null && points !== undefined) {
        lines.push(`Points: ${points}`)
      }
      if (plainText) {
        lines.push(plainText)
      }
    }
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

export function buildSwinlearnKnowledgeDocuments({
  maxChars = defaultSwinlearnContextChars,
  offerings = [],
} = {}) {
  const documents = []
  let remainingChars = Number.isFinite(maxChars) && maxChars > 0 ? maxChars : defaultSwinlearnContextChars

  for (const offering of offerings) {
    if (remainingChars <= 0) {
      break
    }

    const contentPackage = offering.contentPackages?.[0] ?? null
    const text = buildCourseKnowledgeDocument({
      assignments: offering.assignments ?? [],
      contentPackage,
      offering,
    })
    const clippedText = text.slice(0, remainingChars)

    documents.push({
      courseCode: offering.course.code,
      id: `course:${offering.id}`,
      offeringId: offering.id,
      source: 'course',
      text: clippedText,
      title: courseLabel(offering),
    })
    remainingChars -= clippedText.length
  }

  return documents
}

export async function loadSwinlearnContext(prisma, studentId) {
  const offerings = await prisma.courseOffering.findMany({
    where: {
      enrollments: {
        some: { userId: studentId },
      },
    },
    include: {
      course: true,
      contentPackages: {
        where: { scope: 'offering' },
        include: {
          _count: {
            select: {
              assets: true,
              items: true,
              modules: true,
            },
          },
        },
        orderBy: { importedAt: 'desc' },
        take: 1,
      },
      swinlearnKnowledgeIndex: true,
    },
    orderBy: [{ academicYear: 'desc' }, { term: 'asc' }],
  })

  return offerings
}

export async function loadOfferingKnowledge(prisma, offeringId) {
  return prisma.courseOffering.findUnique({
    where: { id: offeringId },
    include: {
      course: true,
      contentPackages: {
        where: { scope: 'offering' },
        include: {
          assets: {
            orderBy: { title: 'asc' },
          },
          modules: {
            orderBy: { position: 'asc' },
            include: {
              items: {
                orderBy: { position: 'asc' },
                include: { asset: true },
              },
            },
          },
        },
        orderBy: { importedAt: 'desc' },
        take: 1,
      },
      assignments: {
        orderBy: { dueAt: 'asc' },
      },
      swinlearnKnowledgeIndex: true,
    },
  })
}

export async function loadSwinlearnKnowledgeDocuments({
  maxChars = defaultSwinlearnContextChars,
  offeringIds,
  prisma,
}) {
  const offerings = []

  for (const offeringId of offeringIds) {
    const offering = await loadOfferingKnowledge(prisma, offeringId)

    if (offering) {
      offerings.push(offering)
    }
  }

  return buildSwinlearnKnowledgeDocuments({ maxChars, offerings })
}

export async function ensureSwinlearnKnowledgeIndex({ offeringId, prisma }) {
  const offering = await loadOfferingKnowledge(prisma, offeringId)

  if (!offering) {
    return null
  }

  const contentPackage = offering.contentPackages[0] ?? null
  const currentPackageId = contentPackage?.id ?? null
  const existing = offering.swinlearnKnowledgeIndex
  const status = indexStatusForPackage(existing, currentPackageId)

  if (status === 'ready') {
    return existing
  }

  return prisma.swinlearnKnowledgeIndex.upsert({
    where: { offeringId },
    update: {
      errorMessage: null,
      indexedAt: new Date(),
      packageId: currentPackageId,
      status: 'ready',
      vectorStoreId: null,
    },
    create: {
      indexedAt: new Date(),
      offeringId,
      packageId: currentPackageId,
      status: 'ready',
      vectorStoreId: null,
    },
  })
}

export async function markSwinlearnIndexesStaleForOffering(transaction, offeringId) {
  await transaction.swinlearnKnowledgeIndex.updateMany({
    where: { offeringId },
    data: {
      status: 'stale',
      updatedAt: new Date(),
    },
  })
}
