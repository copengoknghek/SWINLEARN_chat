import { useCallback, useEffect, useMemo, useState } from 'react'
import { WorkspaceAlertStack } from '../../components/WorkspaceAlertStack'
import {
  createCourse,
  createCurriculumRule,
  deleteCourse,
  deleteCurriculumRule,
  fetchAdminCourseData,
  getErrorMessage,
  saveCoursePrerequisites,
  updateCourse,
} from '../../lib/workspace/api'
import type {
  AdminCourseData,
  CourseCatalogInput,
  CourseCatalogRow,
  CoursePrerequisiteGroupInput,
  CoursePrerequisiteOptionInput,
  CurriculumRuleInput,
  CurriculumRuleRow,
} from '../../lib/workspace/types'
import {
  filterCourseRows,
  getCourseSaveCurriculumRuleError,
  isCourseSaveCurriculumRuleIncomplete,
  paginateItems,
  prepareCurriculumRuleForCourseSave,
  resolveCourseLoadState,
  shouldCreateCurriculumRuleOnCourseSave,
} from './adminCourseSelection'
import './AdminCoursesPage.css'

const ruleTypeLabels: Record<CurriculumRuleInput['rule_type'], string> = {
  core: 'Core',
  elective: 'Elective',
  major: 'Major',
}

const scopeLabels: Record<CurriculumRuleInput['scope'], string> = {
  global: 'All main majors',
  main_major: 'Main major',
  child_major: 'Child major',
}

const prerequisiteTypeLabels: Record<CoursePrerequisiteGroupInput['requirement_type'], string> = {
  completed_credit_points: 'Completed credit points',
  course_alternatives: 'Course alternatives',
}

const prerequisiteModeLabels: Record<CoursePrerequisiteOptionInput['requirement_mode'], string> = {
  passed: 'Passed',
  passed_or_concurrent: 'Passed or concurrent',
}

type CourseDialogMode = 'course-rule'

type CurriculumCourseListRow = {
  id: string
  course: CourseCatalogRow
  rule: CurriculumRuleRow
  searchText: string
}

type CatalogCourseListRow = {
  id: string
  course: CourseCatalogRow
  offeringCount: number
}

const emptyCourseForm = (): CourseCatalogInput => ({
  code: '',
  title: '',
  description: '',
  credit_points: 12.5,
})

const emptyRuleForm = (
  courseId = '',
  childMajorId = '',
): CurriculumRuleInput => ({
  course_id: courseId,
  rule_type: 'major',
  scope: 'child_major',
  main_major_id: null,
  child_major_id: childMajorId,
})

const emptyCreditPrerequisite = (): CoursePrerequisiteGroupInput => ({
  requirement_type: 'completed_credit_points',
  minimum_credit_points: 12.5,
  options: [],
})

const emptyCoursePrerequisite = (requiredCourseId = ''): CoursePrerequisiteGroupInput => ({
  requirement_type: 'course_alternatives',
  minimum_credit_points: null,
  options: [
    {
      required_course_id: requiredCourseId,
      requirement_mode: 'passed',
    },
  ],
})

const buildPrerequisiteForm = (
  data: AdminCourseData | null,
  courseId: string,
): CoursePrerequisiteGroupInput[] => {
  if (!data || !courseId) {
    return []
  }

  return data.prerequisiteGroups
    .filter((group) => group.course_id === courseId)
    .sort((first, second) => first.sort_order - second.sort_order)
    .map((group) => ({
      requirement_type: group.requirement_type,
      minimum_credit_points: group.minimum_credit_points,
      options: data.prerequisiteOptions
        .filter((option) => option.group_id === group.id)
        .sort((first, second) => first.sort_order - second.sort_order)
        .map((option) => ({
          required_course_id: option.required_course_id,
          requirement_mode: option.requirement_mode,
        })),
    }))
}

const prerequisiteFormIsComplete = (groups: CoursePrerequisiteGroupInput[]) =>
  groups.every((group) => {
    if (group.requirement_type === 'completed_credit_points') {
      return Number(group.minimum_credit_points) > 0
    }

    return (
      group.options.length > 0 &&
      group.options.every((option) => option.required_course_id && option.requirement_mode)
    )
  })

