import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useAuthContext } from '../../../../context/AuthContext'
import type { Role } from '../../../../hooks/useAuth'
import { supabase } from '../../../../lib/supabase/client'
import {
  createInboxThread,
  fetchInboxData,
  getErrorMessage,
  markThreadRead,
  profileName,
  roleAllowedRecipient,
  sendInboxMessage,
} from '../../lib/workspace/api'
import type {
  InboxData,
  InboxMessageRow,
  InboxThreadRow,
  ProfileRow,
} from '../../lib/workspace/types'

const formatMessageTime = (isoValue: string) =>
  new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(isoValue))

const latestMessageForThread = (thread: InboxThreadRow, messages: InboxMessageRow[]) =>
  [...messages]
    .filter((message) => message.thread_id === thread.id)
    .sort((first, second) => new Date(second.created_at).getTime() - new Date(first.created_at).getTime())[0]

function InboxPage() {
  const { workspaceRole } = useOutletContext<{ workspaceRole: Role }>()
  const { user } = useAuthContext()
  const [data, setData] = useState<InboxData>({
    profiles: [],
    threads: [],
    participants: [],
    messages: [],
  })
  const [selectedThreadId, setSelectedThreadId] = useState('')
  const [recipientId, setRecipientId] = useState('')
  const [subject, setSubject] = useState('')
  const [newThreadMessage, setNewThreadMessage] = useState('')
  const [replyMessage, setReplyMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadInbox = useCallback(async () => {
    if (!user) {
      return
    }

    try {
      const nextData = await fetchInboxData(user.id)
      setData(nextData)
      setSelectedThreadId((current) => current || nextData.threads[0]?.id || '')
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Inbox could not be loaded'))
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadInbox(), 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadInbox])

  useEffect(() => {
    if (!user) {
      return undefined
    }

    const channel = supabase
      .channel(`workspace-inbox-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inbox_messages' },
        () => void loadInbox(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inbox_thread_participants' },
        () => void loadInbox(),
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [loadInbox, user])

  const profilesById = useMemo(() => {
    const map = new Map<string, ProfileRow>()

    for (const profile of data.profiles) {
      map.set(profile.id, profile)
    }

    return map
  }, [data.profiles])

  const contacts = data.profiles.filter(
    (profile) => profile.id !== user?.id && roleAllowedRecipient(workspaceRole, profile),
  )
  const selectedThread = data.threads.find((thread) => thread.id === selectedThreadId) ?? null
  const selectedMessages = data.messages.filter((message) => message.thread_id === selectedThreadId)
  const selectedParticipants = data.participants.filter(
    (participant) => participant.thread_id === selectedThreadId,
  )
  const selectedOtherParticipants = selectedParticipants
    .filter((participant) => participant.user_id !== user?.id)
    .map((participant) => profilesById.get(participant.user_id))
    .filter((profile): profile is ProfileRow => profile !== undefined)

  useEffect(() => {
    if (!user || !selectedThreadId) {
      return
    }

    void markThreadRead(selectedThreadId, user.id)
  }, [selectedThreadId, user])

  const handleCreateThread = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!user || !recipientId) {
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    try {
      const threadId = await createInboxThread(
        user.id,
        recipientId,
        subject.trim() || 'Workspace message',
        newThreadMessage.trim(),
      )

      setSelectedThreadId(threadId)
      setRecipientId('')
      setSubject('')
      setNewThreadMessage('')
      setNotice('Message sent.')
      await loadInbox()
    } catch (createError) {
      setError(getErrorMessage(createError, 'Message could not be sent'))
    } finally {
      setSaving(false)
    }
  }

  const handleReply = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!user || !selectedThreadId || !replyMessage.trim()) {
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    try {
      await sendInboxMessage(selectedThreadId, user.id, replyMessage.trim())
      setReplyMessage('')
      setNotice('Reply sent.')
      await loadInbox()
    } catch (replyError) {
      setError(getErrorMessage(replyError, 'Reply could not be sent'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="workspace-page">
      <header className="workspace-page-header">
        <span className="workspace-eyebrow">Workspace</span>
        <h1 className="workspace-page-title">Inbox</h1>
        <p className="workspace-page-subtitle">
          Realtime workspace messages for course communication between students,
          teachers, and admins.
        </p>
      </header>

      {error !== '' && <div className="workspace-alert workspace-alert--error">{error}</div>}
      {notice !== '' && <div className="workspace-alert workspace-alert--success">{notice}</div>}

      {loading ? (
        <section className="workspace-panel">Loading inbox...</section>
      ) : (
        <div className="workspace-grid workspace-grid--two">
          <section className="workspace-panel inbox-shell">
            <div className="inbox-thread-list" aria-label="Threads">
              {data.threads.map((thread) => {
                const latestMessage = latestMessageForThread(thread, data.messages)

                return (
                  <button
                    key={thread.id}
                    type="button"
                    className={`inbox-thread${selectedThreadId === thread.id ? ' inbox-thread--active' : ''}`}
                    onClick={() => setSelectedThreadId(thread.id)}
                  >
                    <strong>{thread.subject}</strong>
                    <span>{latestMessage?.body ?? 'No messages yet'}</span>
                  </button>
                )
              })}

              {data.threads.length === 0 && (
                <div className="workspace-empty-state">No message threads yet.</div>
              )}
            </div>

            <div className="inbox-conversation" aria-label="Conversation">
              {selectedThread ? (
                <>
                  <header className="inbox-conversation-header">
                    <div>
                      <h2>{selectedThread.subject}</h2>
                      <p>
                        {selectedOtherParticipants.map((profile) => profileName(profile)).join(', ') ||
                          'Only you'}
                      </p>
                    </div>
                  </header>

                  <div className="inbox-message-list">
                    {selectedMessages.map((message) => {
                      const sender = profilesById.get(message.sender_id)
                      const isOwnMessage = message.sender_id === user?.id

                      return (
                        <article
                          className={`inbox-bubble${isOwnMessage ? ' inbox-bubble--own' : ''}`}
                          key={message.id}
                        >
                          <strong>{isOwnMessage ? 'You' : profileName(sender)}</strong>
                          <p>{message.body}</p>
                          <span>{formatMessageTime(message.created_at)}</span>
                        </article>
                      )
                    })}
                  </div>

                  <form className="workspace-form inbox-reply-form" onSubmit={(event) => void handleReply(event)}>
                    <label>
                      <span>Reply</span>
                      <textarea
                        value={replyMessage}
                        onChange={(event) => setReplyMessage(event.target.value)}
                        placeholder="Write a reply..."
                      />
                    </label>
                    <button type="submit" disabled={saving || replyMessage.trim() === ''}>
                      Send reply
                    </button>
                  </form>
                </>
              ) : (
                <div className="workspace-empty-state">Select a thread or start a new message.</div>
              )}
            </div>
          </section>

          <aside className="workspace-panel">
            <h2>New message</h2>
            <form className="workspace-form" onSubmit={(event) => void handleCreateThread(event)}>
              <label>
                <span>To</span>
                <select
                  value={recipientId}
                  onChange={(event) => setRecipientId(event.target.value)}
                  required
                >
                  <option value="">Choose recipient</option>
                  {contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {profileName(contact)} ({contact.role})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Subject</span>
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="Course question"
                />
              </label>
              <label>
                <span>Message</span>
                <textarea
                  value={newThreadMessage}
                  onChange={(event) => setNewThreadMessage(event.target.value)}
                  placeholder="Write a short message..."
                  required
                />
              </label>
              <button type="submit" disabled={saving || contacts.length === 0}>
                {saving ? 'Sending...' : 'Send message'}
              </button>
            </form>
          </aside>
        </div>
      )}
    </section>
  )
}

export default InboxPage
