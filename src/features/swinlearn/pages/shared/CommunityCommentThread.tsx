import { useEffect, useId, useMemo, useState } from 'react'

import {
  createCommunityComment,
  deleteCommunityComment,
  getErrorMessage,
  toggleCommunityCommentLike,
} from '../../lib/workspace/api'
import type { CommunityCommentRow, CommunityImageRow } from '../../lib/workspace/types'
import { CommunityAuthorHeader } from '../../components/CommunityAuthorHeader'
import { CommunityConfirmDialog } from '../../components/CommunityConfirmDialog'
import { CommunityVoteButton } from '../../components/CommunityVoteButton'
import { GiphyPicker } from '../../components/GiphyPicker'

const maxImagesPerComment = 4
const communityCommentUploadAccept = '.doc,.docx,.pdf,.zip,image/*'
const communityCommentDocumentExtensions = ['.doc', '.docx', '.pdf', '.zip']
const communityCommentDocumentMimeTypes = new Set([
  'application/msword',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/x-zip-compressed',
  'application/zip',
])
const communityImageExtensionPattern = /\.(gif|jpe?g|png|webp)$/i

type CommentDraft = {
  body: string
  gifUrl: string
  images: File[]
}

const emptyDraft = (): CommentDraft => ({
  body: '',
  gifUrl: '',
  images: [],
})

const draftKey = (postId: string, parentId?: string) =>
  parentId ? `reply:${parentId}` : `post:${postId}`

const canSubmitDraft = (draft: CommentDraft) =>
  Boolean(draft.body.trim() || draft.images.length > 0 || draft.gifUrl.trim())

const isImageFile = (file: File) =>
  file.type.startsWith('image/') || communityImageExtensionPattern.test(file.name)

const isAcceptedCommunityCommentFile = (file: File) => {
  const name = file.name.toLowerCase()

  return (
    isImageFile(file) ||
    communityCommentDocumentExtensions.some((extension) => name.endsWith(extension)) ||
    communityCommentDocumentMimeTypes.has(file.type.toLowerCase())
  )
}

const isCommunityImageAttachment = (attachment: CommunityImageRow) =>
  String(attachment.mime_type ?? '').toLowerCase().startsWith('image/') ||
  communityImageExtensionPattern.test(attachment.original_name)

function CommunityMediaIcon({ kind }: { kind: 'file' | 'gif' }) {
  if (kind === 'gif') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M5.5 4.5h13A2.5 2.5 0 0 1 21 7v10a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17V7a2.5 2.5 0 0 1 2.5-2.5Zm.25 3.25v8.5h12.5v-8.5H5.75Zm5 2.22 3.7 2.03-3.7 2.03V9.97Z"
          fill="currentColor"
        />
        <path d="M7 3v3M11 3v3M15 3v3M19 3v3M7 18v3M11 18v3M15 18v3M19 18v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 576 512" aria-hidden="true" focusable="false">
      <path
        d="M0 64C0 28.7 28.7 0 64 0h160v128c0 17.7 14.3 32 32 32h128v38.6C310.1 219.5 256 287.4 256 368c0 59.1 29.1 111.3 73.7 143.3-3.2.5-6.4.7-9.7.7H64c-35.3 0-64-28.7-64-64V64zm384 64H256V0l128 128zm48 96a144 144 0 1 1 0 288 144 144 0 1 1 0-288zm16 80c0-8.8-7.2-16-16-16s-16 7.2-16 16v48h-48c-8.8 0-16 7.2-16 16s7.2 16 16 16h48v48c0 8.8 7.2 16 16 16s16-7.2 16-16v-48h48c8.8 0 16-7.2 16-16s-7.2-16-16-16h-48v-48z"
        fill="currentColor"
      />
    </svg>
  )
}

type CommunityCommentThreadProps = {
  comments: CommunityCommentRow[]
  courseId: string
  onError: (message: string) => void
  onImagePreview: (images: CommunityImageRow[], index: number) => void
  onRefresh: () => Promise<void>
  postAuthorId: string
  postId: string
  saving: boolean
  setSaving: (saving: boolean) => void
}

