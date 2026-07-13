import { connectionStateFor } from './services/inboxConnections.js'
import { mapProfileGamification } from './services/gamification.js'

export const mapUserProfile = (user, gamificationContext = null) => {
  if (!user) {
    return null
  }

  const profile = {
    id: user.id,
    email: user.email,
    role: user.role,
    full_name: user.fullName,
    display_name: user.displayName,
    avatar_url: user.avatarUrl,
    campus: user.campus,
    student_id: user.studentId,
    main_major_id: user.mainMajorId,
    child_major_id: user.childMajorId,
    must_change_password: user.mustChangePassword,
    status: user.status,
    created_at: user.createdAt?.toISOString(),
    updated_at: user.updatedAt?.toISOString(),
  }

  if (!gamificationContext) {
    return profile
  }

  const gamification = mapProfileGamification(user, gamificationContext)

  return {
    ...profile,
    badges: gamification.badges,
    gold_balance: gamification.gold_balance,
  }
}

export const mapManagedCredential = (credential) => ({
  user_id: credential.userId,
  temp_password: credential.tempPassword,
  created_by: credential.createdById,
  created_at: credential.createdAt.toISOString(),
})

export const mapMainMajor = (major) => ({
  id: major.id,
  title: major.title,
  summary: major.summary,
  sort_order: major.sortOrder,
})

export const mapChildMajor = (major) => ({
  id: major.id,
  main_major_id: major.mainMajorId,
  title: major.title,
  summary: major.summary,
  sort_order: major.sortOrder,
})

export const mapCourse = (course) => ({
  id: course.id,
  code: course.code,
  title: course.title,
  description: course.description,
  credit_points: course.creditPoints,
  created_by: course.createdById,
  created_at: course.createdAt?.toISOString(),
  updated_at: course.updatedAt?.toISOString(),
})

export const mapCoursePrerequisiteGroup = (group) => ({
  id: group.id,
  course_id: group.courseId,
  requirement_type: group.requirementType,
  minimum_credit_points: group.minimumCreditPoints,
  sort_order: group.sortOrder,
  created_at: group.createdAt?.toISOString(),
})

export const mapCoursePrerequisiteOption = (option) => ({
  id: option.id,
  group_id: option.groupId,
  required_course_id: option.requiredCourseId,
  requirement_mode: option.requirementMode,
  sort_order: option.sortOrder,
  created_at: option.createdAt?.toISOString(),
})

export const mapStudentCourseCompletion = (completion) => ({
  id: completion.id,
  student_id: completion.studentId,
  course_id: completion.courseId,
  final_score: completion.finalScore,
  completed_at: completion.completedAt?.toISOString(),
  created_by: completion.createdById,
})

export const mapCurriculumRule = (rule) => ({
  id: rule.id,
  course_id: rule.courseId,
  rule_type: rule.ruleType,
  scope: rule.scope,
  scope_key: rule.scopeKey,
  main_major_id: rule.mainMajorId,
  child_major_id: rule.childMajorId,
  created_at: rule.createdAt?.toISOString(),
})

export const mapCourseRegistrationRequest = (request) => ({
  id: request.id,
  offering_id: request.offeringId,
  user_id: request.userId,
  status: request.status,
  requested_at: request.requestedAt?.toISOString(),
  decided_at: request.decidedAt?.toISOString() ?? null,
  decided_by: request.decidedById ?? null,
})

const mapStaffMember = (staff) => ({
  id: `staff:${staff.id}`,
  course_id: staff.offeringId,
  user_id: staff.userId,
  role: staff.role,
  created_at: staff.createdAt?.toISOString(),
})

const mapEnrollment = (enrollment) => ({
  id: `enrollment:${enrollment.id}`,
  course_id: enrollment.offeringId,
  user_id: enrollment.userId,
  role: 'student',
  created_at: enrollment.createdAt?.toISOString(),
})

export const mapOffering = (offering) => ({
  id: offering.id,
  catalog_course_id: offering.courseId,
  code: offering.course.code,
  title: offering.course.title,
  description: offering.course.description,
  term: offering.term,
  academic_year: offering.academicYear,
  status: offering.status,
  created_by: offering.createdById,
  created_at: offering.createdAt?.toISOString(),
  updated_at: offering.updatedAt?.toISOString(),
  members: [...(offering.staff ?? []).map(mapStaffMember), ...(offering.enrollments ?? []).map(mapEnrollment)],
})

