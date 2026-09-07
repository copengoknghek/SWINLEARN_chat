import { faAngleDown, faAngleUp } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useAuthContext } from '../../../../context/AuthContext'
import type { Role } from '../../../../hooks/useAuth'
import { WorkspaceAlertStack } from '../../components/WorkspaceAlertStack'
import { GiphyPicker } from '../../components/GiphyPicker'
import { handleEnterToSubmit } from '../../lib/composerEnterSubmit.mjs'
import {
  cancelConnection,
  courseLabel,
  createGroupConversation,
  deleteConversation,
  fetchInboxData,
  fetchWorkspaceCourses,
  getErrorMessage,
  markConversationRead,
  openConversation,
  profileName,
  respondToConnection,
  searchPeople,
  sendConnectionRequest,
  sendInboxMessage,
  setConversationNickname,
  updateConversation,
} from '../../lib/workspace/api'
import type {
  ConversationParticipantRow,
  ConversationRow,
  CourseWithMembers,
  InboxColorKey,
  InboxData,
  PersonSearchResult,
  ProfileRow,
} from '../../lib/workspace/types'
import { accountAvatarInitials } from './accountProfileInitials'

type RightPane = 'conversation' | 'search' | 'requests'
type SettingsView = 'menu' | 'color' | 'nickname' | 'search-in'

const emptyInbox: InboxData = { conversations: [], connections: [] }

const INBOX_COLORS: { key: InboxColorKey; label: string; css: string }[] = [
  { key: 'green', label: 'Green', css: 'var(--fpt-green)' },
  { key: 'blue', label: 'Blue', css: '#2563eb' },
  { key: 'purple', label: 'Purple', css: '#7c3aed' },
  { key: 'orange', label: 'Orange', css: '#ea580c' },
  { key: 'red', label: 'Red', css: '#dc2626' },
  { key: 'teal', label: 'Teal', css: '#0d9488' },
  { key: 'pink', label: 'Pink', css: '#db2777' },
]

const formatMessageTime = (isoValue: string) =>
  new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(isoValue))

const roleLabels: Record<Role, string> = {
  admin: 'Admin',
  teacher: 'Teacher',
  student: 'Student',
}

const displayName = (profile: ProfileRow | null | undefined) => profileName(profile ?? undefined)

const initialsFor = (profile: ProfileRow | null | undefined) =>
  accountAvatarInitials(displayName(profile), profile?.email ?? profile?.student_id ?? 'WU')

const personSearchEmptyMessage = (query: string, courseId: string) => {
  const trimmedQuery = query.trim()

  if (trimmedQuery && courseId) {
    return `No people named "${trimmedQuery}" are in this course.`
  }

  if (courseId) {
    return 'No members found in this course.'
  }

  return 'No people matched your search.'
}

const inboxAccentFor = (color: InboxColorKey | null | undefined) =>
  INBOX_COLORS.find((entry) => entry.key === color)?.css ?? INBOX_COLORS[0].css

const conversationLabel = (conversation: ConversationRow) =>
  conversation.name || displayName(conversation.other_user)

const participantLabel = (participant: ConversationParticipantRow) =>
  participant.nickname || displayName(participant.user ?? undefined)

const conversationMatchesSearch = (conversation: ConversationRow, query: string) => {
  const trimmedQuery = query.trim().toLowerCase()

  if (!trimmedQuery) {
    return true
  }

  if (conversationLabel(conversation).toLowerCase().includes(trimmedQuery)) {
    return true
  }

  return conversation.participants.some((participant) => {
    const nickname = participant.nickname?.toLowerCase() ?? ''
    const name = displayName(participant.user ?? undefined).toLowerCase()

    return nickname.includes(trimmedQuery) || name.includes(trimmedQuery)
  })
}

const messageMatchesSearch = (body: string, query: string) => {
  const trimmedQuery = query.trim().toLowerCase()

  return trimmedQuery === '' || body.toLowerCase().includes(trimmedQuery)
}

const inboxMessagePreview = (message: { body: string; gif_url?: string | null }) => {
  const body = message.body.trim()

  if (body) {
    return body
  }

  if (message.gif_url) {
    return '[GIF]'
  }

  return ''
}

const canSubmitReply = (body: string, gifUrl: string) => Boolean(body.trim() || gifUrl.trim())

const renderInboxMessageBody = (
  message: { body: string; gif_url?: string | null },
  highlightQuery = '',
) => (
  <>
    {message.body.trim() !== '' && (
      <p className="inbox-bubble-text">
        {highlightQuery ? renderHighlightedBody(message.body, highlightQuery) : message.body}
      </p>
    )}
    {message.gif_url && (
      <div className="inbox-bubble-gif">
        <img src={message.gif_url} alt="GIF" loading="eager" />
      </div>
    )}
  </>
)

const renderHighlightedBody = (body: string, query: string) => {
  const trimmedQuery = query.trim()

  if (!trimmedQuery) {
    return body
  }

  const lowerBody = body.toLowerCase()
  const lowerQuery = trimmedQuery.toLowerCase()
  const parts: React.ReactNode[] = []
  let start = 0
  let index = lowerBody.indexOf(lowerQuery, start)

  while (index !== -1) {
    if (index > start) {
      parts.push(body.slice(start, index))
    }

    parts.push(
      <mark className="inbox-highlight" key={`${index}-${start}`}>
        {body.slice(index, index + trimmedQuery.length)}
      </mark>,
    )
    start = index + trimmedQuery.length
    index = lowerBody.indexOf(lowerQuery, start)
  }

  if (start < body.length) {
    parts.push(body.slice(start))
  }

  return parts.length > 0 ? parts : body
}

function InboxEllipsisIcon() {
  return (
    <svg className="inbox-settings-icon" viewBox="0 0 448 512" aria-hidden="true" focusable="false">
      <path d="M8 256a56 56 0 1 1 112 0A56 56 0 1 1 8 256zm160 0a56 56 0 1 1 112 0 56 56 0 1 1 -112 0zm216-56a56 56 0 1 1 0 112 56 56 0 1 1 0-112z" />
    </svg>
  )
}

