export const formatKnowledgeIndexStatus = (status) => {
  switch (status) {
    case 'ready':
      return 'Indexed'
    case 'indexing':
      return 'Indexing...'
    case 'stale':
      return 'Needs re-index'
    case 'error':
    case 'failed':
      return 'Index error'
    case 'missing':
      return 'Not indexed'
    default:
      return status
  }
}

export const needsKnowledgeIndexing = (status) =>
  ['missing', 'stale', 'error', 'failed'].includes(status)

export const hasIndexableCourseKnowledge = ({ hasContentPackage = false, assignmentCount = 0 } = {}) =>
  hasContentPackage || assignmentCount > 0

export const knowledgeIndexActionLabel = (status, indexing = false) => {
  const reindex = status === 'ready'

  if (indexing) {
    return reindex ? 'Re-indexing course knowledge...' : 'Indexing course knowledge...'
  }

  return reindex ? 'Re-index course knowledge' : 'Index course knowledge'
}
