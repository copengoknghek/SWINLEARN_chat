import type { Role } from '../../../../hooks/useAuth'
import type { CommunityBadgeType } from './communityBadges'

export type ProfileStatus = 'active' | 'inactive'
export type ProfileCampus = 'hanoi' | 'danang' | 'hcm'
export type CourseTerm = 'semester_1' | 'semester_2' | 'summer'
export type CourseStatus = 'active' | 'archived'
export type RegistrationRequestStatus = 'pending' | 'approved' | 'rejected'
export type CourseMemberRole = 'teacher' | 'teaching_assistant' | 'student'
export type CurriculumRuleType = 'core' | 'elective' | 'major'
export type CurriculumScope = 'global' | 'main_major' | 'child_major'
export type CoursePrerequisiteGroupType = 'completed_credit_points' | 'course_alternatives'
export type CoursePrerequisiteOptionMode = 'passed' | 'passed_or_concurrent'
export type AssignmentStatus = 'draft' | 'published' | 'archived'
export type SessionType = 'class' | 'lab' | 'event' | 'consultation'

export type ProfileRow = {
  id: string
  email: string | null
  role: Role
  full_name: string | null
  display_name: string | null
  avatar_url: string | null
  campus: ProfileCampus | null
  student_id: string | null
  main_major_id: string | null
  child_major_id: string | null
  must_change_password: boolean
  status: ProfileStatus
  badges?: CommunityBadgeType[]
  gold_balance?: number
  created_at?: string
  updated_at?: string
}

export type AdminUserCreateInput = {
  full_name: string
  role: 'teacher' | 'student'
  campus: ProfileCampus
  user_id: string
  main_major_id?: string | null
  child_major_id?: string | null
}

export type AdminUserCreateResult = {
  success: boolean
  user_id: string
  email: string
  temp_password: string
}

export type AdminUserImportResult = {
  row: number
  email: string
  success: boolean
  user_id?: string
  temp_password?: string
  error?: string
}

export type ManagedUserCredentialRow = {
  user_id: string
  temp_password: string
  created_by: string | null
  created_at: string
}

export type MainMajorRow = {
  id: string
  title: string
  summary: string
  sort_order: number
}

export type ChildMajorRow = {
  id: string
  main_major_id: string
  title: string
  summary: string
  sort_order: number
}

export type CourseCatalogRow = {
  id: string
  code: string
  title: string
  description: string
  credit_points: number
  created_by: string | null
  created_at?: string
  updated_at?: string
}

export type CurriculumRuleRow = {
  id: string
  course_id: string
  rule_type: CurriculumRuleType
  scope: CurriculumScope
  scope_key: string
  main_major_id: string | null
  child_major_id: string | null
  created_at?: string
}

export type CoursePrerequisiteGroupRow = {
  id: string
  course_id: string
  requirement_type: CoursePrerequisiteGroupType
  minimum_credit_points: number | null
  sort_order: number
  created_at?: string
}

export type CoursePrerequisiteOptionRow = {
  id: string
  group_id: string
  required_course_id: string
  requirement_mode: CoursePrerequisiteOptionMode
  sort_order: number
  created_at?: string
}

export type StudentCourseCompletionRow = {
  id: string
  student_id: string
  course_id: string
  final_score: number
  completed_at: string
  created_by: string | null
}

export type AcademicProgressCourseRow = {
  id: string
  course_id: string
  code: string
  title: string
  final_score: number
  grade: 'F' | 'P' | 'C' | 'D' | 'HD' | null
  grade_label: string | null
  credit_points: number
  counts_toward_total: boolean
  earned_credit_points: number
  completed_at: string
}

export type AcademicProgressData = {
  total_credit_points: number
  passed_course_count: number
  completed_courses: AcademicProgressCourseRow[]
}

export type CourseOfferingRow = {
  id: string
  catalog_course_id: string
  code: string
  title: string
  description: string
  term: CourseTerm
  academic_year: number
  status: CourseStatus
  created_by: string | null
  created_at?: string
  updated_at?: string
}

export type CourseRow = CourseOfferingRow

export type CourseMembershipRow = {
  id: string
  course_id: string
  user_id: string
  role: CourseMemberRole
  created_at?: string
}

export type CourseRegistrationRequestRow = {
  id: string
  offering_id: string
  user_id: string
  status: RegistrationRequestStatus
  requested_at?: string
  decided_at: string | null
  decided_by: string | null
}

export type HelpRequestType = 'general' | 'consultation'

export type HelpRequestStatus =
  | 'submitted'
  | 'awaiting_teacher'
  | 'teacher_declined'
  | 'awaiting_room'
  | 'approved'
  | 'rejected'

export type HelpRequestRow = {
  id: string
  requester_id: string
  type: HelpRequestType
  topic: string
  details: string
  status: HelpRequestStatus
  teacher_id: string | null
  offering_id: string | null
  requested_starts_at: string | null
  requested_ends_at: string | null
  room_id: string | null
  room_name: string | null
  teacher_responded_at: string | null
  decided_by: string | null
  decided_at: string | null
  created_at?: string
  requester?: ProfileRow | null
  teacher?: ProfileRow | null
  offering_label?: string | null
}

