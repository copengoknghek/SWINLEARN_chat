import express from 'express'

import { requireRole } from '../auth-middleware.js'
import { prisma } from '../db.js'
import { asyncHandler, requireBodyString, sendError } from '../http.js'
import {
  mapChildMajor,
  mapCourse,
  mapCurriculumRule,
  mapManagedCredential,
  mapMainMajor,
  mapOffering,
  mapUserProfile,
} from '../mappers.js'
import { generateTemporaryPassword, hashPassword } from '../services/passwords.js'
import { validateCurriculumRuleInput } from '../services/curriculum.js'

export const adminRouter = express.Router()

adminRouter.use((request, response, next) => {
  const user = requireRole(request, response, ['admin'])

  if (!user) {
    return
  }

  next()
})

const orderedCatalog = async () => {
  const [mainMajors, childMajors] = await Promise.all([
    prisma.mainMajor.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.childMajor.findMany({ orderBy: [{ mainMajorId: 'asc' }, { sortOrder: 'asc' }] }),
  ])

  return {
    mainMajors: mainMajors.map(mapMainMajor),
    childMajors: childMajors.map(mapChildMajor),
  }
}

const offeringsInclude = {
  course: true,
  staff: true,
  enrollments: true,
}

const createUserRecord = async (input, currentUserId = null) => {
  const fullName = requireBodyString(input, 'full_name')
  const sourceUserId = requireBodyString(input, 'user_id').toUpperCase()
  const role = input.role === 'teacher' ? 'teacher' : 'student'
  const campus = ['hanoi', 'danang', 'hcm'].includes(input.campus) ? input.campus : 'hanoi'
  const childMajorId = role === 'student' && input.child_major_id ? input.child_major_id : null
  const emailDomain = role === 'student' ? 'student.swin.edu.au' : 'swin.edu.au'
  const email = `${sourceUserId.toLowerCase()}@${emailDomain}`
  const tempPassword = generateTemporaryPassword()
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: hashPassword(tempPassword),
      role,
      fullName,
      displayName: fullName,
      campus,
      studentId: sourceUserId,
      childMajorId,
      mustChangePassword: true,
      managedCredentials: {
        create: {
          tempPassword,
          createdById: currentUserId,
        },
      },
    },
  })

  return {
    success: true,
    user_id: user.id,
    email,
    temp_password: tempPassword,
  }
}

adminRouter.get(
  '/course-data',
  asyncHandler(async (_request, response) => {
    const [catalog, courses, rules, offerings, profiles] = await Promise.all([
      orderedCatalog(),
      prisma.course.findMany({ orderBy: { code: 'asc' } }),
      prisma.curriculumRule.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.courseOffering.findMany({
        include: offeringsInclude,
        orderBy: [{ academicYear: 'desc' }, { term: 'asc' }],
      }),
      prisma.user.findMany({ orderBy: [{ displayName: 'asc' }, { email: 'asc' }] }),
    ])

    response.json({
      ...catalog,
      courses: courses.map(mapCourse),
      curriculumRules: rules.map(mapCurriculumRule),
      offerings: offerings.map(mapOffering),
      profiles: profiles.map(mapUserProfile),
    })
  }),
)

adminRouter.post(
  '/courses',
  asyncHandler(async (request, response) => {
    const code = requireBodyString(request.body, 'code').toUpperCase()
    const title = requireBodyString(request.body, 'title')
    const description = String(request.body.description ?? '').trim()
    const course = await prisma.course.create({
      data: {
        code,
        title,
        description,
        createdById: request.currentUser.id,
      },
    })

    response.status(201).json(mapCourse(course))
  }),
)

adminRouter.patch(
  '/courses/:id',
  asyncHandler(async (request, response) => {
    const course = await prisma.course.update({
      where: { id: request.params.id },
      data: {
        code: request.body.code ? String(request.body.code).trim().toUpperCase() : undefined,
        title: request.body.title ? String(request.body.title).trim() : undefined,
        description:
          request.body.description === undefined ? undefined : String(request.body.description).trim(),
      },
    })

    response.json(mapCourse(course))
  }),
)

adminRouter.delete(
  '/courses/:id',
  asyncHandler(async (request, response) => {
    await prisma.course.delete({ where: { id: request.params.id } })
    response.json({ success: true })
  }),
)

