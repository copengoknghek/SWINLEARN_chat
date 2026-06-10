const requiredRuleTypes = new Set(['core', 'major'])

const courseKey = (course) => course.code ?? course.id

const byCourseCode = (first, second) => courseKey(first).localeCompare(courseKey(second))

const findChildMajor = (childMajors, childMajorId) =>
  childMajors.find((childMajor) => childMajor.id === childMajorId) ?? null

const ruleAppliesToChildMajor = (rule, childMajor) => {
  if (rule.scope === 'global') {
    return true
  }

  if (rule.scope === 'main_major') {
    return rule.main_major_id === childMajor.main_major_id
  }

  return rule.scope === 'child_major' && rule.child_major_id === childMajor.id
}

export function getCurriculumForChildMajor({ childMajorId, childMajors, courses, rules }) {
  const childMajor = findChildMajor(childMajors, childMajorId)

  if (!childMajor) {
    return {
      required: [],
      electives: [],
    }
  }

  const coursesById = new Map(courses.map((course) => [course.id, course]))
  const requiredById = new Map()
  const electiveById = new Map()

  for (const rule of rules) {
    if (!ruleAppliesToChildMajor(rule, childMajor)) {
      continue
    }

    const course = coursesById.get(rule.course_id)

    if (!course) {
      continue
    }

    if (requiredRuleTypes.has(rule.rule_type)) {
      requiredById.set(course.id, course)
      electiveById.delete(course.id)
      continue
    }

    if (!requiredById.has(course.id)) {
      electiveById.set(course.id, course)
    }
  }

  return {
    required: [...requiredById.values()].sort(byCourseCode),
    electives: [...electiveById.values()].sort(byCourseCode),
  }
}

export function validateCurriculumRuleInput(input) {
  const ruleType = input.rule_type
  const scope = input.scope
  const mainMajorId = input.main_major_id || null
  const childMajorId = input.child_major_id || null

  if (!['core', 'major', 'elective'].includes(ruleType)) {
    throw new Error('Curriculum rule type must be core, major, or elective.')
  }

  if (!['global', 'main_major', 'child_major'].includes(scope)) {
    throw new Error('Curriculum scope must be global, main_major, or child_major.')
  }

  if (ruleType === 'core' && scope !== 'main_major') {
    throw new Error('Core courses must be scoped to one main major.')
  }

  if (ruleType === 'major' && scope !== 'child_major') {
    throw new Error('Major courses must be scoped to one child major.')
  }

  if (scope === 'global' && (mainMajorId || childMajorId)) {
    throw new Error('Global curriculum rules cannot target a major.')
  }

  if (scope === 'main_major' && (!mainMajorId || childMajorId)) {
    throw new Error('Main-major curriculum rules must target exactly one main major.')
  }

  if (scope === 'child_major' && (mainMajorId || !childMajorId)) {
    throw new Error('Child-major curriculum rules must target exactly one child major.')
  }

  return {
    rule_type: ruleType,
    scope,
    main_major_id: mainMajorId,
    child_major_id: childMajorId,
    scope_key: scope === 'global' ? 'global' : mainMajorId ?? childMajorId,
  }
}