function CommunityCommentComposer({
  draft,
  onChange,
  onError,
  onSubmit,
  placeholder,
  saving,
  submitLabel,
}: {
  draft: CommentDraft
  onChange: (draft: CommentDraft) => void
  onError: (message: string) => void
  onSubmit: () => Promise<void>
  placeholder: string
  saving: boolean
  submitLabel: string
}) {
  const [showImageTools, setShowImageTools] = useState(false)
  const [showGifPicker, setShowGifPicker] = useState(false)
  const commentInputId = useId()
  const previews = useMemo(
    () => draft.images.map((file) => (isImageFile(file) ? URL.createObjectURL(file) : null)),
    [draft.images],
  )

  useEffect(
    () => () => {
      for (const preview of previews) {
        if (preview) {
          URL.revokeObjectURL(preview)
        }
      }
    },
    [previews],
  )

  const addFiles = (files: File[]) => {
    const acceptedFiles = files.filter(isAcceptedCommunityCommentFile)

    if (acceptedFiles.length === 0) {
      return
    }

    setShowImageTools(true)
    onChange({
      ...draft,
      images: [...draft.images, ...acceptedFiles].slice(0, maxImagesPerComment),
    })
  }

  return (
    <form
      className="workspace-form course-detail-community-comment-composer"
      onSubmit={(event) => {
        event.preventDefault()
        void onSubmit()
      }}
    >
      <div className="course-detail-community-entry-row">
        <div className="course-detail-community-input-shell">
          <label className="sr-only" htmlFor={commentInputId}>
            Comment
          </label>
          <textarea
            id={commentInputId}
            value={draft.body}
            onChange={(event) => onChange({ ...draft, body: event.target.value })}
            onPaste={(event) => {
              const imageFiles = Array.from(event.clipboardData.items)
                .filter((item) => item.type.startsWith('image/'))
                .map((item) => item.getAsFile())
                .filter((file): file is File => file !== null)

              if (imageFiles.length === 0) {
                return
              }

              event.preventDefault()
              addFiles(imageFiles)
            }}
            placeholder={placeholder}
            rows={1}
          />
          <div className="course-detail-community-placeholder-icons">
            <button
              type="button"
              className={`course-detail-community-icon-action${showImageTools ? ' course-detail-community-icon-action--active' : ''}`}
              aria-label="Add file to comment"
              aria-pressed={showImageTools}
              onClick={() => setShowImageTools((current) => !current)}
            >
              <CommunityMediaIcon kind="file" />
            </button>
            <button
              type="button"
              className={`course-detail-community-icon-action${showGifPicker || draft.gifUrl ? ' course-detail-community-icon-action--active' : ''}`}
              aria-label="Add GIF to comment"
              aria-pressed={showGifPicker}
              onClick={() => setShowGifPicker((current) => !current)}
            >
              <CommunityMediaIcon kind="gif" />
            </button>
          </div>
        </div>

        <button
          type="submit"
          className="course-detail-community-submit"
          disabled={saving || !canSubmitDraft(draft)}
        >
          {saving ? 'Posting...' : submitLabel}
        </button>
      </div>

      {showGifPicker && (
        <GiphyPicker
          open={showGifPicker}
          onClose={() => setShowGifPicker(false)}
          onError={onError}
          onSelect={(gifUrl) => onChange({ ...draft, gifUrl })}
        />
      )}

      {showImageTools && (
        <div className="course-detail-community-composer-tools">
          <label className="course-detail-community-upload">
            <span>Add files</span>
            <input
              type="file"
              accept={communityCommentUploadAccept}
              multiple
              disabled={draft.images.length >= maxImagesPerComment}
              onChange={(event) => {
                addFiles(Array.from(event.target.files ?? []))
                event.target.value = ''
              }}
            />
          </label>
          <span className="workspace-chip">
            {draft.images.length}/{maxImagesPerComment} files
          </span>
        </div>
      )}

      {draft.gifUrl.trim() && (
        <div className="course-detail-community-gif-preview">
          <img src={draft.gifUrl.trim()} alt="Selected GIF" />
          <button
            type="button"
            className="course-detail-community-delete"
            onClick={() => onChange({ ...draft, gifUrl: '' })}
          >
            Remove GIF
          </button>
        </div>
      )}

      {draft.images.length > 0 && (
        <div className="course-detail-community-pending-images" aria-label="Files to upload">
          {draft.images.map((file, index) => (
            <figure className="course-detail-community-pending-image" key={`${file.name}-${index}`}>
              {previews[index] ? (
                <img src={previews[index] ?? undefined} alt={file.name || `Image ${index + 1}`} />
              ) : (
                <div className="course-detail-community-pending-file">
                  <CommunityMediaIcon kind="file" />
                  <span>{file.name || `File ${index + 1}`}</span>
                </div>
              )}
              <button
                type="button"
                className="course-detail-community-delete"
                onClick={() =>
                  onChange({
                    ...draft,
                    images: draft.images.filter((_, itemIndex) => itemIndex !== index),
                  })
                }
              >
                Remove
              </button>
            </figure>
          ))}
        </div>
      )}
    </form>
  )
}

