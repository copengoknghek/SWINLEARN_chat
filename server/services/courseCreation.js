import { httpError, requireBodyString } from '../http.js'
import { validateCurriculumRuleInput } from './curriculum.js'

const requiredRuleMessage = 'A curriculum rule is required before creating a catalog course.'
const defaultCreditPoints = 12.5

const readCreditPoints = (input) => {
  if (input.credit_points === undefined && input.creditPoints === undefined) {
    return defaultCreditPoints
  }

  const creditPoints = Number(input.credit_points ?? input.creditPoints)

  if (!Number.isFinite(creditPoints) || creditPoints <= 0) {
    throw httpError(400, 'Credit points must be greater than 0.')
  }

  return creditPoints
}

const requireCurriculumRule = (input) => {
  const rule = input.curriculum_rule

  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
    throw httpError(400, requiredRuleMessage)
  }

  return rule
}

export async function createCatalogCourseWithRule(prismaClient, input, currentUserId) {
  const code = requireBodyString(input, 'code').toUpperCase()
  const title = requireBodyString(input, 'title')
  const description = String(input.description ?? '').trim()
  const creditPoints = readCreditPoints(input)
  const validatedRule = validateCurriculumRuleInput(requireCurriculumRule(input))

  return prismaClient.$transaction(async (transaction) => {
    const course = await transaction.course.create({
      data: {
        code,
        title,
        description,
        creditPoints,
        createdById: currentUserId,
      },
    })

    await transaction.curriculumRule.create({
      data: {
        courseId: course.id,
        ruleType: validatedRule.rule_type,
        scope: validatedRule.scope,
        scopeKey: validatedRule.scope_key,
        mainMajorId: validatedRule.main_major_id,
        childMajorId: validatedRule.child_major_id,
      },
    })

    return course
  })
}
