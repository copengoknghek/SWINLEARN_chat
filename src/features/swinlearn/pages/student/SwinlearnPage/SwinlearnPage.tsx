import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { WorkspaceAlertStack } from '../../../components/WorkspaceAlertStack'
import { MarkdownMessage } from '../../../components/MarkdownMessage'
import { PerfectCvEditPanel } from '../../../components/cv/PerfectCvEditPanel'
import { CvProjectPreview } from '../../../components/cv/CvProjectPreview'
import { PerfectCvPreview } from '../../../components/cv/PerfectCvPreview'
import { PerfectCvProjectPicker } from '../../../components/cv/PerfectCvProjectPicker'
import { cvProjectMarkdownToWordHtml } from '../../../lib/cvProjectMarkdown.mjs'
import { perfectCvMarkdownToWordHtmlFromMarkdown } from '../../../lib/perfectCvFormat.mjs'
import { downloadGradeReportPdf, downloadGradeReportXlsx } from '../../../lib/gradeReportExport.mjs'
import {
  createSwinlearnThread,
  deleteSwinlearnThread,
  fetchSwinlearnContext,
  fetchSwinlearnThread,
  fetchSwinlearnThreads,
  getErrorMessage,
  sendSwinlearnMessage,
  updateSwinlearnThread,
} from '../../../lib/workspace/api'
import type { SwinlearnSendMessageOptions } from '../../../lib/workspace/api'
import type {
  SwinlearnContextData,
  SwinlearnCourseContextRow,
  SwinlearnMessageRow,
  SwinlearnThreadRow,
} from '../../../lib/workspace/types'
import './SwinlearnPage.css'

const uploadAccept =
  '.pdf, .doc, .docx, .ppt, .pptx, .txt, .md, .html, image/*'

const emptyContext: SwinlearnContextData = {
  courses: [],
}

const courseTitle = (course: Pick<SwinlearnCourseContextRow, 'code' | 'title'>) =>
  `${course.code} - ${course.title}`

const formatDateTime = (isoValue: string) =>
  new Intl.DateTimeFormat('en', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(isoValue))

const messageCitations = (message: SwinlearnMessageRow) =>
  message.citations.filter((citation) => citation.filename || citation.text)