function CommunityCommentItem({
  comment,
  courseId,
  drafts,
  onDraftChange,
  onError,
  onImagePreview,
  onLike,
  onRefresh,
  onReplyToggle,
  onRequestDelete,
  postAuthorId,
  postId,
  replyOpenId,
  saving,
  setSaving,
}: {
  comment: CommunityCommentRow
  courseId: string
  drafts: Record<string, CommentDraft>
  onDraftChange: (key: string, draft: CommentDraft) => void
  onError: (message: string) => void
  onImagePreview: (images: CommunityImageRow[], index: number) => void
  onLike: (commentId: string) => Promise<void>
  onRefresh: () => Promise<void>
  onReplyToggle: (commentId: string | null) => void
  onRequestDelete: (commentId: string) => void
  postAuthorId: string
  postId: string
  replyOpenId: string | null
  saving: boolean
  setSaving: (saving: boolean) => void
}) {
  const key = draftKey(postId, comment.id)
  const draft = drafts[key] ?? emptyDraft()
  const isReplyOpen = replyOpenId === comment.id
  const imageAttachments = comment.images.filter(isCommunityImageAttachment)
  const fileAttachments = comment.images.filter((attachment) => !isCommunityImageAttachment(attachment))

  const submitReply = async () => {
    if (!canSubmitDraft(draft)) {
      return
    }

    setSaving(true)

    try {
      await createCommunityComment(courseId, postId, {
        body: draft.body.trim(),
        gifUrl: draft.gifUrl.trim() || undefined,
        images: draft.images,
        parentId: comment.id,
      })
      onDraftChange(key, emptyDraft())
      onReplyToggle(null)
      await onRefresh()
    } catch (submitError) {
      onError(getErrorMessage(submitError, 'Reply could not be published'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    onRequestDelete(comment.id)
  }

  return (
    <div className="course-detail-community-thread-item">
      <CommunityAuthorHeader
        author={comment.author}
        badge={comment.author_id === postAuthorId ? 'OP' : undefined}
        createdAt={comment.created_at}
      />

      <div className="course-detail-community-body">
        {comment.body && <p className="course-detail-community-comment-body">{comment.body}</p>}

        {comment.gif_url && (
          <div className="course-detail-community-gif">
            <img src={comment.gif_url} alt="GIF" loading="lazy" />
          </div>
        )}

        {imageAttachments.length > 0 && (
          <div className="course-detail-community-images">
            {imageAttachments.map((image, imageIndex) => (
              <button
                key={image.id}
                type="button"
                className="course-detail-community-image-button"
                aria-label={`View ${image.original_name}`}
                onClick={() => onImagePreview(imageAttachments, imageIndex)}
              >
                <img className="course-detail-community-image" src={image.public_url} alt={image.original_name} />
              </button>
            ))}
          </div>
        )}

        {fileAttachments.length > 0 && (
          <div className="course-detail-community-files" aria-label="Comment files">
            {fileAttachments.map((file) => (
              <a
                key={file.id}
                className="course-detail-community-file-link"
                href={file.public_url}
                target="_blank"
                rel="noreferrer"
              >
                <CommunityMediaIcon kind="file" />
                <span>{file.original_name}</span>
              </a>
            ))}
          </div>
        )}
      </div>

      <footer className="course-detail-community-toolbar course-detail-community-toolbar--comment">
        <CommunityVoteButton
          active={comment.liked_by_me}
          count={comment.like_count}
          onClick={() => void onLike(comment.id)}
        />
        <button
          type="button"
          className="course-detail-community-toolbar-btn"
          onClick={() => onReplyToggle(isReplyOpen ? null : comment.id)}
        >
          Reply
        </button>
        {comment.reply_count > 0 && (
          <span className="course-detail-community-reply-count">
            {comment.reply_count} {comment.reply_count === 1 ? 'reply' : 'replies'}
          </span>
        )}
        {comment.can_delete && (
          <button
            type="button"
            className="course-detail-community-toolbar-btn course-detail-community-toolbar-btn--danger"
            disabled={saving}
            onClick={() => void handleDelete()}
          >
            Delete
          </button>
        )}
      </footer>

      {isReplyOpen && (
        <CommunityCommentComposer
          draft={draft}
          onChange={(nextDraft) => onDraftChange(key, nextDraft)}
          onError={onError}
          onSubmit={submitReply}
          placeholder="Write a reply..."
          saving={saving}
          submitLabel="Reply"
        />
      )}

      {comment.replies.length > 0 && (
        <div className="course-detail-community-thread-children">
          {comment.replies.map((reply) => (
            <CommunityCommentItem
              key={reply.id}
              comment={reply}
              courseId={courseId}
              drafts={drafts}
              onDraftChange={onDraftChange}
              onError={onError}
              onImagePreview={onImagePreview}
              onLike={onLike}
              onRefresh={onRefresh}
              onReplyToggle={onReplyToggle}
              onRequestDelete={onRequestDelete}
              postAuthorId={postAuthorId}
              postId={postId}
              replyOpenId={replyOpenId}
              saving={saving}
              setSaving={setSaving}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function CommunityCommentThread({
  comments,
  courseId,
  onError,
  onImagePreview,
  onRefresh,
  postAuthorId,
  postId,
  saving,
  setSaving,
}: CommunityCommentThreadProps) {
  const [drafts, setDrafts] = useState<Record<string, CommentDraft>>({})
  const [replyOpenId, setReplyOpenId] = useState<string | null>(null)
  const [pendingDeleteCommentId, setPendingDeleteCommentId] = useState<string | null>(null)
  const postDraftKey = draftKey(postId)
  const postDraft = drafts[postDraftKey] ?? emptyDraft()

  const handleDraftChange = (key: string, draft: CommentDraft) => {
    setDrafts((current) => ({ ...current, [key]: draft }))
  }

  const handlePostComment = async () => {
    if (!canSubmitDraft(postDraft)) {
      return
    }

    setSaving(true)

    try {
      await createCommunityComment(courseId, postId, {
        body: postDraft.body.trim(),
        gifUrl: postDraft.gifUrl.trim() || undefined,
        images: postDraft.images,
      })
      handleDraftChange(postDraftKey, emptyDraft())
      await onRefresh()
    } catch (submitError) {
      onError(getErrorMessage(submitError, 'Comment could not be published'))
    } finally {
      setSaving(false)
    }
  }

  const handleLike = async (commentId: string) => {
    try {
      await toggleCommunityCommentLike(courseId, commentId)
      await onRefresh()
    } catch (likeError) {
      onError(getErrorMessage(likeError, 'Like could not be updated'))
    }
  }

  const confirmDeleteComment = async () => {
    if (!pendingDeleteCommentId) {
      return
    }

    setSaving(true)

    try {
      await deleteCommunityComment(pendingDeleteCommentId)
      setPendingDeleteCommentId(null)
      await onRefresh()
    } catch (deleteError) {
      onError(getErrorMessage(deleteError, 'Comment could not be deleted'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="course-detail-community-comments">
      {pendingDeleteCommentId && (
        <CommunityConfirmDialog
          message="This comment will be permanently removed."
          onCancel={() => setPendingDeleteCommentId(null)}
          onConfirm={() => void confirmDeleteComment()}
          saving={saving}
          title="Delete this comment?"
        />
      )}

      {comments.map((comment) => (
        <CommunityCommentItem
          key={comment.id}
          comment={comment}
          courseId={courseId}
          drafts={drafts}
          onDraftChange={handleDraftChange}
          onError={onError}
          onImagePreview={onImagePreview}
          onLike={handleLike}
          onRefresh={onRefresh}
          onReplyToggle={setReplyOpenId}
          onRequestDelete={setPendingDeleteCommentId}
          postAuthorId={postAuthorId}
          postId={postId}
          replyOpenId={replyOpenId}
          saving={saving}
          setSaving={setSaving}
        />
      ))}

      <CommunityCommentComposer
        draft={postDraft}
        onChange={(draft) => handleDraftChange(postDraftKey, draft)}
        onError={onError}
        onSubmit={handlePostComment}
        placeholder="Write a comment, paste a screenshot, or react with a GIF..."
        saving={saving}
        submitLabel="Comment"
      />
    </div>
  )
}