export type ConsultationTeacherRow = {
  id: string
  full_name: string | null
  display_name: string | null
  email: string
  recommended: boolean
}

export type RoomRow = {
  id: string
  name: string
  created_at?: string
}

export type HelpRequestInput = {
  topic: string
  details?: string
  teacher_id?: string
  consultation_date?: string
  consultation_time?: string
  offering_id?: string
}

export type AssignmentRow = {
  id: string
  course_id: string
  title: string
  description: string
  due_at: string
  status: AssignmentStatus
  created_by: string | null
  source_export_id: string | null
  content_html: string
  submission_types: string | null
  points_possible: number | null
  lock_at: string | null
  unlock_at: string | null
  created_at?: string
  updated_at?: string
}

export type AssignmentSubmissionRow = {
  id: string
  assignment_id: string
  student_id: string
  body: string
  file_paths: string[]
  submitted_at: string
  updated_at?: string
}

export type CourseSessionRow = {
  id: string
  course_id: string
  title: string
  session_type: SessionType
  starts_at: string
  ends_at: string
  location: string
  created_by: string | null
  created_at?: string
}

export type CourseContentItemType =
  | 'wiki_page'
  | 'assignment'
  | 'quiz'
  | 'attachment'
  | 'sub_header'
  | 'unknown'

export type CourseContentAssetRow = {
  id: string
  package_id: string
  source_path: string
  title: string
  mime_type: string | null
  size: number | null
  stored_path: string
  public_url: string
  file_type: string
}

export type CourseContentItemRow = {
  id: string
  package_id: string
  module_id: string | null
  assignment_id: string | null
  asset_id: string | null
  source_id: string | null
  source_export_id: string | null
  title: string
  item_type: CourseContentItemType
  content_html: string
  indent: number
  position: number
  locked: boolean
  completed: boolean
  asset: CourseContentAssetRow | null
}

export type CourseContentModuleRow = {
  id: string
  package_id: string
  source_id: string | null
  source_export_id: string | null
  title: string
  status: string | null
  position: number
  unlock_at: string | null
  sequential: boolean
  items: CourseContentItemRow[]
}

export type CourseContentPackageSummaryRow = {
  id: string
  course_id: string | null
  offering_id: string | null
  scope: string
  import_id: string
  source_title: string
  source_last_download: string | null
  original_file_name: string | null
  language: string | null
  imported_by: string | null
  imported_at: string
  module_count: number
  item_count: number
  asset_count: number
}

export type CourseContentPackageRow = CourseContentPackageSummaryRow & {
  modules: CourseContentModuleRow[]
  assets: CourseContentAssetRow[]
}

export type CourseDetailData = {
  course: CourseWithMembers
  contentPackage: CourseContentPackageRow | null
  assignments: AssignmentRow[]
  submissions: AssignmentSubmissionRow[]
  profiles: ProfileRow[]
}

export type SwinlearnKnowledgeIndexRow = {
  id?: string
  offering_id?: string
  package_id?: string | null
  vector_store_id?: string | null
  status: 'missing' | 'pending' | 'indexing' | 'ready' | 'stale' | 'error' | 'failed' | string
  error_message?: string | null
  indexed_at?: string | null
  created_at?: string
  updated_at?: string
}

export type SwinlearnCourseContextRow = CourseWithMembers & {
  content_package: CourseContentPackageRow | null
  knowledge_index: SwinlearnKnowledgeIndexRow
}

export type SwinlearnCitationRow = {
  file_id: string | null
  filename: string
  score: number | null
  text: string
}

export type SwinlearnAttachmentRow = {
  id: string
  thread_id: string
  message_id: string | null
  original_name: string
  mime_type: string | null
  size: number
  stored_path: string
  file_kind: string
  supported_by_file_search: boolean
  openai_file_id: string | null
  vector_store_id: string | null
  created_at: string
}

export type SwinlearnMessageRow = {
  id: string
  thread_id: string
  role: 'student' | 'assistant' | string
  content: string
  citations: SwinlearnCitationRow[]
  selected_offering_ids: string[]
  model: string | null
  openai_response_id: string | null
  created_at: string
  attachments: SwinlearnAttachmentRow[]
}

export type SwinlearnThreadRow = {
  id: string
  student_id: string
  title: string
  pinned: boolean
  selected_offering_ids: string[]
  openai_vector_store_id: string | null
  created_at: string
  updated_at: string
  messages: SwinlearnMessageRow[]
  attachments: SwinlearnAttachmentRow[]
}

export type SwinlearnContextData = {
  courses: SwinlearnCourseContextRow[]
}

export type SwinlearnSendMessageResult = {
  user: SwinlearnMessageRow
  assistant: SwinlearnMessageRow
  attachments: SwinlearnAttachmentRow[]
}

export type ConnectionStatus = 'pending' | 'accepted' | 'declined'