export const mapAssignment = (assignment) => ({
  id: assignment.id,
  course_id: assignment.offeringId,
  title: assignment.title,
  description: assignment.description,
  due_at: assignment.dueAt.toISOString(),
  status: assignment.status,
  created_by: assignment.createdById,
  source_export_id: assignment.sourceExportId ?? null,
  content_html: assignment.contentHtml ?? '',
  submission_types: assignment.submissionTypes ?? null,
  points_possible: assignment.pointsPossible ?? null,
  lock_at: assignment.lockAt?.toISOString() ?? null,
  unlock_at: assignment.unlockAt?.toISOString() ?? null,
  created_at: assignment.createdAt?.toISOString(),
  updated_at: assignment.updatedAt?.toISOString(),
})

export const mapSubmission = (submission) => ({
  id: submission.id,
  assignment_id: submission.assignmentId,
  student_id: submission.studentId,
  body: submission.body,
  file_paths: Array.isArray(submission.filePaths) ? submission.filePaths : [],
  submitted_at: submission.submittedAt.toISOString(),
  updated_at: submission.updatedAt?.toISOString(),
})

export const mapSession = (session) => ({
  id: session.id,
  course_id: session.offeringId,
  title: session.title,
  session_type: session.sessionType,
  starts_at: session.startsAt.toISOString(),
  ends_at: session.endsAt.toISOString(),
  location: session.location,
  created_by: session.createdById,
  created_at: session.createdAt?.toISOString(),
})

export const mapCourseContentAsset = (asset) => ({
  id: asset.id,
  package_id: asset.packageId,
  source_path: asset.sourcePath,
  title: asset.title,
  mime_type: asset.mimeType,
  size: asset.size,
  stored_path: asset.storedPath,
  public_url: asset.publicUrl,
  file_type: asset.fileType,
})

export const mapCourseContentItem = (item) => ({
  id: item.id,
  package_id: item.packageId,
  module_id: item.moduleId,
  assignment_id: item.assignmentId,
  asset_id: item.assetId,
  source_id: item.sourceId,
  source_export_id: item.sourceExportId,
  title: item.title,
  item_type: item.itemType,
  content_html: item.contentHtml ?? '',
  indent: item.indent,
  position: item.position,
  locked: item.locked,
  completed: item.completed,
  asset: item.asset ? mapCourseContentAsset(item.asset) : null,
})

export const mapCourseContentModule = (module) => ({
  id: module.id,
  package_id: module.packageId,
  source_id: module.sourceId,
  source_export_id: module.sourceExportId,
  title: module.title,
  status: module.status,
  position: module.position,
  unlock_at: module.unlockAt?.toISOString() ?? null,
  sequential: module.sequential,
  items: (module.items ?? []).map(mapCourseContentItem),
})

export const mapCourseContentPackageSummary = (coursePackage) => ({
  id: coursePackage.id,
  course_id: coursePackage.courseId,
  offering_id: coursePackage.offeringId,
  scope: coursePackage.scope,
  import_id: coursePackage.importId,
  source_title: coursePackage.sourceTitle,
  source_last_download: coursePackage.sourceLastDownload?.toISOString() ?? null,
  original_file_name: coursePackage.originalFileName,
  language: coursePackage.language,
  imported_by: coursePackage.importedById,
  imported_at: coursePackage.importedAt.toISOString(),
  module_count: coursePackage._count?.modules ?? coursePackage.modules?.length ?? 0,
  item_count: coursePackage._count?.items ?? coursePackage.items?.length ?? 0,
  asset_count: coursePackage._count?.assets ?? coursePackage.assets?.length ?? 0,
})

export const mapCourseContentPackage = (coursePackage) => ({
  ...mapCourseContentPackageSummary(coursePackage),
  modules: (coursePackage.modules ?? []).map(mapCourseContentModule),
  assets: (coursePackage.assets ?? []).map(mapCourseContentAsset),
})

export const mapSwinlearnKnowledgeIndex = (index) =>
  index
    ? {
        id: index.id,
        offering_id: index.offeringId,
        package_id: index.packageId,
        vector_store_id: index.vectorStoreId,
        status: index.status,
        error_message: index.errorMessage,
        indexed_at: index.indexedAt?.toISOString() ?? null,
        created_at: index.createdAt?.toISOString(),
        updated_at: index.updatedAt?.toISOString(),
      }
    : null

export const mapSwinlearnAttachment = (attachment) => ({
  id: attachment.id,
  thread_id: attachment.threadId,
  message_id: attachment.messageId,
  original_name: attachment.originalName,
  mime_type: attachment.mimeType,
  size: attachment.size,
  stored_path: attachment.storedPath,
  file_kind: attachment.fileKind,
  supported_by_file_search: attachment.supportedByFileSearch,
  openai_file_id: attachment.openaiFileId,
  vector_store_id: attachment.vectorStoreId,
  created_at: attachment.createdAt.toISOString(),
})

