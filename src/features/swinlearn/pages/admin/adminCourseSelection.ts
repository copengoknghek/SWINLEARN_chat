import type {
  CourseCatalogInput,
  CourseCatalogRow,
  CurriculumRuleInput,
  CurriculumRuleRow,
} from '../../lib/workspace/types'

type CourseDialogMode = 'course-rule' | null

type ExistingRule = Pick<CurriculumRuleRow, 'id'>

type CourseSaveCurriculumRuleInput = {
  selectedCourseId: string
  ruleForm: CurriculumRuleInput
  existingRulesForCourse: ExistingRule[]
}

type ResolveCourseLoadStateInput = {
  courseDialogMode: CourseDialogMode
  courses: CourseCatalogRow[]
  selectedCourseId: string
  selectedChildId: string
  currentCourseForm: CourseCatalogInput
  currentRuleForm: CurriculumRuleInput
}

type ResolvedCourseLoadState = {
  selectedCourseId: string
  courseForm: CourseCatalogInput
  ruleForm: CurriculumRuleInput
}

type SearchableCourse = Pick<CourseCatalogRow, 'code' | 'title' | 'description'>

type CourseSearchRow = {
  course: SearchableCourse
  searchText?: string
}

export const COURSE_LIST_PAGE_SIZE = 6

const courseToForm = (course: CourseCatalogRow): CourseCatalogInput => ({
  code: course.code,
  title: course.title,
  description: course.description,
  credit_points: course.credit_points,
})

const normalizeCourseSearchQuery = (value: string) => value.trim().toLowerCase()

export function courseMatchesSearch(
  course: SearchableCourse,
  query: string,
  extraSearchText = '',
) {
  const normalizedQuery = normalizeCourseSearchQuery(query)

  if (normalizedQuery === '') {
    return true
  }

  return normalizeCourseSearchQuery(
    `${course.code} ${course.title} ${course.description} ${extraSearchText}`,
  ).includes(normalizedQuery)
}

export function filterCourseRows<T extends CourseSearchRow>(rows: T[], query: string) {
  return rows.filter((row) => courseMatchesSearch(row.course, query, row.searchText ?? ''))
}

export function paginateItems<T>(
  items: T[],
  requestedPage: number,
  requestedPageSize = COURSE_LIST_PAGE_SIZE,
) {
  const pageSize = Math.max(1, Math.trunc(requestedPageSize))
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const safeRequestedPage = Number.isFinite(requestedPage) ? Math.trunc(requestedPage) : 1
  const page = Math.min(Math.max(safeRequestedPage, 1), totalPages)
  const startIndex = (page - 1) * pageSize

  return {
    items: items.slice(startIndex, startIndex + pageSize),
    page,
    pageSize,
    totalItems: items.length,
    totalPages,
  }
}

export const curriculumRuleRequiredMessage =
  'Please add a curriculum rule before saving this catalog course.'

const ruleFormIsComplete = (ruleForm: CurriculumRuleInput) => {
  if (ruleForm.rule_type === 'core') {
    return (
      ruleForm.scope === 'main_major' &&
      Boolean(ruleForm.main_major_id) &&
      ruleForm.child_major_id === null
    )
  }

  if (ruleForm.rule_type === 'major') {
    return (
      ruleForm.scope === 'child_major' &&
      ruleForm.main_major_id === null &&
      Boolean(ruleForm.child_major_id)
    )
  }

  if (ruleForm.scope === 'global') {
    return ruleForm.main_major_id === null && ruleForm.child_major_id === null
  }

  if (ruleForm.scope === 'main_major') {
    return Boolean(ruleForm.main_major_id) && ruleForm.child_major_id === null
  }

  return ruleForm.main_major_id === null && Boolean(ruleForm.child_major_id)
}

export function shouldCreateCurriculumRuleOnCourseSave({
  selectedCourseId,
  existingRulesForCourse,
}: Pick<CourseSaveCurriculumRuleInput, 'selectedCourseId' | 'existingRulesForCourse'>) {
  return selectedCourseId === '' || existingRulesForCourse.length === 0
}

export function getCourseSaveCurriculumRuleError({
  selectedCourseId,
  ruleForm,
  existingRulesForCourse,
}: CourseSaveCurriculumRuleInput) {
  if (!shouldCreateCurriculumRuleOnCourseSave({ selectedCourseId, existingRulesForCourse })) {
    return ''
  }

  return ruleFormIsComplete(ruleForm) ? '' : curriculumRuleRequiredMessage
}

export function isCourseSaveCurriculumRuleIncomplete(input: CourseSaveCurriculumRuleInput) {
  return getCourseSaveCurriculumRuleError(input) !== ''
}

export function prepareCurriculumRuleForCourseSave(
  ruleForm: CurriculumRuleInput,
  courseId: string,
): CurriculumRuleInput {
  return {
    ...ruleForm,
    course_id: courseId,
  }
}

export function resolveCourseLoadState({
  courseDialogMode,
  courses,
  selectedCourseId,
  selectedChildId,
  currentCourseForm,
  currentRuleForm,
}: ResolveCourseLoadStateInput): ResolvedCourseLoadState {
  const creatingCatalogCourse = courseDialogMode === 'course-rule' && selectedCourseId === ''
  const selectedCourse = selectedCourseId
    ? courses.find((course) => course.id === selectedCourseId) ?? null
    : null
  const fallbackCourse = courses[0] ?? null
  const nextCourse = creatingCatalogCourse ? null : selectedCourse ?? fallbackCourse
  const nextSelectedCourseId = nextCourse?.id ?? ''
  const shouldHydrateCourseForm =
    !creatingCatalogCourse &&
    nextCourse !== null &&
    (!selectedCourseId || selectedCourseId !== nextCourse.id)

  if (creatingCatalogCourse) {
    return {
      selectedCourseId: '',
      courseForm: currentCourseForm,
      ruleForm: currentRuleForm,
    }
  }

  return {
    selectedCourseId: nextSelectedCourseId,
    courseForm: shouldHydrateCourseForm ? courseToForm(nextCourse) : currentCourseForm,
    ruleForm: {
      ...currentRuleForm,
      course_id: currentRuleForm.course_id || nextSelectedCourseId,
      child_major_id: currentRuleForm.child_major_id || selectedChildId,
    },
  }
}
