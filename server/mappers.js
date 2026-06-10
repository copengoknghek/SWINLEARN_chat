export const mapUserProfile = (user) => ({
  id: user.id,
  email: user.email,
  role: user.role,
  full_name: user.fullName,
  display_name: user.displayName,
  campus: user.campus,
  student_id: user.studentId,
  child_major_id: user.childMajorId,
  must_change_password: user.mustChangePassword,
  status: user.status,
  created_at: user.createdAt?.toISOString(),
  updated_at: user.updatedAt?.toISOString(),
})

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
  created_by: course.createdById,
  created_at: course.createdAt?.toISOString(),
  updated_at: course.updatedAt?.toISOString(),
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
  last_read_at: participant.lastReadAt?.toISOString() ?? null,
  created_at: participant.createdAt.toISOString(),
})

export const mapMessage = (message) => ({
  id: message.id,
  thread_id: message.threadId,
  sender_id: message.senderId,
  body: message.body,
  created_at: message.createdAt.toISOString(),
})