export const mapSwinlearnMessage = (message) => ({
  id: message.id,
  thread_id: message.threadId,
  role: message.role,
  content: message.content,
  citations: Array.isArray(message.citations) ? message.citations : [],
  selected_offering_ids: Array.isArray(message.selectedOfferingIds) ? message.selectedOfferingIds : [],
  model: message.model,
  openai_response_id: message.openaiResponseId,
  created_at: message.createdAt.toISOString(),
  attachments: (message.attachments ?? []).map(mapSwinlearnAttachment),
})

export const mapSwinlearnThread = (thread) => ({
  id: thread.id,
  student_id: thread.studentId,
  title: thread.title,
  pinned: Boolean(thread.pinned),
  selected_offering_ids: Array.isArray(thread.selectedOfferingIds) ? thread.selectedOfferingIds : [],
  openai_vector_store_id: thread.openaiVectorStoreId,
  created_at: thread.createdAt.toISOString(),
  updated_at: thread.updatedAt.toISOString(),
  messages: (thread.messages ?? []).map(mapSwinlearnMessage),
  attachments: (thread.attachments ?? []).map(mapSwinlearnAttachment),
})

export const mapThread = (thread) => ({
  id: thread.id,
  subject: thread.subject,
  course_id: null,
  created_by: thread.createdById,
  created_at: thread.createdAt.toISOString(),
  updated_at: thread.updatedAt.toISOString(),
})

export const mapParticipant = (participant) => ({
  id: participant.id,
  thread_id: participant.threadId,
  user_id: participant.userId,
  nickname: participant.nickname ?? null,
  last_read_at: participant.lastReadAt?.toISOString() ?? null,
  hidden_at: participant.hiddenAt?.toISOString() ?? null,
  created_at: participant.createdAt.toISOString(),
})

export const mapMessage = (message) => ({
  id: message.id,
  thread_id: message.threadId,
  sender_id: message.senderId,
  body: message.body,
  created_at: message.createdAt.toISOString(),
})

export const mapConnection = (connection, currentUserId) => {
  const otherUser = connection.userAId === currentUserId ? connection.userB : connection.userA

  return {
    id: connection.id,
    status: connection.status,
    state: connectionStateFor(currentUserId, connection),
    requested_by: connection.requestedById,
    other_user: otherUser ? mapUserProfile(otherUser) : null,
    requested_at: connection.requestedAt?.toISOString(),
    decided_at: connection.decidedAt?.toISOString() ?? null,
  }
}

export const isThreadVisible = (participant, messages) => {
  if (!participant?.hiddenAt) {
    return true
  }

  const hiddenAt = new Date(participant.hiddenAt)
  const lastMessage = messages[messages.length - 1] ?? null

  if (!lastMessage) {
    return false
  }

  return new Date(lastMessage.createdAt ?? lastMessage.created_at) > hiddenAt
}

export const mapConversation = (thread, currentUserId) => {
  const participants = thread.participants ?? []
  const me = participants.find((participant) => participant.userId === currentUserId)
  const others = participants.filter((participant) => participant.userId !== currentUserId)
  const other = others[0] ?? null
  const messages = (thread.messages ?? []).map(mapMessage)
  const lastMessage = messages[messages.length - 1] ?? null
  const lastReadAt = me?.lastReadAt ? new Date(me.lastReadAt) : null
  const unread = Boolean(
    lastMessage &&
      lastMessage.sender_id !== currentUserId &&
      (!lastReadAt || new Date(lastMessage.created_at) > lastReadAt),
  )
  const isGroup = Boolean(thread.isGroup)
  const mappedParticipants = participants.map((participant) => ({
    user: participant.user ? mapUserProfile(participant.user) : null,
    nickname: participant.nickname ?? null,
  }))

  let otherUser = null
  let name = thread.subject?.trim() || ''

  if (!isGroup && other?.user) {
    const profile = mapUserProfile(other.user)

    otherUser = other.nickname ? { ...profile, display_name: other.nickname } : profile
    name =
      other.nickname ||
      profile.display_name ||
      profile.full_name ||
      profile.email ||
      'Conversation'
  } else if (isGroup) {
    name = name || 'Group chat'
  }

  return {
    id: thread.id,
    is_group: isGroup,
    name,
    color: thread.color ?? null,
    other_user: otherUser,
    participants: mappedParticipants,
    last_message: lastMessage,
    unread,
    updated_at: thread.updatedAt.toISOString(),
    messages,
  }
}

