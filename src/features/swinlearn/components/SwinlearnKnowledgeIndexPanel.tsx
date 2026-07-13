import {
  formatKnowledgeIndexStatus,
  hasIndexableCourseKnowledge,
  knowledgeIndexActionLabel,
} from '../lib/swinlearnKnowledgeIndex.mjs'
import type { SwinlearnKnowledgeIndexRow } from '../lib/workspace/types'

type SwinlearnKnowledgeIndexPanelProps = {
  assignmentCount?: number
  disabled?: boolean
  hasContentPackage?: boolean
  indexing?: boolean
  knowledgeIndex: SwinlearnKnowledgeIndexRow
  onIndex: () => void
  subtitle?: string
}

export function SwinlearnKnowledgeIndexPanel({
  assignmentCount = 0,
  disabled = false,
  hasContentPackage = false,
  indexing = false,
  knowledgeIndex,
  onIndex,
  subtitle = 'Re-index after changing deadlines, assignments, or imported course content so SWINLEARN answers stay current.',
}: SwinlearnKnowledgeIndexPanelProps) {
  const canIndex = hasIndexableCourseKnowledge({ assignmentCount, hasContentPackage })

  if (!canIndex) {
    return (
      <div className="workspace-empty-state">
        Import course content or publish assignments before indexing SWINLEARN knowledge.
      </div>
    )
  }

  return (
    <div className="swinlearn-knowledge-index-panel">
      <div className="workspace-section-heading">
        <div>
          <strong>SWINLEARN knowledge</strong>
          <p>{subtitle}</p>
        </div>
        <span
          className={`swinlearn-knowledge-index-status swinlearn-knowledge-index-status--${knowledgeIndex.status}`}
          title={knowledgeIndex.error_message ?? undefined}
        >
          {formatKnowledgeIndexStatus(knowledgeIndex.status)}
        </span>
      </div>
      <button
        type="button"
        className="swinlearn-knowledge-index-btn"
        onClick={onIndex}
        disabled={disabled || indexing}
      >
        {knowledgeIndexActionLabel(knowledgeIndex.status, indexing)}
      </button>
    </div>
  )
}
