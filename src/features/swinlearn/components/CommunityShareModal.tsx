import { useCallback, useEffect, useMemo, useState } from 'react'

import type { Role } from '../../../hooks/useAuth'
import {
  fetchInboxData,
  getErrorMessage,
  profileName,
  searchPeople,
  shareCommunityPost,
} from '../lib/workspace/api'
import type { CommunityPostRow, ConversationRow, PersonSearchResult } from '../lib/workspace/types'
import { ProfileAvatar } from './ProfileAvatar'
import { buildCourseDetailPath } from '../pages/shared/courseDetailSections'

type ShareTab = 'chats' | 'search'

type CommunityShareModalProps = {
  courseCode: string
  courseId: string
  courseMemberIds: string[]
  onClose: () => void
  onError: (message: string) => void
  onSuccess: (message: string) => void
  post: CommunityPostRow
  workspaceRole: Role
}

const buildSharePath = (workspaceRole: Role, courseId: string, postId: string) => {
  const relativePath = `${buildCourseDetailPath(workspaceRole, courseId, 'community')}#post-${postId}`

  if (typeof window === 'undefined') {
    return relativePath
  }

  return `${window.location.origin}${relativePath}`
}

export function CommunityShareModal({
  courseCode,
  courseId,
  courseMemberIds,
  onClose,
  onError,
  onSuccess,
  post,
  workspaceRole,
}: CommunityShareModalProps) {
  const [activeTab, setActiveTab] = useState<ShareTab>('chats')
  const [conversations, setConversations] = useState<ConversationRow[]>([])
  const [loadingChats, setLoadingChats] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<PersonSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [sharingRecipientId, setSharingRecipientId] = useState<string | null>(null)

  const memberIdSet = useMemo(() => new Set(courseMemberIds), [courseMemberIds])
  const sharePath = useMemo(
    () => buildSharePath(workspaceRole, courseId, post.id),
    [courseId, post.id, workspaceRole],
  )

  const classmateConversations = useMemo(
    () =>
      conversations.filter(
        (conversation) =>
          conversation.other_user && memberIdSet.has(conversation.other_user.id),
      ),
    [conversations, memberIdSet],
  )

  const loadChats = useCallback(async () => {
    setLoadingChats(true)

    try {
      const inbox = await fetchInboxData()
      setConversations(inbox.conversations)
    } catch (loadError) {
      onError(getErrorMessage(loadError, 'Conversations could not be loaded'))
    } finally {
      setLoadingChats(false)
    }
  }, [onError])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadChats(), 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadChats])

  const runSearch = useCallback(
    async (query: string) => {
      setSearching(true)

      try {
        const results = await searchPeople(query, courseId)
        setSearchResults(results)
      } catch (searchError) {
        onError(getErrorMessage(searchError, 'Classmates could not be searched'))
      } finally {
        setSearching(false)
      }
    },
    [courseId, onError],
  )

  useEffect(() => {
    if (activeTab !== 'search') {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      void runSearch(searchQuery)
    }, 250)

    return () => window.clearTimeout(timeoutId)
  }, [activeTab, runSearch, searchQuery])

  const handleShare = async (recipientId: string) => {
    setSharingRecipientId(recipientId)
    onError('')

    try {
      await shareCommunityPost(courseId, post.id, recipientId, sharePath)
      onSuccess('Post shared in inbox.')
    } catch (shareError) {
      onError(getErrorMessage(shareError, 'Post could not be shared'))
    } finally {
      setSharingRecipientId(null)
    }
  }

  return (
    <div className="workspace-modal-backdrop" onClick={sharingRecipientId ? undefined : onClose}>
      <div
        className="workspace-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="community-share-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="workspace-modal-header">
          <div>
            <h2 id="community-share-title">Share post</h2>
            <p>
              Send this community post to a classmate via inbox. Only people enrolled in {courseCode}{' '}
              can receive it.
            </p>
          </div>
          <button
            type="button"
            className="workspace-modal-close"
            aria-label="Close"
            disabled={Boolean(sharingRecipientId)}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="course-detail-community-share-tabs">
          <button
            type="button"
            className={`course-detail-community-share-tab${activeTab === 'chats' ? ' course-detail-community-share-tab--active' : ''}`}
            onClick={() => setActiveTab('chats')}
          >
            Recent chats
          </button>
          <button
            type="button"
            className={`course-detail-community-share-tab${activeTab === 'search' ? ' course-detail-community-share-tab--active' : ''}`}
            onClick={() => setActiveTab('search')}
          >
            Find classmate
          </button>
        </div>

        {activeTab === 'chats' ? (
          loadingChats ? (
            <p>Loading conversations...</p>
          ) : classmateConversations.length === 0 ? (
            <p className="workspace-empty-state">
              No inbox chats with classmates yet. Use Find classmate to start one.
            </p>
          ) : (
            <div className="course-detail-community-share-modal-list">
              {classmateConversations.map((conversation) => {
                const recipient = conversation.other_user

                if (!recipient) {
                  return null
                }

                const sharing = sharingRecipientId === recipient.id

                return (
                  <button
                    key={conversation.id}
                    type="button"
                    className="course-detail-community-share-modal-item"
                    disabled={Boolean(sharingRecipientId)}
                    onClick={() => void handleShare(recipient.id)}
                  >
                    <span className="course-detail-community-share-modal-item-main">
                      <ProfileAvatar profile={recipient} />
                      <span>{profileName(recipient)}</span>
                    </span>
                    <span>{sharing ? 'Sharing...' : 'Share'}</span>
                  </button>
                )
              })}
            </div>
          )
        ) : (
          <>
            <label>
              <span className="sr-only">Search classmates</span>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by name or email..."
              />
            </label>

            {searching ? (
              <p>Searching...</p>
            ) : searchResults.length === 0 ? (
              <p className="workspace-empty-state">
                {searchQuery.trim()
                  ? `No classmates matched "${searchQuery.trim()}".`
                  : 'Type a name to find classmates in this course.'}
              </p>
            ) : (
              <div className="course-detail-community-share-modal-list">
                {searchResults.map((person) => {
                  const sharing = sharingRecipientId === person.user.id

                  return (
                    <button
                      key={person.user.id}
                      type="button"
                      className="course-detail-community-share-modal-item"
                      disabled={Boolean(sharingRecipientId)}
                      onClick={() => void handleShare(person.user.id)}
                    >
                      <span className="course-detail-community-share-modal-item-main">
                        <ProfileAvatar profile={person.user} />
                        <span>{profileName(person.user)}</span>
                      </span>
                      <span>{sharing ? 'Sharing...' : 'Share'}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