function InboxSearchIcon() {
  return (
    <svg className="inbox-action-icon" viewBox="0 0 512 512" aria-hidden="true" focusable="false">
      <path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z" />
    </svg>
  )
}

function InboxNicknameIcon() {
  return (
    <svg className="inbox-action-icon" viewBox="0 0 512 512" aria-hidden="true" focusable="false">
      <path d="M471.6 21.7c-21.9-21.9-57.3-21.9-79.2 0L362.3 51.7l97.9 97.9 30.1-30.1c21.9-21.9 21.9-57.3 0-79.2L471.6 21.7zm-299.2 220c-6.1 6.1-10.8 13.6-13.5 21.9l-29.6 88.8c-2.9 8.6-.6 18.1 5.8 24.6s15.9 8.7 24.6 5.8l88.8-29.6c8.2-2.7 15.7-7.4 21.9-13.5L437.7 172.3 339.7 74.3 172.4 241.7zM96 64C43 64 0 107 0 160V416c0 53 43 96 96 96H352c53 0 96-43 96-96V320c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V160c0-17.7 14.3-32 32-32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H96z" />
    </svg>
  )
}

function InboxDeleteIcon() {
  return (
    <svg className="inbox-action-icon" viewBox="0 0 512 512" aria-hidden="true" focusable="false">
      <path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM175 175c9.4-9.4 24.6-9.4 33.9 0l47 47 47-47c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9l-47 47 47 47c9.4 9.4 9.4 24.6 0 33.9s-24.6 9.4-33.9 0l-47-47-47 47c-9.4 9.4-24.6 9.4-33.9 0s-9.4-24.6 0-33.9l47-47-47-47c-9.4-9.4-9.4-24.6 0-33.9z" />
    </svg>
  )
}

function InboxGroupIcon() {
  return (
    <svg className="inbox-action-icon" viewBox="0 0 640 512" aria-hidden="true" focusable="false">
      <path d="M72 88a56 56 0 1 1 112 0A56 56 0 1 1 72 88zM64 245.7C54 256.9 48 271.8 48 288s6 31.1 16 42.3V245.7zm144.4-49.3C178.7 222.7 160 261.2 160 304c0 34.3 12 65.8 32 90.5V416c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V389.2C26.2 371.2 0 332.7 0 288c0-61.9 50.1-112 112-112h32c24 0 46.2 7.5 64.4 20.3zM448 416V394.5c20-24.7 32-56.2 32-90.5c0-42.8-18.7-81.3-48.4-107.7C449.8 183.5 472 176 496 176h32c61.9 0 112 50.1 112 112c0 44.7-26.2 83.2-64 101.2V416c0 17.7-14.3 32-32 32H480c-17.7 0-32-14.3-32-32zm8-328a56 56 0 1 1 112 0A56 56 0 1 1 456 88zM576 245.7v84.7c10-11.3 16-26.1 16-42.3s-6-31.1-16-42.3zM320 32a64 64 0 1 1 0 128 64 64 0 1 1 0-128zM240 304c0 16.2 6 31 16 42.3V261.7c-10 11.3-16 26.1-16 42.3zm144-42.3v84.7c10-11.3 16-26.1 16-42.3s-6-31.1-16-42.3zM448 304c0 44.7-26.2 83.2-64 101.2V448c0 17.7-14.3 32-32 32H288c-17.7 0-32-14.3-32-32V405.2c-37.8-18-64-56.5-64-101.2c0-61.9 50.1-112 112-112h32c61.9 0 112 50.1 112 112z" />
    </svg>
  )
}

function InboxAngleUpIcon() {
  return <FontAwesomeIcon className="inbox-action-icon" icon={faAngleUp} aria-hidden="true" />
}

function InboxAngleDownIcon() {
  return <FontAwesomeIcon className="inbox-action-icon" icon={faAngleDown} aria-hidden="true" />
}