export type ConnectionState =
  | 'none'
  | 'outgoing_pending'
  | 'incoming_pending'
  | 'accepted'
  | 'declined'

export type ConnectionRow = {
  id: string
  status: ConnectionStatus
  state: ConnectionState
  requested_by: string
  other_user: ProfileRow | null
  requested_at: string
  decided_at: string | null
}

export type PersonSearchResult = {
  user: ProfileRow
  connection_state: ConnectionState
  connection_id: string | null
  shared: boolean
}

export type InboxMessageRow = {
  id: string
  thread_id: string
  sender_id: string
  body: string
  created_at: string
}

export type InboxColorKey = 'green' | 'blue' | 'purple' | 'orange' | 'red' | 'teal' | 'pink'

export type ConversationParticipantRow = {
  user: ProfileRow | null
  nickname: string | null
}

export type ConversationRow = {
  id: string
  is_group: boolean
  name: string
  color: InboxColorKey | null
  other_user: ProfileRow | null
  participants: ConversationParticipantRow[]
  last_message: InboxMessageRow | null
  unread: boolean
  updated_at: string
  messages: InboxMessageRow[]
}

export type CatalogData = {
  mainMajors: MainMajorRow[]
  childMajors: ChildMajorRow[]
}

export type CourseWithMembers = CourseRow & {
  members: CourseMembershipRow[]
}

export type RegistrationRequirementFailure = {
  group_id: string
  type: CoursePrerequisiteGroupType
  message: string
}

export type RegistrationEligibilityRow = {
  offering_id: string
  course_id: string
  eligible: boolean
  completed_credit_points: number
  unmet_requirements: RegistrationRequirementFailure[]
}

export type RegistrationData = {
  offerings: CourseWithMembers[]
  eligibility: RegistrationEligibilityRow[]
  registrationRequests: CourseRegistrationRequestRow[]
}

export type RegistrationBasketResult = {
  eligible: boolean
  results: RegistrationEligibilityRow[]
}

export type AdminCourseData = CatalogData & {
  courses: CourseCatalogRow[]
  curriculumRules: CurriculumRuleRow[]
  prerequisiteGroups: CoursePrerequisiteGroupRow[]
  prerequisiteOptions: CoursePrerequisiteOptionRow[]
  studentCompletions: StudentCourseCompletionRow[]
  offerings: CourseWithMembers[]
  contentPackages: CourseContentPackageSummaryRow[]
  registrationRequests: CourseRegistrationRequestRow[]
  profiles: ProfileRow[]
}

export type AdminUserData = {
  profiles: ProfileRow[]
  managedCredentials: ManagedUserCredentialRow[]
  courses: CourseCatalogRow[]
  studentCompletions: StudentCourseCompletionRow[]
  curriculumRules: CurriculumRuleRow[]
  childMajors: ChildMajorRow[]
}

export type CourseCatalogInput = {
  code: string
  title: string
  description: string
  credit_points: number
}

export type CurriculumRuleInput = {
  course_id: string
  rule_type: CurriculumRuleType
  scope: CurriculumScope
  main_major_id: string | null
  child_major_id: string | null
}

export type CoursePrerequisiteOptionInput = {
  required_course_id: string
  requirement_mode: CoursePrerequisiteOptionMode
}

export type CoursePrerequisiteGroupInput = {
  requirement_type: CoursePrerequisiteGroupType
  minimum_credit_points: number | null
  options: CoursePrerequisiteOptionInput[]
}

export type CourseOfferingInput = {
  course_id: string
  term: CourseTerm
  academic_year: number
  status: CourseStatus
}

export type AssignmentMutationInput = {
  course_id: string
  title: string
  description: string
  due_at: string
  status: AssignmentStatus
}

export type InboxData = {
  conversations: ConversationRow[]
  connections: ConnectionRow[]
}

export type CommunityImageRow = {
  id: string
  original_name: string
  mime_type: string | null
  size: number
  public_url: string
  sort_order: number
  created_at: string
}

export type CommunityCommentRow = {
  id: string
  post_id: string
  parent_id: string | null
  author_id: string
  body: string
  gif_url: string | null
  created_at: string
  author: ProfileRow | null
  images: CommunityImageRow[]
  like_count: number
  liked_by_me: boolean
  reply_count: number
  can_delete: boolean
  replies: CommunityCommentRow[]
}

export type CommunityPostRow = {
  id: string
  offering_id: string
  author_id: string
  body: string
  created_at: string
  updated_at: string
  author: ProfileRow | null
  comment_count: number
  like_count: number
  liked_by_me: boolean
  can_delete: boolean
  images: CommunityImageRow[]
  comments: CommunityCommentRow[]
}

export type CommunityData = {
  posts: CommunityPostRow[]
  viewer?: {
    badges: CommunityBadgeType[]
    gold_balance: number
  }
}

export type GiphyGifRow = {
  id: string
  title: string
  url: string
  preview_url: string
  width: number | null
  height: number | null
}

export type GiphySearchResult = {
  gifs: GiphyGifRow[]
  pagination: {
    offset: number
    count: number
    total_count: number
  }
}