export const mapCommunityCommentImage = (image) => ({
  id: image.id,
  comment_id: image.commentId,
  original_name: image.originalName,
  mime_type: image.mimeType,
  size: image.size,
  public_url: image.publicUrl,
  sort_order: image.sortOrder,
  created_at: image.createdAt.toISOString(),
})

export const mapCommunityComment = (comment, { currentUserId, offering, user, gamificationContext }) => {
  const likes = comment.likes ?? []

  return {
    id: comment.id,
    post_id: comment.postId,
    parent_id: comment.parentId,
    author_id: comment.authorId,
    body: comment.body,
    gif_url: comment.gifUrl,
    created_at: comment.createdAt.toISOString(),
    author: comment.author ? mapUserProfile(comment.author, gamificationContext) : null,
    images: (comment.images ?? []).map(mapCommunityCommentImage),
    like_count: comment._count?.likes ?? likes.length,
    liked_by_me: likes.some((like) => like.userId === currentUserId),
    reply_count: comment._count?.replies ?? 0,
    can_delete:
      comment.authorId === currentUserId ||
      user.role === 'admin' ||
      offering.staff.some((member) => member.userId === user.id),
    replies: [],
  }
}

export const buildCommunityCommentTree = (comments, context) => {
  const nodes = new Map()

  for (const comment of comments) {
    nodes.set(comment.id, {
      ...mapCommunityComment(comment, context),
      replies: [],
    })
  }

  const roots = []

  for (const comment of comments) {
    const node = nodes.get(comment.id)

    if (comment.parentId && nodes.has(comment.parentId)) {
      nodes.get(comment.parentId).replies.push(node)
      continue
    }

    if (!comment.parentId) {
      roots.push(node)
    }
  }

  return roots
}

export const mapCommunityPostImage = (image) => ({
  id: image.id,
  post_id: image.postId,
  original_name: image.originalName,
  mime_type: image.mimeType,
  size: image.size,
  public_url: image.publicUrl,
  sort_order: image.sortOrder,
  created_at: image.createdAt.toISOString(),
})

export const mapCommunityPost = (post, { currentUserId, offering, user, gamificationContext }) => {
  const likes = post.likes ?? []
  const comments = post.comments ?? []
  const images = post.images ?? []

  return {
    id: post.id,
    offering_id: post.offeringId,
    author_id: post.authorId,
    body: post.body,
    created_at: post.createdAt.toISOString(),
    updated_at: post.updatedAt.toISOString(),
    author: post.author ? mapUserProfile(post.author, gamificationContext) : null,
    comment_count: post._count?.comments ?? comments.length,
    like_count: post._count?.likes ?? likes.length,
    liked_by_me: likes.some((like) => like.userId === currentUserId),
    can_delete:
      post.authorId === currentUserId ||
      user.role === 'admin' ||
      offering.staff.some((member) => member.userId === user.id),
    images: images.map(mapCommunityPostImage),
    comments: buildCommunityCommentTree(comments, {
      currentUserId,
      offering,
      user,
    }),
  }
}

export const mapRoom = (room) => ({
  id: room.id,
  name: room.name,
  created_at: room.createdAt?.toISOString(),
})

export const mapHelpRequest = (request) => ({
  id: request.id,
  requester_id: request.requesterId,
  type: request.type,
  topic: request.topic,
  details: request.details,
  status: request.status,
  teacher_id: request.teacherId ?? null,
  offering_id: request.offeringId ?? null,
  requested_starts_at: request.requestedStartsAt?.toISOString() ?? null,
  requested_ends_at: request.requestedEndsAt?.toISOString() ?? null,
  room_id: request.roomId ?? null,
  room_name: request.room?.name ?? null,
  teacher_responded_at: request.teacherRespondedAt?.toISOString() ?? null,
  decided_by: request.decidedById ?? null,
  decided_at: request.decidedAt?.toISOString() ?? null,
  created_at: request.createdAt?.toISOString(),
  requester: request.requester ? mapUserProfile(request.requester) : null,
  teacher: request.teacher ? mapUserProfile(request.teacher) : null,
  offering_label: request.offering?.course
    ? `${request.offering.course.code} ${request.offering.term} ${request.offering.academicYear}`
    : null,
})

export const mapConsultationTeacher = (teacher) => ({
  id: teacher.id,
  full_name: teacher.fullName,
  display_name: teacher.displayName,
  email: teacher.email,
  recommended: Boolean(teacher.recommended),
})