function InboxPage() {
  const { workspaceRole } = useOutletContext<{ workspaceRole: Role }>()
  const { user } = useAuthContext()
  const isAdmin = workspaceRole === 'admin'

  const [data, setData] = useState<InboxData>(emptyInbox)
  const [courses, setCourses] = useState<CourseWithMembers[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState('')
  const [rightPane, setRightPane] = useState<RightPane>('conversation')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchCourseId, setSearchCourseId] = useState('')
  const [searchResults, setSearchResults] = useState<PersonSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [replyDraft, setReplyDraft] = useState({ body: '', gifUrl: '' })
  const [showReplyGifPicker, setShowReplyGifPicker] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [conversationSearchQuery, setConversationSearchQuery] = useState('')
  const [settingsView, setSettingsView] = useState<SettingsView | null>(null)
  const [inConversationSearchQuery, setInConversationSearchQuery] = useState('')
  const [groupModalOpen, setGroupModalOpen] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [selectedGroupMemberIds, setSelectedGroupMemberIds] = useState<string[]>([])
  const [nicknameDrafts, setNicknameDrafts] = useState<Record<string, string>>({})
  const [selectedNicknameUserId, setSelectedNicknameUserId] = useState('')
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [inConversationMatchIndex, setInConversationMatchIndex] = useState(0)
  const messageRefs = useRef<Record<string, HTMLElement | null>>({})
  const messageListRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const replyFormRef = useRef<HTMLFormElement>(null)
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null)
  const replyDraftRef = useRef(replyDraft)

  replyDraftRef.current = replyDraft

  const loadInbox = useCallback(async () => {
    try {
      const next = await fetchInboxData()
      setData(next)
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Inbox could not be loaded'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadInbox(), 0)
    const intervalId = window.setInterval(() => void loadInbox(), 15000)

    return () => {
      window.clearTimeout(timeoutId)
      window.clearInterval(intervalId)
    }
  }, [loadInbox])

  useEffect(() => {
    if (isAdmin) {
      return
    }

    let active = true

    fetchWorkspaceCourses()
      .then((nextCourses) => {
        if (active) {
          setCourses(nextCourses)
        }
      })
      .catch(() => undefined)

    return () => {
      active = false
    }
  }, [isAdmin])

  const runSearch = useCallback(async (query: string, courseId: string) => {
    if (!query.trim() && !courseId) {
      setSearchResults([])
      setHasSearched(false)
      return
    }

    setSearching(true)
    setHasSearched(true)

    try {
      const results = await searchPeople(query, courseId || undefined)
      setSearchResults(results)
    } catch (searchError) {
      setError(getErrorMessage(searchError, 'People search failed'))
    } finally {
      setSearching(false)
    }
  }, [])

  const conversations = data.conversations
  const filteredConversations = useMemo(
    () => conversations.filter((conversation) => conversationMatchesSearch(conversation, conversationSearchQuery)),
    [conversations, conversationSearchQuery],
  )
  const selectedConversation =
    conversations.find((conversation) => conversation.id === selectedConversationId) ?? null
  const selectedNicknameParticipant =
    selectedConversation?.participants.find(
      (participant) => participant.user?.id === selectedNicknameUserId,
    ) ?? null
  const selectedNicknameUser = selectedNicknameParticipant?.user ?? null
  const selectedConversationAccent = inboxAccentFor(selectedConversation?.color)
  const incoming = data.connections.filter((connection) => connection.state === 'incoming_pending')
  const outgoing = data.connections.filter((connection) => connection.state === 'outgoing_pending')
  const accepted = data.connections.filter((connection) => connection.state === 'accepted')
  const groupMemberOptions = accepted
    .map((connection) => connection.other_user)
    .filter((profile): profile is ProfileRow => Boolean(profile))

  const inConversationMatchIds = useMemo(() => {
    if (!selectedConversationId || !inConversationSearchQuery.trim()) {
      return []
    }

    const conversation = conversations.find((item) => item.id === selectedConversationId)

    if (!conversation) {
      return []
    }

    return conversation.messages
      .filter((message) => messageMatchesSearch(message.body, inConversationSearchQuery))
      .map((message) => message.id)
  }, [conversations, selectedConversationId, inConversationSearchQuery])

  const scrollMessagesToBottom = useCallback(() => {
    const list = messageListRef.current

    if (!list) {
      return
    }

    list.scrollTop = list.scrollHeight
  }, [])

  useLayoutEffect(() => {
    if (
      !selectedConversationId ||
      rightPane !== 'conversation' ||
      settingsView ||
      !selectedConversation?.messages.length
    ) {
      return undefined
    }

    scrollMessagesToBottom()

    const list = messageListRef.current

    if (!list) {
      return undefined
    }

    const observer = new ResizeObserver(() => {
      scrollMessagesToBottom()
    })
    observer.observe(list)

    return () => observer.disconnect()
  }, [
    rightPane,
    scrollMessagesToBottom,
    selectedConversation?.messages.length,
    selectedConversationId,
    settingsView,
  ])

  const scrollToConversationMatch = useCallback(
    (index: number) => {
      const matchId = inConversationMatchIds[index]

      if (!matchId) {
        return
      }

      messageRefs.current[matchId]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    },
    [inConversationMatchIds],
  )

  useEffect(() => {
    if (settingsView !== 'search-in' || inConversationMatchIds.length === 0) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      scrollToConversationMatch(inConversationMatchIndex)
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [
    inConversationMatchIds,
    inConversationMatchIndex,
    scrollToConversationMatch,
    settingsView,
  ])

  const goToPreviousConversationMatch = () => {
    if (inConversationMatchIds.length === 0) {
      return
    }

    setInConversationMatchIndex((current) =>
      current <= 0 ? inConversationMatchIds.length - 1 : current - 1,
    )
  }

  const goToNextConversationMatch = () => {
    if (inConversationMatchIds.length === 0) {
      return
    }

    setInConversationMatchIndex((current) =>
      current >= inConversationMatchIds.length - 1 ? 0 : current + 1,
    )
  }

  const handleSelectConversation = (conversation: ConversationRow) => {
    setSelectedConversationId(conversation.id)
    setRightPane('conversation')
    setSettingsView(null)
    setInConversationSearchQuery('')
    setSelectedNicknameUserId('')

    if (conversation.unread) {
      setData((current) => ({
        ...current,
        conversations: current.conversations.map((item) =>
          item.id === conversation.id ? { ...item, unread: false } : item,
        ),
      }))
      void markConversationRead(conversation.id).catch(() => undefined)
    }
  }

  const handleReply = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault()

    const { body, gifUrl } = replyDraftRef.current

    if (!selectedConversationId || !canSubmitReply(body, gifUrl)) {
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    try {
      await sendInboxMessage(selectedConversationId, {
        body: body.trim(),
        gifUrl: gifUrl.trim() || undefined,
      })
      setReplyDraft({ body: '', gifUrl: '' })
      setShowReplyGifPicker(false)
      await loadInbox()
      window.requestAnimationFrame(() => scrollMessagesToBottom())
    } catch (replyError) {
      setError(getErrorMessage(replyError, 'Reply could not be sent'))
    } finally {
      setSaving(false)
    }
  }

  const handleReplyGifSelect = (gifUrl: string) => {
    setReplyDraft((current) => ({ ...current, gifUrl }))
    setShowReplyGifPicker(false)
    window.requestAnimationFrame(() => replyTextareaRef.current?.focus())
  }

  const handleOpenConversation = async (recipientId: string) => {
    setError('')
    setNotice('')

    try {
      const conversationId = await openConversation(recipientId)
      await loadInbox()
      setSelectedConversationId(conversationId)
      setRightPane('conversation')
      setSettingsView(null)
      setInConversationSearchQuery('')
      setSelectedNicknameUserId('')
    } catch (openError) {
      setError(getErrorMessage(openError, 'Conversation could not be opened'))
    }
  }

  const refreshAfterConnectionChange = async () => {
    await loadInbox()

    if (rightPane === 'search') {
      await runSearch(searchQuery, searchCourseId)
    }
  }

  const handleConnect = async (recipientId: string) => {
    setError('')
    setNotice('')

    try {
      await sendConnectionRequest(recipientId)
      setNotice('Connection request sent.')
      await refreshAfterConnectionChange()
    } catch (connectError) {
      setError(getErrorMessage(connectError, 'Connection request could not be sent'))
    }
  }

  const handleRespond = async (connectionId: string, action: 'accept' | 'decline') => {
    setError('')
    setNotice('')

    try {
      await respondToConnection(connectionId, action)
      setNotice(action === 'accept' ? 'Request accepted.' : 'Request declined.')
      await refreshAfterConnectionChange()
    } catch (respondError) {
      setError(getErrorMessage(respondError, 'Request could not be updated'))
    }
  }

  const handleCancel = async (connectionId: string) => {
    setError('')
    setNotice('')

    try {
      await cancelConnection(connectionId)
      setNotice('Request cancelled.')
      await refreshAfterConnectionChange()
    } catch (cancelError) {
      setError(getErrorMessage(cancelError, 'Request could not be cancelled'))
    }
  }

  const applyConversationUpdate = (updatedConversation: ConversationRow) => {
    setData((current) => ({
      ...current,
      conversations: current.conversations.map((conversation) =>
        conversation.id === updatedConversation.id ? updatedConversation : conversation,
      ),
    }))
  }

  const handleCreateGroup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (groupName.trim() === '' || selectedGroupMemberIds.length === 0) {
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    try {
      const conversationId = await createGroupConversation(groupName.trim(), selectedGroupMemberIds)
      await loadInbox()
      setSelectedConversationId(conversationId)
      setRightPane('conversation')
      setSettingsView(null)
      setGroupModalOpen(false)
      setGroupName('')
      setSelectedGroupMemberIds([])
      setSelectedNicknameUserId('')
      setNotice('Group chat created.')
    } catch (createError) {
      setError(getErrorMessage(createError, 'Group chat could not be created'))
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateConversationColor = async (color: InboxColorKey) => {
    if (!selectedConversationId) {
      return
    }

    setSaving(true)
    setError('')

    try {
      const updatedConversation = await updateConversation(selectedConversationId, { color })
      applyConversationUpdate(updatedConversation)
      setNotice('Conversation color updated.')
      setSettingsView('menu')
    } catch (updateError) {
      setError(getErrorMessage(updateError, 'Conversation color could not be updated'))
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteConversation = async () => {
    if (!selectedConversationId) {
      return
    }

    setSaving(true)
    setError('')

    try {
      await deleteConversation(selectedConversationId)
      setSelectedConversationId('')
      setSettingsView(null)
      setDeleteModalOpen(false)
      setInConversationSearchQuery('')
      setSelectedNicknameUserId('')
      await loadInbox()
      setNotice('Conversation removed from your inbox.')
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, 'Conversation could not be removed'))
    } finally {
      setSaving(false)
    }
  }

  const handleOpenNicknameEditor = (participant: ConversationParticipantRow) => {
    const targetUser = participant.user

    if (!targetUser) {
      return
    }

    setNicknameDrafts((current) => ({
      ...current,
      [targetUser.id]: participant.nickname ?? '',
    }))
    setSelectedNicknameUserId(targetUser.id)
  }

  const handleSaveNickname = async (targetUserId: string) => {
    if (!selectedConversationId) {
      return
    }

    const nickname = nicknameDrafts[targetUserId]?.trim() ?? ''

    setSaving(true)
    setError('')

    try {
      const updatedConversation = await setConversationNickname(
        selectedConversationId,
        targetUserId,
        nickname === '' ? null : nickname,
      )
      applyConversationUpdate(updatedConversation)
      setNotice('Nickname updated.')
      setSelectedNicknameUserId('')
    } catch (nicknameError) {
      setError(getErrorMessage(nicknameError, 'Nickname could not be updated'))
    } finally {
      setSaving(false)
    }
  }

  const toggleGroupMember = (memberId: string) => {
    setSelectedGroupMemberIds((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId],
    )
  }

  const senderLabel = (conversation: ConversationRow, senderId: string) => {
    if (senderId === user?.id) {
      return 'You'
    }

    const participant = conversation.participants.find(
      (entry) => entry.user?.id === senderId,
    )

    return participant ? participantLabel(participant) : 'Member'
  }

  const renderSettingsPanel = () => {
    if (!selectedConversation || !settingsView) {
      return null
    }

    const backToMenu = () => setSettingsView('menu')

    if (settingsView === 'menu') {
      return (
        <div className="inbox-settings-panel">
          <header className="inbox-settings-header">
            <button type="button" className="inbox-settings-back" onClick={() => setSettingsView(null)}>
              Back to chat
            </button>
            <h2>Settings</h2>
          </header>
          <div className="inbox-settings-menu">
            <button type="button" className="inbox-settings-menu-item" onClick={() => setSettingsView('color')}>
              <span>Change conversation color</span>
            </button>
            <button
              type="button"
              className="inbox-settings-menu-item"
              onClick={() => setDeleteModalOpen(true)}
            >
              <InboxDeleteIcon />
              <span>Delete conversation</span>
            </button>
            <button type="button" className="inbox-settings-menu-item" onClick={() => setSettingsView('nickname')}>
              <InboxNicknameIcon />
              <span>Change nickname</span>
            </button>
            <button type="button" className="inbox-settings-menu-item" onClick={() => setSettingsView('search-in')}>
              <InboxSearchIcon />
              <span>Search in conversation</span>
            </button>
          </div>
        </div>
      )
    }

    if (settingsView === 'color') {
      return (
        <div className="inbox-settings-panel">
          <header className="inbox-settings-header">
            <button type="button" className="inbox-settings-back" onClick={backToMenu}>
              Back
            </button>
            <h2>Change color</h2>
          </header>
          <div className="inbox-color-grid" role="list" aria-label="Conversation colors">
            {INBOX_COLORS.map((entry) => (
              <button
                key={entry.key}
                type="button"
                className={`inbox-color-swatch${
                  (selectedConversation.color ?? 'green') === entry.key ? ' inbox-color-swatch--active' : ''
                }`}
                style={{ '--inbox-swatch-color': entry.css } as React.CSSProperties}
                disabled={saving}
                onClick={() => void handleUpdateConversationColor(entry.key)}
              >
                <span>{entry.label}</span>
              </button>
            ))}
          </div>
        </div>
      )
    }

    if (settingsView === 'nickname') {
      return (
        <div className="inbox-settings-panel inbox-settings-panel--nickname">
          <header className="inbox-settings-header">
            <button type="button" className="inbox-settings-back" onClick={backToMenu}>
              Back
            </button>
            <h2>
              <InboxNicknameIcon />
              <span>Change nickname</span>
            </h2>
          </header>
          <p className="inbox-settings-copy">
            Select yourself or another member to change their nickname in this chat.
          </p>
          <div className="inbox-nickname-list" aria-label="Conversation members">
            {selectedConversation.participants.map((participant) => {
              const targetUser = participant.user

              if (!targetUser) {
                return null
              }

              return (
                <button
                  type="button"
                  className="inbox-nickname-row"
                  key={targetUser.id}
                  onClick={() => handleOpenNicknameEditor(participant)}
                >
                  <span className="inbox-avatar-sm" aria-hidden="true">
                    {initialsFor(targetUser)}
                  </span>
                  <span className="inbox-nickname-meta">
                    <strong>{displayName(targetUser)}</strong>
                    <span>{targetUser.id === user?.id ? 'You' : roleLabels[targetUser.role]}</span>
                    <span>{participant.nickname ? `Current: ${participant.nickname}` : 'No nickname yet'}</span>
                  </span>
                  <span className="inbox-nickname-action">Edit</span>
                </button>
              )
            })}
          </div>
        </div>
      )
    }

    return (
      <div className="inbox-settings-panel inbox-settings-panel--search">
        <header className="inbox-settings-header">
          <button type="button" className="inbox-settings-back" onClick={backToMenu}>
            Back
          </button>
          <h2>
            <InboxSearchIcon />
            <span>Search in conversation</span>
          </h2>
        </header>
        <div className="inbox-settings-search-bar">
          <label className="inbox-settings-search">
            <span className="sr-only">Search messages</span>
            <div className="inbox-input-with-icon">
              <InboxSearchIcon />
              <input
                value={inConversationSearchQuery}
                onChange={(event) => {
                  setInConversationSearchQuery(event.target.value)
                  setInConversationMatchIndex(0)
                }}
                placeholder='Try "di luc may gio" or "hen nhom"'
                aria-label="Search messages"
              />
            </div>
          </label>
          {inConversationMatchIds.length > 1 && (
            <div className="inbox-search-nav" aria-label="Search result navigation">
              <button
                type="button"
                className="inbox-search-nav-button"
                aria-label="Previous match"
                onClick={goToPreviousConversationMatch}
              >
                <InboxAngleUpIcon />
              </button>
              <span className="inbox-search-nav-count">
                {inConversationMatchIndex + 1} / {inConversationMatchIds.length}
              </span>
              <button
                type="button"
                className="inbox-search-nav-button"
                aria-label="Next match"
                onClick={goToNextConversationMatch}
              >
                <InboxAngleDownIcon />
              </button>
            </div>
          )}
        </div>
        <div className="inbox-message-list inbox-message-list--settings">
          {selectedConversation.messages.map((message) => {
            const isOwnMessage = message.sender_id === user?.id
            const isMatch = messageMatchesSearch(message.body, inConversationSearchQuery)
            const isActiveMatch =
              isMatch && inConversationMatchIds[inConversationMatchIndex] === message.id
            const showSenderName = selectedConversation.is_group || !isOwnMessage

            return (
              <article
                ref={(element) => {
                  messageRefs.current[message.id] = element
                }}
                className={`inbox-bubble${isOwnMessage ? ' inbox-bubble--own' : ''}${
                  isMatch ? ' inbox-bubble--match' : ''
                }${isActiveMatch ? ' inbox-bubble--match-active' : ''}`}
                key={message.id}
              >
                {showSenderName && (
                  <strong>{senderLabel(selectedConversation, message.sender_id)}</strong>
                )}
                {renderInboxMessageBody(message, inConversationSearchQuery)}
                <span>{formatMessageTime(message.created_at)}</span>
              </article>
            )
          })}

          {inConversationSearchQuery.trim() !== '' && inConversationMatchIds.length === 0 && (
            <div className="workspace-empty-state">No messages matched your search.</div>
          )}
        </div>
      </div>
    )
  }

  const renderPersonAction = (person: PersonSearchResult) => {
    if (workspaceRole === 'teacher') {
      return (
        <button type="button" onClick={() => void handleOpenConversation(person.user.id)}>
          Message
        </button>
      )
    }

    switch (person.connection_state) {
      case 'accepted':
        return (
          <button type="button" onClick={() => void handleOpenConversation(person.user.id)}>
            Message
          </button>
        )
      case 'outgoing_pending':
        return <span className="inbox-pill">Requested</span>
      case 'incoming_pending': {
        const connectionId = person.connection_id

        return connectionId ? (
          <button type="button" onClick={() => void handleRespond(connectionId, 'accept')}>
            Accept
          </button>
        ) : null
      }
      default:
        return (
          <button type="button" onClick={() => void handleConnect(person.user.id)}>
            Connect
          </button>
        )
    }
  }

  const renderPersonRow = (profile: ProfileRow, meta: string, action: React.ReactNode) => (
    <div className="inbox-person" key={profile.id}>
      <span className="inbox-avatar-sm" aria-hidden="true">
        {initialsFor(profile)}
      </span>
      <div className="inbox-person-body">
        <strong>{displayName(profile)}</strong>
        <span>{meta}</span>
      </div>
      <div className="inbox-person-action">{action}</div>
    </div>
  )

  const personMeta = (person: PersonSearchResult) => {
    const parts = [roleLabels[person.user.role]]

    if (person.user.student_id) {
      parts.push(person.user.student_id)
    }

    if (person.shared) {
      parts.push('shares a course')
    }

    return parts.join(' \u00b7 ')
  }

  return (
    <section className="workspace-page inbox-workspace">
      <header className="workspace-page-header">
        <span className="workspace-eyebrow">Workspace</span>
        <h1 className="workspace-page-title">Inbox</h1>
        <p className="workspace-page-subtitle">
          Message classmates and teachers. Students connect first, then chat; teachers can reach
          anyone.
        </p>
      </header>

      <WorkspaceAlertStack
        error={error}
        notice={notice}
        onDismissError={() => setError('')}
        onDismissNotice={() => setNotice('')}
      />

      {loading ? (
        <section className="workspace-panel">Loading inbox...</section>
      ) : (
        <section
          className="workspace-panel inbox-shell"
          style={
            selectedConversation && rightPane === 'conversation'
              ? ({
                  '--inbox-accent': selectedConversationAccent,
                  '--inbox-accent-hover': selectedConversationAccent,
                } as React.CSSProperties)
              : undefined
          }
        >
          <div className="inbox-sidebar">
            {!isAdmin && (
              <>
                <div className="inbox-sidebar-actions">
                  <button
                    type="button"
                    className="inbox-create-group-button"
                    onClick={() => setGroupModalOpen(true)}
                  >
                    <InboxGroupIcon />
                    <span>Create group</span>
                  </button>
                  <label className="inbox-conversation-search">
                    <span className="sr-only">Search conversations</span>
                    <div className="inbox-input-with-icon">
                      <InboxSearchIcon />
                      <input
                        value={conversationSearchQuery}
                        onChange={(event) => setConversationSearchQuery(event.target.value)}
                        placeholder="Search conversations"
                        aria-label="Search conversations"
                      />
                    </div>
                  </label>
                </div>
                <div className="inbox-toolbar">
                <button
                  type="button"
                  className={`inbox-tab${rightPane === 'search' ? ' inbox-tab--active' : ''}`}
                  onClick={() => setRightPane('search')}
                >
                  Find people
                </button>
                <button
                  type="button"
                  className={`inbox-tab${rightPane === 'requests' ? ' inbox-tab--active' : ''}`}
                  onClick={() => setRightPane('requests')}
                >
                  Requests
                  {incoming.length > 0 && <span className="inbox-badge">{incoming.length}</span>}
                </button>
              </div>
              </>
            )}

            <div className="inbox-thread-list" aria-label="Conversations">
              {filteredConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  className={`inbox-thread${conversation.is_group ? ' inbox-thread--group' : ' inbox-thread--dm'}${
                    selectedConversationId === conversation.id && rightPane === 'conversation'
                      ? ' inbox-thread--active'
                      : ''
                  }`}
                  onClick={() => handleSelectConversation(conversation)}
                >
                  <span className="inbox-avatar-sm" aria-hidden="true">
                    {conversation.is_group
                      ? accountAvatarInitials(conversationLabel(conversation), 'GR')
                      : initialsFor(conversation.other_user)}
                  </span>
                  <span className="inbox-thread-body">
                    <span className="inbox-thread-name">
                      {conversationLabel(conversation)}
                      {conversation.unread && (
                        <span className="inbox-unread-dot" aria-label="Unread messages" />
                      )}
                    </span>
                    <span className="inbox-thread-preview">
                      {conversation.last_message
                        ? inboxMessagePreview(conversation.last_message)
                        : 'No messages yet'}
                    </span>
                  </span>
                </button>
              ))}

              {filteredConversations.length === 0 && (
                <div className="workspace-empty-state">
                  {conversations.length === 0
                    ? isAdmin
                      ? 'No conversations.'
                      : 'No conversations yet. Use Find people to start one.'
                    : 'No conversations matched your search.'}
                </div>
              )}
            </div>
          </div>

          <div className="inbox-conversation" aria-label="Conversation">
            {isAdmin ? (
              <div className="workspace-empty-state">
                Direct messaging is for students and teachers.
              </div>
            ) : rightPane === 'search' ? (
              <>
                <header className="inbox-conversation-header">
                  <h2>Find people</h2>
                  <p>Search students and teachers by name, student ID, or email, or browse a course.</p>
                </header>
                <div className="inbox-search">
                  <form
                    className="workspace-form inbox-search-form"
                    onSubmit={(event) => {
                      event.preventDefault()
                      void runSearch(searchQuery, searchCourseId)
                    }}
                  >
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Name, student ID, or email"
                      aria-label="Search people"
                    />
                    <select
                      value={searchCourseId}
                      onChange={(event) => {
                        const nextCourseId = event.target.value
                        setSearchCourseId(nextCourseId)
                        void runSearch(searchQuery, nextCourseId)
                      }}
                      aria-label="Browse a course"
                    >
                      <option value="">Browse a course...</option>
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {courseLabel(course)}
                        </option>
                      ))}
                    </select>
                    <button type="submit" disabled={searching}>
                      {searching ? 'Searching...' : 'Search'}
                    </button>
                  </form>

                  <div className="inbox-search-results">
                    {searchResults.map((person) =>
                      renderPersonRow(person.user, personMeta(person), renderPersonAction(person)),
                    )}

                    {!searching && hasSearched && searchResults.length === 0 && (
                      <div className="workspace-empty-state">
                        {personSearchEmptyMessage(searchQuery, searchCourseId)}
                      </div>
                    )}

                    {!hasSearched && (
                      <div className="workspace-empty-state">
                        Search by name, student ID, or email, or pick a course to see its members.
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : rightPane === 'requests' ? (
              <>
                <header className="inbox-conversation-header">
                  <h2>Requests and connections</h2>
                  <p>Accept people to start chatting with them.</p>
                </header>
                <div className="inbox-requests">
                  <section className="inbox-requests-group">
                    <h3>Incoming requests</h3>
                    {incoming.length === 0 ? (
                      <div className="workspace-empty-state">No incoming requests.</div>
                    ) : (
                      incoming.map((connection) => {
                        const otherUser = connection.other_user

                        if (!otherUser) {
                          return null
                        }

                        return renderPersonRow(
                          otherUser,
                          roleLabels[otherUser.role],
                          <div className="inbox-person-buttons">
                            <button
                              type="button"
                              onClick={() => void handleRespond(connection.id, 'accept')}
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              className="inbox-button-ghost"
                              onClick={() => void handleRespond(connection.id, 'decline')}
                            >
                              Decline
                            </button>
                          </div>,
                        )
                      })
                    )}
                  </section>

                  <section className="inbox-requests-group">
                    <h3>Sent requests</h3>
                    {outgoing.length === 0 ? (
                      <div className="workspace-empty-state">No pending sent requests.</div>
                    ) : (
                      outgoing.map((connection) => {
                        const otherUser = connection.other_user

                        if (!otherUser) {
                          return null
                        }

                        return renderPersonRow(
                          otherUser,
                          roleLabels[otherUser.role],
                          <button
                            type="button"
                            className="inbox-button-ghost"
                            onClick={() => void handleCancel(connection.id)}
                          >
                            Cancel
                          </button>,
                        )
                      })
                    )}
                  </section>

                  <section className="inbox-requests-group">
                    <h3>Connections</h3>
                    {accepted.length === 0 ? (
                      <div className="workspace-empty-state">No connections yet.</div>
                    ) : (
                      accepted.map((connection) => {
                        const otherUser = connection.other_user

                        if (!otherUser) {
                          return null
                        }

                        return renderPersonRow(
                          otherUser,
                          roleLabels[otherUser.role],
                          <button
                            type="button"
                            onClick={() => void handleOpenConversation(otherUser.id)}
                          >
                            Message
                          </button>,
                        )
                      })
                    )}
                  </section>
                </div>
              </>
            ) : selectedConversation && settingsView ? (
              renderSettingsPanel()
            ) : selectedConversation ? (
              <>
                <header className="inbox-conversation-header inbox-conversation-header--with-settings">
                  <div>
                    <h2>{conversationLabel(selectedConversation)}</h2>
                    <p>
                      {selectedConversation.is_group
                        ? `${selectedConversation.participants.length} members`
                        : selectedConversation.other_user
                          ? roleLabels[selectedConversation.other_user.role]
                          : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="inbox-settings-button"
                    aria-label="Conversation settings"
                    onClick={() => setSettingsView('menu')}
                  >
                    <InboxEllipsisIcon />
                  </button>
                </header>

                <div className="inbox-message-list" ref={messageListRef}>
                  {selectedConversation.messages.map((message) => {
                    const isOwnMessage = message.sender_id === user?.id
                    const showSenderName = selectedConversation.is_group || !isOwnMessage

                    return (
                      <article
                        className={`inbox-bubble${isOwnMessage ? ' inbox-bubble--own' : ''}`}
                        key={message.id}
                      >
                        {showSenderName && (
                          <strong>{senderLabel(selectedConversation, message.sender_id)}</strong>
                        )}
                        {renderInboxMessageBody(message)}
                        <span>{formatMessageTime(message.created_at)}</span>
                      </article>
                    )
                  })}

                  {selectedConversation.messages.length === 0 && (
                    <div className="workspace-empty-state">
                      No messages yet. Say hello to start the conversation.
                    </div>
                  )}
                  <div ref={messagesEndRef} aria-hidden="true" />
                </div>

                <form
                  ref={replyFormRef}
                  className="workspace-form inbox-reply-form"
                  onSubmit={(event) => void handleReply(event)}
                >
                  <div className="inbox-reply-row">
                    <div className="inbox-reply-composer">
                      <label className="sr-only" htmlFor="inbox-reply-textarea">
                        Reply
                      </label>
                      {replyDraft.gifUrl.trim() !== '' && (
                        <div className="inbox-reply-composer-gif">
                          <img src={replyDraft.gifUrl.trim()} alt="Selected GIF" />
                          <button
                            type="button"
                            className="inbox-reply-composer-gif-remove"
                            aria-label="Remove GIF"
                            onClick={() =>
                              setReplyDraft((current) => ({ ...current, gifUrl: '' }))
                            }
                          >
                            ×
                          </button>
                        </div>
                      )}
                      <textarea
                        id="inbox-reply-textarea"
                        ref={replyTextareaRef}
                        value={replyDraft.body}
                        onChange={(event) =>
                          setReplyDraft((current) => ({ ...current, body: event.target.value }))
                        }
                        onKeyDown={(event) =>
                          handleEnterToSubmit(event, () => replyFormRef.current?.requestSubmit(), {
                            canSubmit:
                              !saving && canSubmitReply(replyDraft.body, replyDraft.gifUrl),
                          })
                        }
                        placeholder="Write a message..."
                        rows={1}
                      />
                      <button
                        type="button"
                        className={`inbox-reply-gif-button${
                          showReplyGifPicker || replyDraft.gifUrl
                            ? ' inbox-reply-gif-button--active'
                            : ''
                        }`}
                        aria-label="Add GIF to message"
                        aria-pressed={showReplyGifPicker}
                        onClick={() => setShowReplyGifPicker((current) => !current)}
                      >
                        GIF
                      </button>
                    </div>
                    <button
                      type="submit"
                      className="inbox-send-button"
                      disabled={saving || !canSubmitReply(replyDraft.body, replyDraft.gifUrl)}
                      aria-label={saving ? 'Sending message' : 'Send message'}
                    >
                      <svg
                        className="inbox-send-icon"
                        viewBox="0 0 512 512"
                        aria-hidden="true"
                        focusable="false"
                      >
                        <path d="M498.1 5.6c10.1 7 15.4 19.1 13.5 31.2l-64 416c-1.5 9.7-7.4 18.2-16 23s-18.9 5.4-28 .9L284 415.8l-68.5 74.1c-8.9 9.7-22.9 12.9-35.2 8.1S160 481.2 160 468V364.6L30.8 298.9C19.4 293.1 12.4 281.2 13 268.4s8.5-24.1 20.5-28.7l448-192c11.2-4.8 24.2-3 34.6 4.9zM432 80L192 323.2V432l52.7-56.9c6.7-7.2 17.2-9.4 26.2-5.3L405 448 432 80z" />
                      </svg>
                    </button>
                  </div>
                  {showReplyGifPicker && (
                    <GiphyPicker
                      open={showReplyGifPicker}
                      onClose={() => setShowReplyGifPicker(false)}
                      onError={setError}
                      onSelect={handleReplyGifSelect}
                    />
                  )}
                </form>
              </>
            ) : (
              <div className="workspace-empty-state">
                Select a conversation, or use Find people to start a new one.
              </div>
            )}
          </div>
        </section>
      )}

      {deleteModalOpen && selectedConversation && (
        <div className="inbox-modal-backdrop" role="presentation" onClick={() => setDeleteModalOpen(false)}>
          <div
            className="inbox-modal inbox-modal--confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="inbox-delete-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="inbox-modal-header">
              <h2 id="inbox-delete-modal-title">
                <InboxDeleteIcon />
                <span>Delete conversation</span>
              </h2>
            </header>
            <p className="inbox-settings-copy">
              This removes the conversation from your inbox. Other people will still keep their
              messages.
            </p>
            <div className="inbox-modal-actions">
              <button type="button" className="inbox-settings-back" onClick={() => setDeleteModalOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="inbox-modal-danger"
                disabled={saving}
                onClick={() => void handleDeleteConversation()}
              >
                {saving ? 'Removing...' : 'Delete conversation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedNicknameParticipant && selectedNicknameUser && (
        <div className="inbox-modal-backdrop" role="presentation" onClick={() => setSelectedNicknameUserId('')}>
          <form
            className="inbox-modal inbox-nickname-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="inbox-nickname-modal-title"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault()
              void handleSaveNickname(selectedNicknameUser.id)
            }}
          >
            <header className="inbox-modal-header">
              <h2 id="inbox-nickname-modal-title">
                <InboxNicknameIcon />
                <span>Change nickname</span>
              </h2>
            </header>
            <div className="inbox-nickname-modal-person">
              <span className="inbox-avatar-sm" aria-hidden="true">
                {initialsFor(selectedNicknameUser)}
              </span>
              <div className="inbox-nickname-meta">
                <strong>{displayName(selectedNicknameUser)}</strong>
                <span>
                  {selectedNicknameParticipant.nickname
                    ? `Current: ${selectedNicknameParticipant.nickname}`
                    : 'No nickname yet'}
                </span>
              </div>
            </div>
            <label className="inbox-nickname-modal-field">
              <span>Nickname in this chat</span>
              <input
                autoFocus
                value={
                  nicknameDrafts[selectedNicknameUser.id] ??
                  selectedNicknameParticipant.nickname ??
                  ''
                }
                onChange={(event) =>
                  setNicknameDrafts((current) => ({
                    ...current,
                    [selectedNicknameUser.id]: event.target.value,
                  }))
                }
                placeholder="Nickname in this chat"
                aria-label={`Nickname for ${displayName(selectedNicknameUser)}`}
              />
            </label>
            <div className="inbox-modal-actions">
              <button type="button" className="inbox-settings-back" onClick={() => setSelectedNicknameUserId('')}>
                Cancel
              </button>
              <button type="submit" className="inbox-nickname-save" disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {groupModalOpen && !isAdmin && (
        <div className="inbox-modal-backdrop" role="presentation" onClick={() => setGroupModalOpen(false)}>
          <div
            className="inbox-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="inbox-group-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="inbox-modal-header">
              <h2 id="inbox-group-modal-title">
                <InboxGroupIcon />
                <span>Create group chat</span>
              </h2>
              <button type="button" className="inbox-button-ghost" onClick={() => setGroupModalOpen(false)}>
                Close
              </button>
            </header>
            <form className="workspace-form inbox-group-form" onSubmit={(event) => void handleCreateGroup(event)}>
              <label>
                <span>Group name</span>
                <input
                  value={groupName}
                  onChange={(event) => setGroupName(event.target.value)}
                  placeholder="Study group, project team..."
                  required
                />
              </label>
              <fieldset className="inbox-group-members">
                <legend>Add members from your connections</legend>
                {groupMemberOptions.length === 0 ? (
                  <div className="workspace-empty-state">Accept connections first to create a group.</div>
                ) : (
                  groupMemberOptions.map((member) => (
                    <label className="inbox-group-member" key={member.id}>
                      <input
                        type="checkbox"
                        checked={selectedGroupMemberIds.includes(member.id)}
                        onChange={() => toggleGroupMember(member.id)}
                      />
                      <span>{displayName(member)}</span>
                    </label>
                  ))
                )}
              </fieldset>
              <button
                type="submit"
                disabled={saving || groupName.trim() === '' || selectedGroupMemberIds.length === 0}
              >
                {saving ? 'Creating...' : 'Create group'}
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}

export default InboxPage
