import { useCallback, useEffect, useMemo, useState } from 'react'
import { WorkspaceAlertStack } from '../../components/WorkspaceAlertStack'
import {
  approveHelpRequest,
  fetchAdminHelpRequests,
  fetchAvailableRoomsForRequest,
  forwardHelpRequest,
  getErrorMessage,
  helpRequestStatusLabel,
  helpTopicLabel,
  profileName,
  rejectHelpRequest,
} from '../../lib/workspace/api'
import type { HelpRequestRow, HelpRequestStatus, RoomRow } from '../../lib/workspace/types'

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('en', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))

const statusFilters: Array<{ value: 'all' | HelpRequestStatus; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'awaiting_teacher', label: 'With teacher' },
  { value: 'teacher_declined', label: 'Teacher declined' },
  { value: 'awaiting_room', label: 'Awaiting room' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

function AdminRequestsPage() {
  const [requests, setRequests] = useState<HelpRequestRow[]>([])
  const [statusFilter, setStatusFilter] = useState<'all' | HelpRequestStatus>('all')
  const [roomOptionsByRequest, setRoomOptionsByRequest] = useState<Record<string, RoomRow[]>>({})
  const [selectedRoomByRequest, setSelectedRoomByRequest] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [busyRequestId, setBusyRequestId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadRequests = useCallback(async () => {
    try {
      const nextRequests = await fetchAdminHelpRequests()
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

  const filteredRequests = useMemo(() => {
    if (statusFilter === 'all') {
      return requests
    }

    return requests.filter((request) => request.status === statusFilter)
  }, [requests, statusFilter])

  const loadRoomsForRequest = async (request: HelpRequestRow) => {
    try {
      const rooms = await fetchAvailableRoomsForRequest(request.id)
      setRoomOptionsByRequest((current) => ({ ...current, [request.id]: rooms }))
      setSelectedRoomByRequest((current) => ({
        ...current,
        [request.id]: current[request.id] ?? rooms[0]?.id ?? '',
      }))
    } catch (roomError) {
      setError(getErrorMessage(roomError, 'Available rooms could not be loaded'))
    }
  }

  const runAction = async (requestId: string, action: () => Promise<HelpRequestRow>) => {
    setBusyRequestId(requestId)
    setError('')
    setNotice('')

    try {
      await action()
      setNotice('Request updated.')
      await loadRequests()
    } catch (actionError) {
      setError(getErrorMessage(actionError, 'Request could not be updated'))
    } finally {
      setBusyRequestId('')
    }
  }

  return (
    <section className="workspace-page">
      <header className="workspace-page-header">
        <span className="workspace-eyebrow">Admin workspace</span>
        <h1 className="workspace-page-title">Requests</h1>
        <p className="workspace-page-subtitle">
          Review help and consultation requests from students and teachers.
        </p>
      </header>

      <WorkspaceAlertStack
        error={error}
        notice={notice}
        onDismissError={() => setError('')}
        onDismissNotice={() => setNotice('')}
      />

      <section className="workspace-panel">
        <div className="workspace-toolbar">
          <label>
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'all' | HelpRequestStatus)}
            >
              {statusFilters.map((filter) => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading && <p>Loading requests…</p>}
        {!loading && filteredRequests.length === 0 && (
          <p className="workspace-muted">No requests match this filter.</p>
        )}

        <div className="workspace-list help-request-list">
          {filteredRequests.map((request) => {
            const busy = busyRequestId === request.id
            const roomOptions = roomOptionsByRequest[request.id] ?? []

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
                    <dt>Requester</dt>
                    <dd>{profileName(request.requester ?? undefined)}</dd>
                  </div>
                  <div>
                    <dt>Type</dt>
                    <dd>{request.type === 'consultation' ? 'Consultation' : 'General help'}</dd>
                  </div>
                  {request.teacher && (
                    <div>
                      <dt>Teacher</dt>
                      <dd>{profileName(request.teacher)}</dd>
                    </div>
                  )}
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

                <div className="help-request-actions">
                  {request.status === 'submitted' && request.type === 'consultation' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void runAction(request.id, () => forwardHelpRequest(request.id))
                      }
                    >
                      Forward to teacher
                    </button>
                  )}

                  {request.status === 'submitted' && request.type === 'general' && (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void runAction(request.id, () => approveHelpRequest(request.id))
                        }
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="workspace-button-secondary"
                        disabled={busy}
                        onClick={() =>
                          void runAction(request.id, () => rejectHelpRequest(request.id))
                        }
                      >
                        Reject
                      </button>
                    </>
                  )}

                  {request.status === 'awaiting_room' && (
                    <>
                      <label>
                        <span>Available room</span>
                        <select
                          value={selectedRoomByRequest[request.id] ?? ''}
                          onFocus={() => void loadRoomsForRequest(request)}
                          onChange={(event) =>
                            setSelectedRoomByRequest((current) => ({
                              ...current,
                              [request.id]: event.target.value,
                            }))
                          }
                        >
                          <option value="">Select a room</option>
                          {roomOptions.map((room) => (
                            <option key={room.id} value={room.id}>
                              {room.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        disabled={busy || !selectedRoomByRequest[request.id]}
                        onClick={() =>
                          void runAction(request.id, () =>
                            approveHelpRequest(request.id, selectedRoomByRequest[request.id]),
                          )
                        }
                      >
                        Confirm consultation
                      </button>
                      <button
                        type="button"
                        className="workspace-button-secondary"
                        disabled={busy}
                        onClick={() =>
                          void runAction(request.id, () => rejectHelpRequest(request.id))
                        }
                      >
                        Reject
                      </button>
                    </>
                  )}

                  {(request.status === 'teacher_declined' ||
                    request.status === 'awaiting_teacher') && (
                    <button
                      type="button"
                      className="workspace-button-secondary"
                      disabled={busy}
                      onClick={() =>
                        void runAction(request.id, () => rejectHelpRequest(request.id))
                      }
                    >
                      Reject
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </section>
    </section>
  )
}

export default AdminRequestsPage