const formatKnowledgeIndexStatus = (status: string) => {
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

const formatCitationScore = (score: number | null) =>
  typeof score === 'number' ? `${Math.round(score * 100)}% match` : null

const VISIBLE_CITATION_COUNT = 2

function MessageCitationList({ message }: { message: SwinlearnMessageRow }) {
  const [expanded, setExpanded] = useState(false)
  const citations = messageCitations(message)
  if (citations.length === 0) return null

  const hiddenCount = citations.length - VISIBLE_CITATION_COUNT
  const visibleCitations =
    expanded || hiddenCount <= 0
      ? citations
      : citations.slice(0, VISIBLE_CITATION_COUNT)

  return (
    <div className="swinlearn-source-grid">
      {visibleCitations.map((citation, index) => (
        <div className="swinlearn-source-card" key={`${message.id}-${index}`}>
          <div className="swinlearn-source-card-header">
            <strong>{citation.filename}</strong>
            {formatCitationScore(citation.score) && (
              <span className="swinlearn-source-score">
                {formatCitationScore(citation.score)}
              </span>
            )}
          </div>
          {citation.text && <span>{citation.text.slice(0, 160)}</span>}
        </div>
      ))}
      {!expanded && hiddenCount > 0 && (
        <button
          type="button"
          className="swinlearn-source-more"
          aria-label={`Show ${hiddenCount} more references`}
          onClick={() => setExpanded(true)}
        >
          ...
        </button>
      )}
    </div>
  )
}

const isCvExportMessage = (message: SwinlearnMessageRow) =>
  message.metadata?.contentType === 'cv_export'

const isPerfectCvExportMessage = (message: SwinlearnMessageRow) =>
  message.metadata?.contentType === 'perfect_cv_export'

const isGradeExportMessage = (message: SwinlearnMessageRow) =>
  message.metadata?.contentType === 'grade_export'

const cvExportFilename = (prefix = 'swinlearn-cv-projects') =>
  `${prefix}-${new Date().toISOString().slice(0, 10)}`

const downloadCvFile = (content: string, filename: string, mimeType: string, body = content) => {
  const blob = new Blob([body], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

const downloadCvMarkdown = (content: string, prefix?: string) => {
  downloadCvFile(content, `${cvExportFilename(prefix)}.md`, 'text/markdown;charset=utf-8')
}

const isPerfectCvMarkdown = (content: string) =>
  /##\s*Contact\b/i.test(content) || /Email\s*:/i.test(content)

const downloadCvWord = (content: string, prefix?: string) => {
  const body = isPerfectCvMarkdown(content)
    ? `\ufeff${perfectCvMarkdownToWordHtmlFromMarkdown(content)}`
    : `\ufeff${cvProjectMarkdownToWordHtml(content)}`

  downloadCvFile(content, `${cvExportFilename(prefix)}.doc`, 'application/msword;charset=utf-8', body)
}

function SwinlearnEllipsisIcon() {
  return (
    <svg className="swinlearn-thread-menu-icon" viewBox="0 0 448 512" aria-hidden="true" focusable="false">
      <path d="M8 256a56 56 0 1 1 112 0A56 56 0 1 1 8 256zm160 0a56 56 0 1 1 112 0 56 56 0 1 1 -112 0zm216-56a56 56 0 1 1 0 112 56 56 0 1 1 0-112z" />
    </svg>
  )
}

function SwinlearnPage() {
  const [context, setContext] = useState<SwinlearnContextData>(emptyContext)
  const [threads, setThreads] = useState<SwinlearnThreadRow[]>([])
  const [activeThread, setActiveThread] = useState<SwinlearnThreadRow | null>(null)
  const [selectedOfferingIds, setSelectedOfferingIds] = useState<string[]>([])
  const [draftMessage, setDraftMessage] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [showHistory, setShowHistory] = useState(true)
  const [showFiles, setShowFiles] = useState(true)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [openMenuThreadId, setOpenMenuThreadId] = useState('')
  const [renameThread, setRenameThread] = useState<SwinlearnThreadRow | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [deleteThread, setDeleteThread] = useState<SwinlearnThreadRow | null>(null)
  const [threadActionSaving, setThreadActionSaving] = useState(false)
  const [showPerfectCvPicker, setShowPerfectCvPicker] = useState(false)
  const [perfectCvPanelMessage, setPerfectCvPanelMessage] = useState<SwinlearnMessageRow | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const threadMenuRef = useRef<HTMLDivElement | null>(null)

  const selectedCourses = useMemo(
    () => context.courses.filter((course) => selectedOfferingIds.includes(course.id)),
    [context.courses, selectedOfferingIds],
  )
  const activeMessages = activeThread?.messages ?? []
  const activeAttachments = activeThread?.attachments ?? []
  const showRightRail = showFiles || perfectCvPanelMessage !== null
  const layoutClassName = [
    'swinlearn-layout',
    showHistory ? 'swinlearn-layout--has-history' : '',
    showRightRail ? 'swinlearn-layout--has-right' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const closePerfectCvPanel = () => {
    setPerfectCvPanelMessage(null)
    setShowFiles(true)
  }

  const loadThread = useCallback(async (threadId: string) => {
    const thread = await fetchSwinlearnThread(threadId)

    setActiveThread(thread)
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [nextContext, nextThreads] = await Promise.all([
        fetchSwinlearnContext(),
        fetchSwinlearnThreads(),
      ])

      setContext(nextContext)
      setThreads(nextThreads)

      const firstThread = nextThreads[0]

      if (firstThread) {
        await loadThread(firstThread.id)
      } else {
        setSelectedOfferingIds([])
      }
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'SWINLEARN could not be loaded'))
    } finally {
      setLoading(false)
    }
  }, [loadThread])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadData(), 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadData])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [activeMessages.length, sending])

  useEffect(() => {
    if (!openMenuThreadId) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!threadMenuRef.current?.contains(event.target as Node)) {
        setOpenMenuThreadId('')
      }
    }

    document.addEventListener('mousedown', handlePointerDown)

    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [openMenuThreadId])

  const refreshThreads = async (threadId: string) => {
    const [nextThreads, nextThread] = await Promise.all([
      fetchSwinlearnThreads(),
      fetchSwinlearnThread(threadId),
    ])

    setThreads(nextThreads)
    setActiveThread(nextThread)
  }

  const ensureActiveThread = async (message: string) => {
    if (activeThread) {
      return activeThread
    }

    const thread = await createSwinlearnThread(message.slice(0, 80) || 'New SWINLEARN chat', selectedOfferingIds)

    setActiveThread(thread)
    setThreads((current) => [thread, ...current])

    return thread
  }

  const sendPrompt = async (
    prompt: string,
    files: File[] = pendingFiles,
    options?: string | SwinlearnSendMessageOptions,
  ) => {
    const message = prompt.trim()

    if (!message || sending) {
      return
    }

    setSending(true)
    setError('')
    setNotice('')

    try {
      const thread = await ensureActiveThread(message)
      const result = await sendSwinlearnMessage(
        thread.id,
        message,
        selectedOfferingIds,
        files,
        options,
      )

      setDraftMessage('')
      setPendingFiles([])
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      setActiveThread((current) =>
        current
          ? {
              ...current,
              attachments: [...result.attachments, ...(current.attachments ?? [])],
              messages: [...(current.messages ?? []), result.user, result.assistant],
            }
          : current,
      )

      if (isPerfectCvExportMessage(result.assistant)) {
        setPerfectCvPanelMessage(result.assistant)
      }

      await refreshThreads(thread.id)
    } catch (sendError) {
      setError(getErrorMessage(sendError, 'SWINLEARN could not send your message'))
    } finally {
      setSending(false)
    }
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void sendPrompt(draftMessage)
  }

  const toggleCourse = (offeringId: string) => {
    setSelectedOfferingIds((current) =>
      current.includes(offeringId)
        ? current.filter((id) => id !== offeringId)
        : [...current, offeringId],
    )
  }

  const startNewThread = () => {
    setActiveThread(null)
    setDraftMessage('')
    setPendingFiles([])
    setNotice('New chat ready.')
  }

  const handleThreadSelect = async (threadId: string) => {
    setError('')
    setNotice('')
    setOpenMenuThreadId('')

    try {
      await loadThread(threadId)
    } catch (threadError) {
      setError(getErrorMessage(threadError, 'SWINLEARN thread could not be opened'))
    }
  }

  const openRenameModal = (thread: SwinlearnThreadRow) => {
    setOpenMenuThreadId('')
    setRenameThread(thread)
    setRenameDraft(thread.title)
  }

  const openDeleteModal = (thread: SwinlearnThreadRow) => {
    setOpenMenuThreadId('')
    setDeleteThread(thread)
  }

  const handlePinThread = async (thread: SwinlearnThreadRow) => {
    setOpenMenuThreadId('')
    setThreadActionSaving(true)
    setError('')

    try {
      const updatedThread = await updateSwinlearnThread(thread.id, { pinned: !thread.pinned })
      const nextThreads = await fetchSwinlearnThreads()

      setThreads(nextThreads)
      setActiveThread((current) => (current?.id === thread.id ? { ...current, pinned: updatedThread.pinned } : current))
      setNotice(updatedThread.pinned ? 'Chat pinned.' : 'Chat unpinned.')
    } catch (pinError) {
      setError(getErrorMessage(pinError, 'Chat could not be pinned'))
    } finally {
      setThreadActionSaving(false)
    }
  }

  const handleRenameThread = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!renameThread) {
      return
    }

    const title = renameDraft.trim()

    if (title === '') {
      return
    }

    setThreadActionSaving(true)
    setError('')

    try {
      const updatedThread = await updateSwinlearnThread(renameThread.id, { title })
      const nextThreads = await fetchSwinlearnThreads()

      setThreads(nextThreads)
      setActiveThread((current) =>
        current?.id === renameThread.id ? { ...current, title: updatedThread.title } : current,
      )
      setRenameThread(null)
      setRenameDraft('')
      setNotice('Chat name updated.')
    } catch (renameError) {
      setError(getErrorMessage(renameError, 'Chat name could not be updated'))
    } finally {
      setThreadActionSaving(false)
    }
  }

  const handleDeleteThread = async () => {
    if (!deleteThread) {
      return
    }

    setThreadActionSaving(true)
    setError('')

    try {
      await deleteSwinlearnThread(deleteThread.id)
      const nextThreads = await fetchSwinlearnThreads()

      setThreads(nextThreads)
      if (activeThread?.id === deleteThread.id) {
        const nextActiveThread = nextThreads[0] ?? null

        setActiveThread(nextActiveThread)
        if (nextActiveThread) {
          await loadThread(nextActiveThread.id)
        } else {
          setSelectedOfferingIds([])
        }
      }

      setDeleteThread(null)
      setNotice('Chat deleted.')
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, 'Chat could not be deleted'))
    } finally {
      setThreadActionSaving(false)
    }
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPendingFiles(Array.from(event.target.files ?? []))
  }

  const summarizeSelectedCourses = () => {
    const label = selectedCourses.length === 1 ? courseTitle(selectedCourses[0]) : 'my selected courses'

    void sendPrompt(`Summarize selected course knowledge for ${label}.`)
  }

  const draftCvFromProjects = () => {
    const courses = selectedCourses

    if (courses.length === 0) {
      setNotice('Select at least one course, then name assignment titles in your message.')
      return
    }

    if (courses.length === 1) {
      setDraftMessage(`Make a CV entry for "Assignment title here" in ${courses[0].code}`)
      return
    }

    setDraftMessage(
      `Make CV entries for "Assignment 1" in ${courses[0].code} and "Assignment 3" in ${courses[1].code}`,
    )
  }

  const draftCvForAllSubmitted = () => {
    const course = selectedCourses[0]

    if (!course) {
      setNotice('Select a course first.')
      return
    }

    void sendPrompt(`Make CV entries for all my submitted assignments in ${course.code}`, [], {
      intent: 'cv_export',
    })
  }

  const exportGrades = () => {
    void sendPrompt('Export my grade table', [], { intent: 'grade_export' })
  }

  const downloadGradeExportXlsx = () => {
    void downloadGradeReportXlsx().catch((error: unknown) => {
      setNotice(getErrorMessage(error, 'Grade report could not be exported.'))
    })
  }

  const downloadGradeExportPdf = () => {
    void downloadGradeReportPdf().catch((error: unknown) => {
      setNotice(getErrorMessage(error, 'Grade report could not be exported.'))
    })
  }

  const handlePerfectCvConfirm = (assignmentIds: string[]) => {
    setShowPerfectCvPicker(false)

    void sendPrompt('Build my Perfect CV from the selected projects.', [], {
      assignmentIds,
      intent: 'perfect_cv',
    })
  }

  return (
    <section className="workspace-page swinlearn-workspace">
      <header className="workspace-page-header">
        <span className="workspace-eyebrow">Workspace chatbot</span>
        <h1 className="workspace-page-title">SWINLEARN</h1>
        <p className="workspace-page-subtitle">
          Ask about enrolled course knowledge, upload study files, find where topics are
          explained.
        </p>
      </header>

      <WorkspaceAlertStack
        error={error}
        notice={notice}
        onDismissError={() => setError('')}
        onDismissNotice={() => setNotice('')}
      />

      <div className={layoutClassName}>
        {showHistory && (
          <aside className="chat-sidebar history-sidebar">
            <div className="sidebar-header">
              <div className="sidebar-title">
                <span>History</span>
              </div>
              <button
                className="icon-btn panel-btn"
                type="button"
                onClick={() => setShowHistory(false)}
                aria-label="Hide history"
              >
                &lt;
              </button>
            </div>
            <div className="sidebar-content">
              <button className="swinlearn-new-thread" type="button" onClick={startNewThread}>
                New chat
              </button>
              <div className="swinlearn-thread-list">
                {threads.map((thread) => (
                  <div
                    className={`swinlearn-thread-row${
                      activeThread?.id === thread.id ? ' swinlearn-thread-row--active' : ''
                    }${thread.pinned ? ' swinlearn-thread-row--pinned' : ''}`}
                    key={thread.id}
                  >
                    <button
                      className="swinlearn-thread"
                      type="button"
                      onClick={() => void handleThreadSelect(thread.id)}
                    >
                      <strong>
                        {thread.pinned && (
                          <span className="swinlearn-thread-pin" aria-label="Pinned">
                            Pinned
                          </span>
                        )}
                        {thread.title}
                      </strong>
                      <span>{formatDateTime(thread.updated_at)}</span>
                    </button>
                    <div className="swinlearn-thread-menu-wrap" ref={openMenuThreadId === thread.id ? threadMenuRef : null}>
                      <button
                        className="swinlearn-thread-menu-btn"
                        type="button"
                        aria-label={`Options for ${thread.title}`}
                        aria-expanded={openMenuThreadId === thread.id}
                        aria-haspopup="menu"
                        disabled={threadActionSaving}
                        onClick={(event) => {
                          event.stopPropagation()
                          setOpenMenuThreadId((current) => (current === thread.id ? '' : thread.id))
                        }}
                      >
                        <SwinlearnEllipsisIcon />
                      </button>
                      {openMenuThreadId === thread.id && (
                        <div className="swinlearn-thread-menu" role="menu">
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => void handlePinThread(thread)}
                          >
                            {thread.pinned ? 'Unpin chat' : 'Pin chat'}
                          </button>
                          <button type="button" role="menuitem" onClick={() => openRenameModal(thread)}>
                            Change name
                          </button>
                          <button
                            type="button"
                            className="swinlearn-thread-menu-danger"
                            role="menuitem"
                            onClick={() => openDeleteModal(thread)}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {threads.length === 0 && (
                  <p className="swinlearn-muted">Your SWINLEARN chats will appear here.</p>
                )}
              </div>
            </div>
          </aside>
        )}

        <section className="chat-main" aria-label="SWINLEARN chat">
          <header className="chat-header">
            <div className="chat-header-left">
              {!showHistory && (
                <button
                  className="icon-btn panel-btn"
                  type="button"
                  onClick={() => setShowHistory(true)}
                  aria-label="Show history"
                >
                  &gt;
                </button>
              )}
              <div className="swin-badge">SWINLEARN</div>
              <span className="subtitle">AI study tutor</span>
            </div>
            <div className="chat-header-right">
              {!showFiles && (
                <button
                  className="icon-btn panel-btn"
                  type="button"
                  onClick={() => setShowFiles(true)}
                  aria-label="Show files"
                >
                  &lt;
                </button>
              )}
            </div>
          </header>

          <div className="chat-messages-container">
            {loading ? (
              <div className="chat-empty-state">
                <div className="chat-empty-icon">AI</div>
                <h2>Loading SWINLEARN...</h2>
              </div>
            ) : activeMessages.length === 0 ? (
              <div className="chat-empty-state">
                <div className="chat-empty-icon">AI</div>
                <h2>Ask me anything about your enrolled courses.</h2>
                <p>Try: "Where is ML explained?" or "Summarize week 4".</p>
              </div>
            ) : (
              <div className="swinlearn-message-list">
                {activeMessages.map((message) => (
                  <article
                    className={`swinlearn-message swinlearn-message--${message.role === 'assistant' ? 'assistant' : 'student'}`}
                    key={message.id}
                  >
                    <div className="swinlearn-message-meta">
                      <strong>{message.role === 'assistant' ? 'SWINLEARN' : 'You'}</strong>
                      <span>{formatDateTime(message.created_at)}</span>
                    </div>
                    {isPerfectCvExportMessage(message) ? (
                      <PerfectCvPreview content={message.content} />
                    ) : isCvExportMessage(message) ? (
                      <CvProjectPreview content={message.content} />
                    ) : isGradeExportMessage(message) ? (
                      <MarkdownMessage content={message.content} />
                    ) : (
                      <MarkdownMessage content={message.content} />
                    )}
                    {isCvExportMessage(message) && (
                      <div className="swinlearn-cv-export-actions">
                        <button
                          className="clear-btn"
                          type="button"
                          onClick={() => downloadCvMarkdown(message.content)}
                        >
                          Download as Markdown
                        </button>
                        <button
                          className="clear-btn"
                          type="button"
                          onClick={() => downloadCvWord(message.content)}
                        >
                          Download as Word
                        </button>
                      </div>
                    )}
                    {isPerfectCvExportMessage(message) && (
                      <div className="swinlearn-cv-export-actions">
                        <button
                          className="clear-btn"
                          type="button"
                          onClick={() => setPerfectCvPanelMessage(message)}
                        >
                          Edit &amp; download
                        </button>
                      </div>
                    )}
                    {isGradeExportMessage(message) && (
                      <div className="swinlearn-cv-export-actions">
                        <button className="clear-btn" type="button" onClick={downloadGradeExportXlsx}>
                          Download Excel
                        </button>
                        <button className="clear-btn" type="button" onClick={downloadGradeExportPdf}>
                          Download PDF
                        </button>
                      </div>
                    )}
                    {message.attachments.length > 0 && (
                      <div className="swinlearn-attachment-list">
                        {message.attachments.map((attachment) => (
                          <span className="workspace-chip" key={attachment.id}>
                            {attachment.original_name}
                          </span>
                        ))}
                      </div>
                    )}
                    <MessageCitationList message={message} />
                  </article>
                ))}
                {sending && (
                  <article className="swinlearn-message swinlearn-message--assistant">
                    <div className="swinlearn-message-meta">
                      <strong>SWINLEARN</strong>
                    </div>
                    <p>
                      {selectedOfferingIds.length === 0
                        ? 'Thinking...'
                        : 'Reading your selected course knowledge...'}
                    </p>
                  </article>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <form className="chat-input-area" onSubmit={handleSubmit}>
            <div className="swinlearn-quick-actions">
              <button type="button" onClick={draftCvFromProjects} disabled={sending}>
                CV example prompt
              </button>
              <button type="button" onClick={draftCvForAllSubmitted} disabled={sending}>
                CV all submitted in course
              </button>
              <button type="button" onClick={() => setShowPerfectCvPicker(true)} disabled={sending}>
                Perfect CV
              </button>
              <button type="button" onClick={exportGrades} disabled={sending}>
                Export grades
              </button>
              <button type="button" onClick={summarizeSelectedCourses} disabled={sending}>
                Summarize selected course
              </button>
            </div>
            <div className="chat-input-wrapper">
              <input
                type="text"
                placeholder="Ask SWINLEARN about your selected course knowledge..."
                className="chat-input"
                value={draftMessage}
                onChange={(event) => setDraftMessage(event.target.value)}
                disabled={sending}
              />
              <button className="send-btn" type="submit" disabled={sending || draftMessage.trim() === ''}>
                {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
            <label className="swinlearn-upload">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={uploadAccept}
                onChange={handleFileChange}
                disabled={sending}
              />
            </label>
            {pendingFiles.length > 0 && (
              <div className="swinlearn-file-chips">
                {pendingFiles.map((file) => (
                  <span className="workspace-chip" key={`${file.name}-${file.size}`}>
                    {file.name}
                  </span>
                ))}
              </div>
            )}
          </form>
        </section>

        {showRightRail &&
          (perfectCvPanelMessage ? (
            <PerfectCvEditPanel
              message={perfectCvPanelMessage}
              onClose={closePerfectCvPanel}
              onDownloadMarkdown={(content) => downloadCvMarkdown(content, 'swinlearn-perfect-cv')}
              onDownloadWord={(content) => downloadCvWord(content, 'swinlearn-perfect-cv')}
            />
          ) : (
            <aside className="chat-sidebar export-sidebar">
              <div className="sidebar-header">
                <div className="sidebar-title">
                  <span>Courses</span>
                </div>
                <button
                  className="icon-btn panel-btn"
                  type="button"
                  onClick={() => setShowFiles(false)}
                  aria-label="Hide files"
                >
                  &gt;
                </button>
              </div>
              <div className="sidebar-content">
                <p className="swinlearn-muted swinlearn-course-helper">
                  Optional - no courses selected by default. Select one or more to scope knowledge retrieval.
                </p>
                <div className="swinlearn-course-filter">
                  {context.courses.map((course) => (
                    <label key={course.id}>
                      <input
                        type="checkbox"
                        checked={selectedOfferingIds.includes(course.id)}
                        onChange={() => toggleCourse(course.id)}
                      />
                      <span>
                        <strong>{course.code}</strong>
                        {course.title}
                      </span>
                      <small
                        className={`swinlearn-index-status swinlearn-index-status--${course.knowledge_index.status}`}
                        title={course.knowledge_index.error_message ?? undefined}
                      >
                        {formatKnowledgeIndexStatus(course.knowledge_index.status)}
                      </small>
                    </label>
                  ))}
                  {context.courses.length === 0 && (
                    <p className="swinlearn-muted">No enrolled course knowledge is available yet.</p>
                  )}
                </div>

                <section className="swinlearn-source-panel">
                  <h2>Uploaded files</h2>
                  {activeAttachments.map((attachment) => (
                    <div className="swinlearn-source-card" key={attachment.id}>
                      <strong>{attachment.original_name}</strong>
                      <span>{attachment.file_kind}</span>
                    </div>
                  ))}
                  {activeAttachments.length === 0 && (
                    <p className="swinlearn-muted">Files you send in this chat will appear here.</p>
                  )}
                </section>
              </div>
            </aside>
          ))}
      </div>

      {showPerfectCvPicker && (
        <PerfectCvProjectPicker
          onClose={() => setShowPerfectCvPicker(false)}
          onConfirm={handlePerfectCvConfirm}
        />
      )}

      {renameThread && (
        <div
          className="swinlearn-modal-backdrop"
          role="presentation"
          onClick={() => setRenameThread(null)}
        >
          <form
            className="swinlearn-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="swinlearn-rename-title"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => void handleRenameThread(event)}
          >
            <header className="swinlearn-modal-header">
              <h2 id="swinlearn-rename-title">Change name</h2>
            </header>
            <label className="swinlearn-modal-field">
              <span>Chat name</span>
              <input
                autoFocus
                value={renameDraft}
                onChange={(event) => setRenameDraft(event.target.value)}
                maxLength={120}
                placeholder="Chat name"
              />
            </label>
            <div className="swinlearn-modal-actions">
              <button type="button" onClick={() => setRenameThread(null)}>
                Cancel
              </button>
              <button type="submit" disabled={threadActionSaving || renameDraft.trim() === ''}>
                {threadActionSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteThread && (
        <div
          className="swinlearn-modal-backdrop"
          role="presentation"
          onClick={() => setDeleteThread(null)}
        >
          <div
            className="swinlearn-modal swinlearn-modal--confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="swinlearn-delete-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="swinlearn-modal-header">
              <h2 id="swinlearn-delete-title">Delete chat</h2>
            </header>
            <p className="swinlearn-modal-copy">
              Delete &ldquo;{deleteThread.title}&rdquo;? This removes the chat and its messages.
            </p>
            <div className="swinlearn-modal-actions">
              <button type="button" onClick={() => setDeleteThread(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="swinlearn-modal-danger"
                disabled={threadActionSaving}
                onClick={() => void handleDeleteThread()}
              >
                {threadActionSaving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default SwinlearnPage