adminRouter.post(
  '/curriculum-rules',
  asyncHandler(async (request, response) => {
    const courseId = requireBodyString(request.body, 'course_id')
    const validated = validateCurriculumRuleInput(request.body)
    const rule = await prisma.curriculumRule.create({
      data: {
        courseId,
        ruleType: validated.rule_type,
        scope: validated.scope,
        scopeKey: validated.scope_key,
        mainMajorId: validated.main_major_id,
        childMajorId: validated.child_major_id,
      },
    })

    response.status(201).json(mapCurriculumRule(rule))
  }),
)

adminRouter.patch(
  '/curriculum-rules/:id',
  asyncHandler(async (request, response) => {
    const validated = validateCurriculumRuleInput(request.body)
    const rule = await prisma.curriculumRule.update({
      where: { id: request.params.id },
      data: {
        courseId: request.body.course_id,
        ruleType: validated.rule_type,
        scope: validated.scope,
        scopeKey: validated.scope_key,
        mainMajorId: validated.main_major_id,
        childMajorId: validated.child_major_id,
      },
    })

    response.json(mapCurriculumRule(rule))
  }),
)

adminRouter.delete(
  '/curriculum-rules/:id',
  asyncHandler(async (request, response) => {
    await prisma.curriculumRule.delete({ where: { id: request.params.id } })
    response.json({ success: true })
  }),
)

adminRouter.post(
  '/course-offerings',
  asyncHandler(async (request, response) => {
    const courseId = requireBodyString(request.body, 'course_id')
    const term = requireBodyString(request.body, 'term')
    const academicYear = Number(request.body.academic_year)
    const status = request.body.status === 'archived' ? 'archived' : 'active'
    const teacherId = request.body.teacher_id ? String(request.body.teacher_id) : ''

    if (!Number.isInteger(academicYear) || academicYear < 2000) {
      sendError(response, 400, 'Academic year must be valid.')
      return
    }

    const offering = await prisma.courseOffering.create({
      data: {
        courseId,
        term,
        academicYear,
        status,
        createdById: request.currentUser.id,
        staff: teacherId
          ? {
              create: {
                userId: teacherId,
                role: 'teacher',
              },
            }
          : undefined,
      },
      include: offeringsInclude,
    })

    response.status(201).json(mapOffering(offering))
  }),
)

adminRouter.patch(
  '/course-offerings/:id',
  asyncHandler(async (request, response) => {
    const offering = await prisma.courseOffering.update({
      where: { id: request.params.id },
      data: {
        courseId: request.body.course_id ? String(request.body.course_id) : undefined,
        term: request.body.term ? String(request.body.term) : undefined,
        academicYear:
          request.body.academic_year === undefined ? undefined : Number(request.body.academic_year),
        status: request.body.status === 'archived' ? 'archived' : request.body.status === 'active' ? 'active' : undefined,
      },
      include: offeringsInclude,
    })

    response.json(mapOffering(offering))
  }),
)

adminRouter.delete(
  '/course-offerings/:id',
  asyncHandler(async (request, response) => {
    await prisma.courseOffering.delete({ where: { id: request.params.id } })
    response.json({ success: true })
  }),
)

adminRouter.post(
  '/course-offerings/:id/members',
  asyncHandler(async (request, response) => {
    const role = request.body.role
    const userId = requireBodyString(request.body, 'user_id')

    if (role === 'student') {
      await prisma.enrollment.upsert({
        where: { offeringId_userId: { offeringId: request.params.id, userId } },
        update: {},
        create: { offeringId: request.params.id, userId },
      })
    } else if (role === 'teacher' || role === 'teaching_assistant') {
      await prisma.courseStaff.upsert({
        where: { offeringId_userId: { offeringId: request.params.id, userId } },
        update: { role },
        create: { offeringId: request.params.id, userId, role },
      })
    } else {
      sendError(response, 400, 'Course member role is invalid.')
      return
    }

    response.json({ success: true })
  }),
)

