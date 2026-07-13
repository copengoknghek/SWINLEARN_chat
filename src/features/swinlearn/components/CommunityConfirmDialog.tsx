type CommunityConfirmDialogProps = {
  confirmLabel?: string
  message: string
  onCancel: () => void
  onConfirm: () => void
  saving?: boolean
  title: string
}

export function CommunityConfirmDialog({
  confirmLabel = 'Delete',
  message,
  onCancel,
  onConfirm,
  saving = false,
  title,
}: CommunityConfirmDialogProps) {
  return (
    <div className="workspace-modal-backdrop" onClick={saving ? undefined : onCancel}>
      <div
        className="workspace-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="community-confirm-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="workspace-modal-header">
          <div>
            <h2 id="community-confirm-title">{title}</h2>
            <p>{message}</p>
          </div>
          <button
            type="button"
            className="workspace-modal-close"
            aria-label="Close"
            disabled={saving}
            onClick={onCancel}
          >
            ×
          </button>
        </div>
        <div className="workspace-modal-actions">
          <button type="button" disabled={saving} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="course-detail-community-confirm-btn"
            disabled={saving}
            onClick={onConfirm}
          >
            {saving ? 'Deleting...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