const curriculumRuleAppliesToChildMajor = (
  rule: CurriculumRuleRow,
  mainMajorId: string,
  childMajorId: string,
) => {
  if (rule.scope === 'global') {
    return true
  }

  if (rule.scope === 'main_major') {
    return rule.main_major_id === mainMajorId
  }

  return rule.child_major_id === childMajorId
}

const ruleScopeDetail = (
  rule: CurriculumRuleRow,
  data: AdminCourseData,
) => {
  if (rule.scope === 'global') {
    return 'All main majors'
  }

  if (rule.scope === 'main_major') {
    return data.mainMajors.find((major) => major.id === rule.main_major_id)?.title ?? 'Main major'
  }

  return data.childMajors.find((major) => major.id === rule.child_major_id)?.title ?? 'Child major'
}

function AdminCoursesPage() {
  const [data, setData] = useState<AdminCourseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selectedMainId, setSelectedMainId] = useState('')
  const [selectedChildId, setSelectedChildId] = useState('')
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [curriculumCourseQuery, setCurriculumCourseQuery] = useState('')
  const [curriculumCoursePage, setCurriculumCoursePage] = useState(1)
  const [catalogCourseQuery, setCatalogCourseQuery] = useState('')
  const [catalogCoursePage, setCatalogCoursePage] = useState(1)
  const [courseDialogMode, setCourseDialogMode] = useState<CourseDialogMode | null>(null)
  const [courseForm, setCourseForm] = useState<CourseCatalogInput>(emptyCourseForm())
  const [ruleForm, setRuleForm] = useState<CurriculumRuleInput>(emptyRuleForm())
  const [prerequisiteGroups, setPrerequisiteGroups] = useState<CoursePrerequisiteGroupInput[]>([])
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const nextData = await fetchAdminCourseData()
      const firstMainId = selectedMainId || nextData.mainMajors[0]?.id || ''
      const firstChildId =
        selectedChildId ||
        nextData.childMajors.find((childMajor) => childMajor.main_major_id === firstMainId)?.id ||
        ''
      const courseLoadContext = {
        courseDialogMode,
        courses: nextData.courses,
        selectedCourseId,
        selectedChildId: firstChildId,
      }
      const nextCourseSelection = resolveCourseLoadState({
        ...courseLoadContext,
        currentCourseForm: emptyCourseForm(),
        currentRuleForm: emptyRuleForm(),
      })

      setData(nextData)
      setSelectedMainId(firstMainId)
      setSelectedChildId(firstChildId)
      setSelectedCourseId(nextCourseSelection.selectedCourseId)

      setCourseForm((currentCourseForm) => resolveCourseLoadState({
        ...courseLoadContext,
        currentCourseForm,
        currentRuleForm: emptyRuleForm(),
      }).courseForm)
      setRuleForm((currentRuleForm) => resolveCourseLoadState({
        ...courseLoadContext,
        currentCourseForm: emptyCourseForm(),
        currentRuleForm,
      }).ruleForm)
      setPrerequisiteGroups(buildPrerequisiteForm(nextData, nextCourseSelection.selectedCourseId))
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Course data could not be loaded'))
    } finally {
      setLoading(false)
    }
  }, [courseDialogMode, selectedChildId, selectedCourseId, selectedMainId])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadData(), 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadData])

  const coursesById = useMemo(() => {
    const map = new Map<string, CourseCatalogRow>()

    for (const course of data?.courses ?? []) {
      map.set(course.id, course)
    }

    return map
  }, [data?.courses])

  const offeringCountByCourseId = useMemo(() => {
    const map = new Map<string, number>()

    for (const offering of data?.offerings ?? []) {
      map.set(offering.catalog_course_id, (map.get(offering.catalog_course_id) ?? 0) + 1)
    }

    return map
  }, [data?.offerings])

  const selectedMainMajors = data?.mainMajors ?? []
  const selectedChildMajors = (data?.childMajors ?? []).filter(
    (childMajor) => childMajor.main_major_id === selectedMainId,
  )
  const selectedCurriculumRules = (data?.curriculumRules ?? []).filter((rule) =>
    curriculumRuleAppliesToChildMajor(rule, selectedMainId, selectedChildId),
  )
  const curriculumCourseRows: CurriculumCourseListRow[] = selectedCurriculumRules
    .map((rule) => {
      const course = coursesById.get(rule.course_id)

      if (!course) {
        return null
      }

      return {
        id: rule.id,
        course,
        rule,
        searchText: `${ruleTypeLabels[rule.rule_type]} ${scopeLabels[rule.scope]} ${
          data ? ruleScopeDetail(rule, data) : ''
        }`,
      }
    })
    .filter((row): row is CurriculumCourseListRow => row !== null)
  const filteredCurriculumCourseRows = filterCourseRows(curriculumCourseRows, curriculumCourseQuery)
  const curriculumCoursePageState = paginateItems(
    filteredCurriculumCourseRows,
    curriculumCoursePage,
  )
  const catalogCourseRows: CatalogCourseListRow[] = (data?.courses ?? []).map((course) => ({
    id: course.id,
    course,
    offeringCount: offeringCountByCourseId.get(course.id) ?? 0,
  }))
  const filteredCatalogCourseRows = filterCourseRows(catalogCourseRows, catalogCourseQuery)
  const catalogCoursePageState = paginateItems(filteredCatalogCourseRows, catalogCoursePage)
  const selectedCourseRules = (data?.curriculumRules ?? []).filter(
    (rule) => rule.course_id === selectedCourseId,
  )
  const courseSaveNeedsCurriculumRule = shouldCreateCurriculumRuleOnCourseSave({
    selectedCourseId,
    existingRulesForCourse: selectedCourseRules,
  })
  const courseSaveRuleIncomplete = isCourseSaveCurriculumRuleIncomplete({
    selectedCourseId,
    ruleForm,
    existingRulesForCourse: selectedCourseRules,
  })
  const availablePrerequisiteCourses = (data?.courses ?? []).filter(
    (course) => course.id !== selectedCourseId,
  )
  const prerequisiteSaveIncomplete = !prerequisiteFormIsComplete(prerequisiteGroups)

  const updatePrerequisiteGroup = (
    groupIndex: number,
    updates: Partial<CoursePrerequisiteGroupInput>,
  ) => {
    setPrerequisiteGroups((current) =>
      current.map((group, index) => (index === groupIndex ? { ...group, ...updates } : group)),
    )
  }

  const updatePrerequisiteOption = (
    groupIndex: number,
    optionIndex: number,
    updates: Partial<CoursePrerequisiteOptionInput>,
  ) => {
    setPrerequisiteGroups((current) =>
      current.map((group, index) => {
        if (index !== groupIndex) {
          return group
        }

        return {
          ...group,
          options: group.options.map((option, currentOptionIndex) =>
            currentOptionIndex === optionIndex ? { ...option, ...updates } : option,
          ),
        }
      }),
    )
  }

  const addPrerequisiteOption = (groupIndex: number) => {
    const firstCourseId = availablePrerequisiteCourses[0]?.id ?? ''

    setPrerequisiteGroups((current) =>
      current.map((group, index) =>
        index === groupIndex
          ? {
              ...group,
              options: [
                ...group.options,
                {
                  required_course_id: firstCourseId,
                  requirement_mode: 'passed',
                },
              ],
            }
          : group,
      ),
    )
  }

  const removePrerequisiteOption = (groupIndex: number, optionIndex: number) => {
    setPrerequisiteGroups((current) =>
      current.map((group, index) =>
        index === groupIndex
          ? {
              ...group,
              options: group.options.filter((_option, currentOptionIndex) => currentOptionIndex !== optionIndex),
            }
          : group,
      ),
    )
  }

  const selectCourse = (course: CourseCatalogRow) => {
    setSelectedCourseId(course.id)
    setCourseForm({
      code: course.code,
      title: course.title,
      description: course.description,
      credit_points: course.credit_points,
    })
    setRuleForm(emptyRuleForm(course.id, selectedChildId))
    setPrerequisiteGroups(buildPrerequisiteForm(data, course.id))
  }

  const openCourseRuleDialog = (course: CourseCatalogRow) => {
    selectCourse(course)
    setCourseDialogMode('course-rule')
    setNotice('')
    setError('')
  }

  const openNewCourseDialog = () => {
    setSelectedCourseId('')
    setCourseForm(emptyCourseForm())
    setRuleForm(emptyRuleForm('', selectedChildId))
    setPrerequisiteGroups([])
    setCourseDialogMode('course-rule')
    setNotice('')
    setError('')
  }

  const closeCourseDialog = () => {
    setCourseDialogMode(null)
  }

  const handleMainMajorClick = (mainMajorId: string) => {
    const firstChildId =
      data?.childMajors.find((childMajor) => childMajor.main_major_id === mainMajorId)?.id ?? ''

    setSelectedMainId(mainMajorId)
    setSelectedChildId(firstChildId)
    setCurriculumCoursePage(1)
    setRuleForm((current) => ({
      ...current,
      main_major_id: current.scope === 'main_major' ? mainMajorId : null,
      child_major_id: current.scope === 'child_major' ? firstChildId : null,
    }))
  }

  const handleChildMajorClick = (childMajorId: string) => {
    setSelectedChildId(childMajorId)
    setCurriculumCoursePage(1)
    setRuleForm((current) => ({
      ...current,
      child_major_id: current.scope === 'child_major' ? childMajorId : null,
    }))
  }

  const handleCourseSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')

    try {
      const input = {
        code: courseForm.code.trim().toUpperCase(),
        title: courseForm.title.trim(),
        description: courseForm.description.trim(),
        credit_points: Number(courseForm.credit_points) || 12.5,
      }
      const ruleError = getCourseSaveCurriculumRuleError({
        selectedCourseId,
        ruleForm,
        existingRulesForCourse: selectedCourseRules,
      })

      if (ruleError) {
        setError(ruleError)
        return
      }

      const shouldCreateRule = shouldCreateCurriculumRuleOnCourseSave({
        selectedCourseId,
        existingRulesForCourse: selectedCourseRules,
      })
      let createdCourseId = ''

      if (selectedCourseId) {
        await updateCourse(selectedCourseId, input)
        if (shouldCreateRule) {
          await createCurriculumRule(prepareCurriculumRuleForCourseSave(ruleForm, selectedCourseId))
          setNotice('Catalog course updated and curriculum rule added.')
        } else {
          setNotice('Catalog course updated.')
        }
      } else {
        const nextCourseId = await createCourse(input, {
          rule_type: ruleForm.rule_type,
          scope: ruleForm.scope,
          main_major_id: ruleForm.main_major_id,
          child_major_id: ruleForm.child_major_id,
        })
        createdCourseId = nextCourseId
        setSelectedCourseId(nextCourseId)
        setRuleForm(emptyRuleForm(nextCourseId, selectedChildId))
        setNotice('Catalog course and curriculum rule created.')
      }

      await loadData()

      if (createdCourseId) {
        setSelectedCourseId(createdCourseId)
        setCourseForm(input)
        setRuleForm(emptyRuleForm(createdCourseId, selectedChildId))
        setPrerequisiteGroups([])
      }
    } catch (submitError) {
      setError(getErrorMessage(submitError, 'Course could not be saved'))
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteCourse = async () => {
    if (!selectedCourseId) {
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    try {
      await deleteCourse(selectedCourseId)
      setSelectedCourseId('')
      setCourseForm(emptyCourseForm())
      setPrerequisiteGroups([])
      setCourseDialogMode(null)
      setNotice('Catalog course deleted.')
      await loadData()
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, 'Course could not be deleted'))
    } finally {
      setSaving(false)
    }
  }

  const handleAddCreditPrerequisite = () => {
    setPrerequisiteGroups((current) => [...current, emptyCreditPrerequisite()])
  }

  const handleAddCoursePrerequisite = () => {
    setPrerequisiteGroups((current) => [
      ...current,
      emptyCoursePrerequisite(availablePrerequisiteCourses[0]?.id ?? ''),
    ])
  }

  const handleRemovePrerequisiteGroup = (groupIndex: number) => {
    setPrerequisiteGroups((current) => current.filter((_group, index) => index !== groupIndex))
  }

  const handlePrerequisiteSave = async () => {
    if (!selectedCourseId || prerequisiteSaveIncomplete) {
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    try {
      await saveCoursePrerequisites(selectedCourseId, prerequisiteGroups)
      setNotice('Prerequisite requirements saved.')
      await loadData()
    } catch (prerequisiteError) {
      setError(getErrorMessage(prerequisiteError, 'Prerequisite requirements could not be saved'))
    } finally {
      setSaving(false)
    }
  }

  const handleRuleTypeChange = (ruleType: CurriculumRuleInput['rule_type']) => {
    if (ruleType === 'core') {
      setRuleForm((current) => ({
        ...current,
        rule_type: ruleType,
        scope: 'main_major',
        main_major_id: selectedMainId,
        child_major_id: null,
      }))
      return
    }

    if (ruleType === 'major') {
      setRuleForm((current) => ({
        ...current,
        rule_type: ruleType,
        scope: 'child_major',
        main_major_id: null,
        child_major_id: selectedChildId,
      }))
      return
    }

    setRuleForm((current) => ({
      ...current,
      rule_type: ruleType,
      scope: 'global',
      main_major_id: null,
      child_major_id: null,
    }))
  }

  const handleRuleScopeChange = (scope: CurriculumRuleInput['scope']) => {
    setRuleForm((current) => ({
      ...current,
      scope,
      main_major_id: scope === 'main_major' ? selectedMainId : null,
      child_major_id: scope === 'child_major' ? selectedChildId : null,
    }))
  }

  const handleRuleDelete = async (ruleId: string) => {
    setSaving(true)
    setError('')
    setNotice('')

    try {
      await deleteCurriculumRule(ruleId)
      setNotice('Curriculum rule removed.')
      await loadData()
    } catch (ruleError) {
      setError(getErrorMessage(ruleError, 'Curriculum rule could not be removed'))
    } finally {
      setSaving(false)
    }
  }

  const courseDialogTitle = selectedCourseId ? 'Course setup' : 'New catalog course'
  const courseDialogDescription = 'Edit the catalog course and attach it to the selected curriculum.'

  const courseEditor = (
    <section className="workspace-panel admin-course-setup-panel">
      <div className="workspace-section-heading">
        <div>
          <h2>{selectedCourseId ? 'Edit catalog course' : 'Create catalog course'}</h2>
          <p>Catalog courses are reusable across majors and offerings.</p>
        </div>
      </div>

      <form className="workspace-form" onSubmit={(event) => void handleCourseSubmit(event)}>
        <label>
          <span>Course code</span>
          <input
            value={courseForm.code}
            onChange={(event) =>
              setCourseForm((current) => ({ ...current, code: event.target.value }))
            }
            placeholder="Enter course code"
            required
          />
        </label>

        <label>
          <span>Course title</span>
          <input
            value={courseForm.title}
            onChange={(event) =>
              setCourseForm((current) => ({ ...current, title: event.target.value }))
            }
            placeholder="Enter course title"
            required
          />
        </label>

        <label>
          <span>Description</span>
          <textarea
            value={courseForm.description}
            onChange={(event) =>
              setCourseForm((current) => ({ ...current, description: event.target.value }))
            }
          />
        </label>

        <label>
          <span>Credit points</span>
          <input
            type="number"
            min="0.5"
            step="0.5"
            value={courseForm.credit_points}
            onChange={(event) =>
              setCourseForm((current) => ({
                ...current,
                credit_points: Number(event.target.value),
              }))
            }
            required
          />
        </label>

        {courseSaveNeedsCurriculumRule && (
          <fieldset className="admin-course-rule-fieldset">
            <legend>Curriculum rule</legend>
            <p>
              {selectedCourseId
                ? 'Attach this catalog course to the selected curriculum.'
                : 'Required for every new catalog course.'}
            </p>

            <div className="workspace-form-grid">
              <label>
                <span>Type</span>
                <select
                  value={ruleForm.rule_type}
                  onChange={(event) =>
                    handleRuleTypeChange(event.target.value as CurriculumRuleInput['rule_type'])
                  }
                >
                  <option value="core">Core</option>
                  <option value="elective">Elective</option>
                  <option value="major">Major</option>
                </select>
              </label>

              <label>
                <span>Scope</span>
                <select
                  value={ruleForm.scope}
                  onChange={(event) =>
                    handleRuleScopeChange(event.target.value as CurriculumRuleInput['scope'])
                  }
                  disabled={ruleForm.rule_type !== 'elective'}
                >
                  <option value="global">All main majors</option>
                  <option value="main_major">Selected main major</option>
                  <option value="child_major">Selected child major</option>
                </select>
              </label>
            </div>
          </fieldset>
        )}

        <button type="submit" disabled={saving || courseSaveRuleIncomplete}>
          {saving
            ? 'Saving...'
            : selectedCourseId
              ? courseSaveNeedsCurriculumRule
                ? 'Save course and add rule'
                : 'Save catalog course'
              : 'Create catalog course'}
        </button>

        {selectedCourseId && (
          <button
            type="button"
            className="workspace-danger-action workspace-danger-action--wide"
            onClick={() => void handleDeleteCourse()}
            disabled={saving}
          >
            Delete catalog course
          </button>
        )}
      </form>

      {selectedCourseRules.length > 0 && (
        <div className="admin-course-rules-list">
          <h3>Attached curriculum rules</h3>
          <div className="workspace-table workspace-table--spaced">
            {selectedCourseRules.map((rule) => (
              <div className="workspace-row workspace-row--four" key={rule.id}>
                <span>
                  <strong>{ruleTypeLabels[rule.rule_type]}</strong>
                  <small>{data ? ruleScopeDetail(rule, data) : 'Scope'}</small>
                </span>
                <span>{scopeLabels[rule.scope]}</span>
                <span>{coursesById.get(rule.course_id)?.code ?? 'Course'}</span>
                <button
                  type="button"
                  className="workspace-danger-action"
                  onClick={() => void handleRuleDelete(rule.id)}
                  disabled={saving}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedCourseId && (
        <div className="admin-course-rules-list">
          <div className="workspace-section-heading">
            <div>
              <h3>Prerequisite requirements</h3>
              <p>All groups must be satisfied. Course options inside one group are alternatives.</p>
            </div>
            <div className="workspace-toolbar">
              <button type="button" className="workspace-secondary-action" onClick={handleAddCreditPrerequisite}>
                Add credits
              </button>
              <button type="button" className="workspace-secondary-action" onClick={handleAddCoursePrerequisite}>
                Add courses
              </button>
            </div>
          </div>

          <div className="workspace-table workspace-table--spaced">
            {prerequisiteGroups.map((group, groupIndex) => (
              <div className="workspace-row workspace-row--four" key={`${group.requirement_type}-${groupIndex}`}>
                <span>
                  <strong>{prerequisiteTypeLabels[group.requirement_type]}</strong>
                  <small>
                    {group.requirement_type === 'completed_credit_points'
                      ? 'Minimum completed curriculum credit points'
                      : 'Pass one listed course, unless concurrent is allowed'}
                  </small>
                </span>

                {group.requirement_type === 'completed_credit_points' ? (
                  <label className="admin-course-compact-field">
                    <span>Credit points</span>
                    <input
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={group.minimum_credit_points ?? 0}
                      onChange={(event) =>
                        updatePrerequisiteGroup(groupIndex, {
                          minimum_credit_points: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                ) : (
                  <div className="admin-prerequisite-options">
                    {group.options.map((option, optionIndex) => (
                      <div className="workspace-form-grid" key={`${groupIndex}-${optionIndex}`}>
                        <label>
                          <span>Course</span>
                          <select
                            value={option.required_course_id}
                            onChange={(event) =>
                              updatePrerequisiteOption(groupIndex, optionIndex, {
                                required_course_id: event.target.value,
                              })
                            }
                          >
                            <option value="">Choose course</option>
                            {availablePrerequisiteCourses.map((course) => (
                              <option key={course.id} value={course.id}>
                                {course.code} - {course.title}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>Mode</span>
                          <select
                            value={option.requirement_mode}
                            onChange={(event) =>
                              updatePrerequisiteOption(groupIndex, optionIndex, {
                                requirement_mode: event.target.value as CoursePrerequisiteOptionInput['requirement_mode'],
                              })
                            }
                          >
                            {Object.entries(prerequisiteModeLabels).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          className="workspace-danger-action"
                          onClick={() => removePrerequisiteOption(groupIndex, optionIndex)}
                          disabled={group.options.length <= 1}
                        >
                          Remove option
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="workspace-secondary-action"
                      onClick={() => addPrerequisiteOption(groupIndex)}
                    >
                      Add alternative
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  className="workspace-danger-action"
                  onClick={() => handleRemovePrerequisiteGroup(groupIndex)}
                >
                  Remove
                </button>
              </div>
            ))}

            {prerequisiteGroups.length === 0 && (
              <div className="workspace-empty-state">No prerequisite requirements.</div>
            )}
          </div>

          <button
            type="button"
            className="workspace-primary-action admin-course-prerequisite-save"
            onClick={() => void handlePrerequisiteSave()}
            disabled={saving || prerequisiteSaveIncomplete}
          >
            Save prerequisites
          </button>
        </div>
      )}
    </section>
  )

  return (
    <section className="workspace-page admin-courses-page">
      <header className="workspace-page-header">
        <span className="workspace-eyebrow">Admin workspace</span>
        <h1 className="workspace-page-title">Course management</h1>
        <p className="workspace-page-subtitle">
          Manage reusable catalog courses, curriculum rules, and prerequisite requirements.
        </p>
      </header>

      <WorkspaceAlertStack
        error={error}
        notice={notice}
        onDismissError={() => setError('')}
        onDismissNotice={() => setNotice('')}
      />

      {loading ? (
        <section className="workspace-panel">Loading courses...</section>
      ) : (
        <div className="workspace-grid">
          <section className="workspace-grid admin-course-browser" aria-label="Curriculum browser">
            <div className="admin-course-picker-group admin-course-picker-group--main">
              <span className="admin-course-picker-label">Majors</span>
              <div
                className="workspace-toolbar admin-course-picker admin-course-picker--main"
                aria-label="Main majors"
              >
                {selectedMainMajors.map((mainMajor) => (
                  <button
                    key={mainMajor.id}
                    type="button"
                    className={`workspace-tab admin-course-tab${selectedMainId === mainMajor.id ? ' workspace-tab--active' : ''}`}
                    onClick={() => handleMainMajorClick(mainMajor.id)}
                  >
                    {mainMajor.title}
                  </button>
                ))}
              </div>
            </div>

            <div className="admin-course-picker-group admin-course-picker-group--child">
              <span className="admin-course-picker-label"></span>
              <div
                className="workspace-toolbar admin-course-picker admin-course-picker--child"
                aria-label="Child majors"
              >
                {selectedChildMajors.map((childMajor) => (
                  <button
                    key={childMajor.id}
                    type="button"
                    className={`workspace-tab workspace-tab--quiet admin-course-tab${selectedChildId === childMajor.id ? ' workspace-tab--active' : ''}`}
                    onClick={() => handleChildMajorClick(childMajor.id)}
                  >
                    {childMajor.title}
                  </button>
                ))}
              </div>
            </div>

            <section className="workspace-panel">
              <div className="workspace-section-heading">
                <div>
                  <h2>Curriculum courses</h2>
                  <p>
                    {filteredCurriculumCourseRows.length} rules visible
                  </p>
                </div>
                <button
                  type="button"
                  className="workspace-secondary-action"
                  onClick={openNewCourseDialog}
                >
                  New catalog course
                </button>
              </div>

              <label className="admin-course-list-search">
                <span>Search curriculum courses</span>
                <input
                  value={curriculumCourseQuery}
                  onChange={(event) => {
                    setCurriculumCourseQuery(event.target.value)
                    setCurriculumCoursePage(1)
                  }}
                  placeholder="Search code, title, description, type, or scope"
                />
              </label>

              <div className="workspace-table" role="table" aria-label="Curriculum courses">
                {curriculumCoursePageState.items.map(({ course, rule }) => {
                  return (
                    <button
                      key={rule.id}
                      type="button"
                      className={`workspace-row workspace-row--button${selectedCourseId === course.id ? ' workspace-row--active' : ''}`}
                      onClick={() => openCourseRuleDialog(course)}
                    >
                      <span>
                        <strong>{course.code}</strong>
                        <small>{course.title}</small>
                      </span>
                      <span>{ruleTypeLabels[rule.rule_type]}</span>
                      <span>
                        {scopeLabels[rule.scope]}
                        <small>{data ? ruleScopeDetail(rule, data) : 'Scope'}</small>
                      </span>
                    </button>
                  )
                })}

                {selectedCurriculumRules.length === 0 && (
                  <div className="workspace-empty-state">
                    No curriculum rules yet. Add a catalog course and attach a rule.
                  </div>
                )}
                {selectedCurriculumRules.length > 0 && filteredCurriculumCourseRows.length === 0 && (
                  <div className="workspace-empty-state">No curriculum courses match this search.</div>
                )}
              </div>

              {filteredCurriculumCourseRows.length > 0 && (
                <div className="admin-course-pagination" aria-label="Curriculum courses pagination">
                  <button
                    type="button"
                    className="workspace-secondary-action"
                    onClick={() => setCurriculumCoursePage(curriculumCoursePageState.page - 1)}
                    disabled={curriculumCoursePageState.page <= 1}
                  >
                    Previous
                  </button>
                  <span>
                    Page {curriculumCoursePageState.page} of {curriculumCoursePageState.totalPages}
                  </span>
                  <button
                    type="button"
                    className="workspace-secondary-action"
                    onClick={() => setCurriculumCoursePage(curriculumCoursePageState.page + 1)}
                    disabled={curriculumCoursePageState.page >= curriculumCoursePageState.totalPages}
                  >
                    Next
                  </button>
                </div>
              )}
            </section>

            <section className="workspace-panel">
              <div className="workspace-section-heading">
                <div>
                  <h2>Catalog</h2>
                  <p>{filteredCatalogCourseRows.length} reusable course records.</p>
                </div>
              </div>

              <label className="admin-course-list-search">
                <span>Search catalog</span>
                <input
                  value={catalogCourseQuery}
                  onChange={(event) => {
                    setCatalogCourseQuery(event.target.value)
                    setCatalogCoursePage(1)
                  }}
                  placeholder="Search code, title, or description"
                />
              </label>

              <div className="workspace-table" role="table" aria-label="Course catalog">
                {catalogCoursePageState.items.map(({ course, offeringCount }) => (
                  <button
                    key={course.id}
                    type="button"
                    className={`workspace-row workspace-row--button${selectedCourseId === course.id ? ' workspace-row--active' : ''}`}
                    onClick={() => openCourseRuleDialog(course)}
                  >
                    <span>
                      <strong>{course.code}</strong>
                      <small>{course.title}</small>
                    </span>
                    <span>Catalog</span>
                    <span>{offeringCount} offerings</span>
                  </button>
                ))}

                {(data?.courses.length ?? 0) === 0 && (
                  <div className="workspace-empty-state">No catalog courses yet.</div>
                )}
                {(data?.courses.length ?? 0) > 0 && filteredCatalogCourseRows.length === 0 && (
                  <div className="workspace-empty-state">No catalog courses match this search.</div>
                )}
              </div>

              {filteredCatalogCourseRows.length > 0 && (
                <div className="admin-course-pagination" aria-label="Catalog pagination">
                  <button
                    type="button"
                    className="workspace-secondary-action"
                    onClick={() => setCatalogCoursePage(catalogCoursePageState.page - 1)}
                    disabled={catalogCoursePageState.page <= 1}
                  >
                    Previous
                  </button>
                  <span>
                    Page {catalogCoursePageState.page} of {catalogCoursePageState.totalPages}
                  </span>
                  <button
                    type="button"
                    className="workspace-secondary-action"
                    onClick={() => setCatalogCoursePage(catalogCoursePageState.page + 1)}
                    disabled={catalogCoursePageState.page >= catalogCoursePageState.totalPages}
                  >
                    Next
                  </button>
                </div>
              )}
            </section>
          </section>

          {courseDialogMode !== null && (
            <div className="workspace-modal-backdrop">
              <div
                className="workspace-modal workspace-modal--wide"
                role="dialog"
                aria-modal="true"
                aria-labelledby="course-dialog-title"
              >
                <div className="workspace-modal-header">
                  <div>
                    <h2 id="course-dialog-title">{courseDialogTitle}</h2>
                    <p>{courseDialogDescription}</p>
                  </div>
                  <button
                    type="button"
                    className="workspace-modal-close"
                    onClick={closeCourseDialog}
                  >
                    Close
                  </button>
                </div>

                <div className="workspace-modal-body">{courseEditor}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export default AdminCoursesPage
