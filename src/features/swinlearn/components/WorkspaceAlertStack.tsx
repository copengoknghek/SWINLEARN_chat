import { useEffect } from 'react'

export const workspaceAlertDismissMs = 5000

type WorkspaceAlertStackProps = {
  error?: string
  notice?: string
  onDismissError?: () => void
  onDismissNotice?: () => void
}

export function WorkspaceAlertStack({
  error = '',
  notice = '',
  onDismissError,
  onDismissNotice,
}: WorkspaceAlertStackProps) {
  useEffect(() => {
    if (error === '' && notice === '') {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      onDismissError?.()
      onDismissNotice?.()
    }, workspaceAlertDismissMs)

    return () => window.clearTimeout(timeoutId)
  }, [error, notice, onDismissError, onDismissNotice])

  if (error === '' && notice === '') {
    return null
  }

  return (
    <div className="workspace-alert-stack" aria-live="polite">
      {error !== '' && (
        <div className="workspace-alert workspace-alert--error" role="alert">
          <span>{error}</span>
          {onDismissError && (
            <button
              type="button"
              className="workspace-alert-close"
              aria-label="Dismiss error alert"
              onClick={onDismissError}
            >
              ×
            </button>
          )}
        </div>
      )}
      {notice !== '' && (
        <div className="workspace-alert workspace-alert--success" role="status">
          <span>{notice}</span>
          {onDismissNotice && (
            <button
              type="button"
              className="workspace-alert-close"
              aria-label="Dismiss success alert"
              onClick={onDismissNotice}
            >
              ×
            </button>
          )}
        </div>
      )}
    </div>
  )
}