adminRouter.put(
  '/course-offerings/:id/teaching-assistant',
  asyncHandler(async (request, response) => {
    const offeringId = request.params.id

    await prisma.courseStaff.deleteMany({
      where: {
        offeringId,
        role: 'teaching_assistant',
      },
    })

    if (request.body.user_id) {
      await prisma.courseStaff.upsert({
        where: {
          offeringId_userId: {
            offeringId,
            userId: String(request.body.user_id),
          },
        },
        update: {
          role: 'teaching_assistant',
        },
        create: {
          offeringId,
          userId: String(request.body.user_id),
          role: 'teaching_assistant',
        },
      })
    }

    response.json({ success: true })
  }),
)

adminRouter.delete(
  '/course-memberships/:membershipId',
  asyncHandler(async (request, response) => {
    const [kind, id] = decodeURIComponent(request.params.membershipId).split(':')

    if (kind === 'staff') {
      await prisma.courseStaff.delete({ where: { id } })
    } else if (kind === 'enrollment') {
      await prisma.enrollment.delete({ where: { id } })
    } else {
      sendError(response, 400, 'Course membership id is invalid.')
      return
    }

    response.json({ success: true })
  }),
)

adminRouter.get(
  '/users',
  asyncHandler(async (_request, response) => {
    const [profiles, managedCredentials] = await Promise.all([
      prisma.user.findMany({ orderBy: [{ displayName: 'asc' }, { email: 'asc' }] }),
      prisma.managedUserCredential.findMany({ orderBy: { createdAt: 'desc' } }),
    ])

    response.json({
      profiles: profiles.map(mapUserProfile),
      managedCredentials: managedCredentials.map(mapManagedCredential),
    })
  }),
)

adminRouter.post(
  '/users',
  asyncHandler(async (request, response) => {
    response.status(201).json(await createUserRecord(request.body, request.currentUser.id))
  }),
)

adminRouter.post(
  '/users/import',
  asyncHandler(async (request, response) => {
    const records = Array.isArray(request.body.records) ? request.body.records : []
    const results = []

    for (const [index, record] of records.entries()) {
      try {
        results.push({
          row: index + 2,
          ...(await createUserRecord(record, request.currentUser.id)),
        })
      } catch (error) {
        results.push({
          row: index + 2,
          email: '',
          success: false,
          error: error instanceof Error ? error.message : 'User could not be imported.',
        })
      }
    }

    response.json({ results })
  }),
)

adminRouter.patch(
  '/users/:id',
  asyncHandler(async (request, response) => {
    const role = ['admin', 'teacher', 'student'].includes(request.body.role) ? request.body.role : undefined
    const user = await prisma.user.update({
      where: { id: request.params.id },
      data: {
        fullName:
          request.body.full_name === undefined ? undefined : String(request.body.full_name).trim(),
        displayName:
          request.body.display_name === undefined
            ? undefined
            : String(request.body.display_name).trim(),
        role,
        campus: ['hanoi', 'danang', 'hcm'].includes(request.body.campus)
          ? request.body.campus
          : request.body.campus === null
            ? null
            : undefined,
        studentId:
          request.body.student_id === undefined
            ? undefined
            : String(request.body.student_id || '').trim().toUpperCase() || null,
        childMajorId:
          request.body.child_major_id === undefined
            ? undefined
            : request.body.child_major_id || null,
        status: request.body.status === 'inactive' ? 'inactive' : 'active',
      },
    })

    response.json(mapUserProfile(user))
  }),
)

adminRouter.delete(
  '/users/:id',
  asyncHandler(async (request, response) => {
    if (request.params.id === request.currentUser.id) {
      sendError(response, 400, 'You cannot delete your own account.')
      return
    }

    await prisma.user.delete({ where: { id: request.params.id } })
    response.json({ success: true })
  }),
)

adminRouter.post(
  '/users/:id/reset-password',
  asyncHandler(async (request, response) => {
    const tempPassword = generateTemporaryPassword()
    const user = await prisma.user.update({
      where: { id: request.params.id },
      data: {
        passwordHash: hashPassword(tempPassword),
        mustChangePassword: true,
        managedCredentials: {
          upsert: {
            create: {
              tempPassword,
              createdById: request.currentUser.id,
            },
            update: {
              tempPassword,
              createdById: request.currentUser.id,
            },
          },
        },
      },
    })

    response.json({
      success: true,
      user_id: user.id,
      email: user.email,
      temp_password: tempPassword,
    })
  }),
)
