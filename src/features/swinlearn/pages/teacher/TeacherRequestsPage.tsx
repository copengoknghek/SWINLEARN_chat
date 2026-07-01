import { useCallback, useEffect, useMemo, useState } from 'react'
import { WorkspaceAlertStack } from '../../components/WorkspaceAlertStack'
import {
  fetchTeacherHelpRequests,
  getErrorMessage,
  helpRequestStatusLabel,
  helpTopicLabel,
  profileName,
  respondToHelpRequest,
} from '../../lib/workspace/api'
import type { HelpRequestRow } from '../../lib/workspace/types'

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('en', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))

function TeacherRequestsPage() {
  const [requests, setRequests] = useState<HelpRequestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyRequestId, setBusyRequestId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadRequests = useCallback(async () => {
    try {
      const nextRequests = await fetchTeacherHelpRequests()
      setRequests(nextRequests)
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Requests could not be loaded'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadRequests(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadRequests])

  const pendingRequests = useMemo(
    () => requests.filter((request) => request.status === 'awaiting_teacher'),
    [requests],
  )

  const historyRequests = useMemo(
    () => requests.filter((request) => request.status !== 'awaiting_teacher'),
    [requests],
  )

  const respond = async (requestId: string, accepted: boolean) => {
    setBusyRequestId(requestId)
    setError('')
    setNotice('')

    try {
      await respondToHelpRequest(requestId, accepted)
      setNotice(accepted ? 'Consultation accepted.' : 'Consultation declined.')
      await loadRequests()
    } catch (respondError) {
      setError(getErrorMessage(respondError, 'Response could not be saved'))
    } finally {
      setBusyRequestId('')
    }
  }

  const renderRequest = (request: HelpRequestRow, showActions: boolean) => {
    const busy = busyRequestId === request.id

    return (
      <article className="workspace-card help-request-card" key={request.id}>
        <div className="help-request-card-header">
          <h3>{helpTopicLabel(request.topic)}</h3>
          <span className={`help-request-status help-request-status--${request.status}`}>
            {helpRequestStatusLabel[request.status]}
          </span>
        </div>

        <p>{request.details || 'No additional details provided.'}</p>

        <dl className="help-request-meta">
          <div>
            <dt>Student</dt>
            <dd>{profileName(request.requester ?? undefined)}</dd>
          </div>
          {request.requested_starts_at && (
            <div>
              <dt>Requested time</dt>
              <dd>{formatDateTime(request.requested_starts_at)}</dd>
            </div>
          )}
          {request.room_name && (
            <div>
              <dt>Room</dt>
              <dd>{request.room_name}</dd>
            </div>
          )}
        </dl>

        {showActions && (
          <div className="help-request-actions">
            <button type="button" disabled={busy} onClick={() => void respond(request.id, true)}>
              Accept
            </button>
            <button
              type="button"
              className="workspace-button-secondary"
              disabled={busy}
              onClick={() => void respond(request.id, false)}
            >
              Decline
            </button>
          </div>
        )}
      </article>
    )
  }

  return (
    <section className="workspace-page">
      <header className="workspace-page-header">
        <span className="workspace-eyebrow">Teacher workspace</span>
        <h1 className="workspace-page-title">Requests</h1>
        <p className="workspace-page-subtitle">
          Respond to consultation requests forwarded by admin.
        </p>
      </header>

      <WorkspaceAlertStack
        error={error}
        notice={notice}
        onDismissError={() => setError('')}
        onDismissNotice={() => setNotice('')}
      />

      <section className="workspace-panel">
        <h2>Pending consultations</h2>
        {loading && <p>Loading requests…</p>}
        {!loading && pendingRequests.length === 0 && (
          <p className="workspace-muted">No consultations are waiting for your response.</p>
        )}
        <div className="workspace-list help-request-list">
          {pendingRequests.map((request) => renderRequest(request, true))}
        </div>
      </section>

      <section className="workspace-panel">
        <h2>History</h2>
        {!loading && historyRequests.length === 0 && (
          <p className="workspace-muted">Past consultation responses will appear here.</p>
        )}
        <div className="workspace-list help-request-list">
          {historyRequests.map((request) => renderRequest(request, false))}
        </div>
      </section>
    </section>
  )
}

export default TeacherRequestsPage
