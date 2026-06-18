import express from 'express'
import { rm } from 'node:fs/promises'
import multer from 'multer'

import { requireRole } from '../auth-middleware.js'
import { prisma } from '../db.js'
import { asyncHandler, httpError, requireBodyString, sendError } from '../http.js'
import {
  mapChildMajor,
  mapCourse,
  mapCourseContentPackageSummary,
  mapCourseRegistrationRequest,
  mapCoursePrerequisiteGroup,
  mapCoursePrerequisiteOption,
  mapCurriculumRule,
  mapManagedCredential,
  mapMainMajor,
  mapOffering,
  mapStudentCourseCompletion,
  mapUserProfile,
} from '../mappers.js'
import { generateTemporaryPassword, hashPassword } from '../services/passwords.js'
import { readAdminUserCreateInput } from '../services/adminUsers.js'
import { importCanvasCourseContent } from '../services/courseContentImport.js'
import { validateCurriculumRuleInput } from '../services/curriculum.js'
import { createCatalogCourseWithRule } from '../services/courseCreation.js'
import { deleteCatalogCourse } from '../services/courseDeletion.js'
import {
  approveRegistrationRequest,
  rejectRegistrationRequest,
} from '../services/registrationRequests.js'
import {
  getIneligibleStaffForCourse,
  getTeacherCourseEligibilityError,
} from '../services/teacherEligibility.js'

export const adminRouter = express.Router()

const courseContentUpload = multer({ dest: 'uploads/imports' })

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

const loadTeachingEligibilityContext = async (courseId) => {
  const [mainMajors, childMajors, curriculumRules] = await Promise.all([
    prisma.mainMajor.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.childMajor.findMany({ orderBy: [{ mainMajorId: 'asc' }, { sortOrder: 'asc' }] }),
    prisma.curriculumRule.findMany({ where: { courseId } }),
  ])

  return {
    courseId,
    mainMajors,
    childMajors,
    curriculumRules,
  }
}

const assertTeacherCanTeachCourse = async (courseId, teacherId) => {
  const [teacher, context] = await Promise.all([
    prisma.user.findUnique({ where: { id: teacherId } }),
    loadTeachingEligibilityContext(courseId),
  ])
  const error = getTeacherCourseEligibilityError({
    ...context,
    teacher,
  })

  if (error) {
    throw httpError(400, error)
  }
}

const assertStaffCanTeachCourse = async (courseId, staff) => {
  const context = await loadTeachingEligibilityContext(courseId)
  const ineligibleStaff = getIneligibleStaffForCourse({
    ...context,
    staff,
  })

  if (ineligibleStaff.length > 0) {
    throw httpError(400, ineligibleStaff[0].reason)
  }
}

const readCreditPoints = (input) => {
  if (input.credit_points === undefined && input.creditPoints === undefined) {
    return undefined
  }

  const creditPoints = Number(input.credit_points ?? input.creditPoints)

  if (!Number.isFinite(creditPoints) || creditPoints <= 0) {
    throw httpError(400, 'Credit points must be greater than 0.')
  }

  return creditPoints
}

const validatePrerequisiteGroups = (input) => {
  const groups = Array.isArray(input.groups) ? input.groups : []

  return groups.map((group, groupIndex) => {
    const requirementType = group.requirement_type

    if (!['completed_credit_points', 'course_alternatives'].includes(requirementType)) {
      throw httpError(400, 'Prerequisite group type is invalid.')
    }

    if (requirementType === 'completed_credit_points') {
      const minimumCreditPoints = Number(group.minimum_credit_points)

      if (!Number.isFinite(minimumCreditPoints) || minimumCreditPoints <= 0) {
        throw httpError(400, 'Completed credit point prerequisites require a positive value.')
      }

      return {
        requirementType,
        minimumCreditPoints,
        sortOrder: groupIndex,
        options: [],
      }
    }

    const options = Array.isArray(group.options) ? group.options : []

    if (options.length === 0) {
      throw httpError(400, 'Course prerequisite groups require at least one course option.')
    }

    return {
      requirementType,
      minimumCreditPoints: null,
      sortOrder: groupIndex,
      options: options.map((option, optionIndex) => {
        const requiredCourseId = requireBodyString(option, 'required_course_id')
        const requirementMode =
          option.requirement_mode === 'passed_or_concurrent' ? 'passed_or_concurrent' : 'passed'

        return {
          requiredCourseId,
          requirementMode,
          sortOrder: optionIndex,
        }
      }),
    }
  })
}

const savePrerequisiteGroups = async (courseId, groups) =>
  prisma.$transaction(async (transaction) => {
    await transaction.coursePrerequisiteGroup.deleteMany({ where: { courseId } })

    for (const group of groups) {
      await transaction.coursePrerequisiteGroup.create({
        data: {
          courseId,
          requirementType: group.requirementType,
          minimumCreditPoints: group.minimumCreditPoints,
          sortOrder: group.sortOrder,
          options: {
            create: group.options.map((option) => ({
              requiredCourseId: option.requiredCourseId,
              requirementMode: option.requirementMode,
              sortOrder: option.sortOrder,
            })),
          },
        },
      })
    }
  })

const createUserRecord = async (input, currentUserId = null) => {
  const {
    fullName,
    sourceUserId,
    role,
    campus,
    email,
    childMajorId,
    mainMajorId,
  } = readAdminUserCreateInput(input)
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
      mainMajorId,
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
    const [
      catalog,
      courses,
      rules,
      prerequisiteGroups,
      prerequisiteOptions,
      studentCompletions,
      offerings,
      contentPackages,
      registrationRequests,
      profiles,
    ] = await Promise.all([
      orderedCatalog(),
      prisma.course.findMany({ orderBy: { code: 'asc' } }),
      prisma.curriculumRule.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.coursePrerequisiteGroup.findMany({ orderBy: [{ courseId: 'asc' }, { sortOrder: 'asc' }] }),
      prisma.coursePrerequisiteOption.findMany({ orderBy: [{ groupId: 'asc' }, { sortOrder: 'asc' }] }),
      prisma.studentCourseCompletion.findMany({ orderBy: [{ studentId: 'asc' }, { completedAt: 'desc' }] }),
      prisma.courseOffering.findMany({
        include: offeringsInclude,
        orderBy: [{ academicYear: 'desc' }, { term: 'asc' }],
      }),
      prisma.courseContentPackage.findMany({
        where: { scope: 'offering' },
        include: {
          _count: {
            select: {
              assets: true,
              items: true,
              modules: true,
            },
          },
        },
        orderBy: { importedAt: 'desc' },
      }),
      prisma.courseRegistrationRequest.findMany({ orderBy: [{ requestedAt: 'desc' }] }),
      prisma.user.findMany({ orderBy: [{ displayName: 'asc' }, { email: 'asc' }] }),
    ])

    response.json({
      ...catalog,
      courses: courses.map(mapCourse),
      curriculumRules: rules.map(mapCurriculumRule),
      prerequisiteGroups: prerequisiteGroups.map(mapCoursePrerequisiteGroup),
      prerequisiteOptions: prerequisiteOptions.map(mapCoursePrerequisiteOption),
      studentCompletions: studentCompletions.map(mapStudentCourseCompletion),
      offerings: offerings.map(mapOffering),
      contentPackages: contentPackages.map(mapCourseContentPackageSummary),
      registrationRequests: registrationRequests.map(mapCourseRegistrationRequest),
      profiles: profiles.map(mapUserProfile),
    })
  }),
)

adminRouter.post(
  '/courses',
  asyncHandler(async (request, response) => {
    const course = await createCatalogCourseWithRule(
      prisma,
      request.body,
      request.currentUser.id,
    )

    response.status(201).json(mapCourse(course))
  }),
)

adminRouter.patch(
  '/courses/:id',
  asyncHandler(async (request, response) => {
    const creditPoints = readCreditPoints(request.body)
    const course = await prisma.course.update({
      where: { id: request.params.id },
      data: {
        code: request.body.code ? String(request.body.code).trim().toUpperCase() : undefined,
        title: request.body.title ? String(request.body.title).trim() : undefined,
        description:
          request.body.description === undefined ? undefined : String(request.body.description).trim(),
        creditPoints,
      },
    })

    response.json(mapCourse(course))
  }),
)

adminRouter.put(
  '/courses/:id/prerequisites',
  asyncHandler(async (request, response) => {
    const groups = validatePrerequisiteGroups(request.body)

    await savePrerequisiteGroups(request.params.id, groups)
    response.json({ success: true })
  }),
)

adminRouter.delete(
  '/courses/:id',
  asyncHandler(async (request, response) => {
    await deleteCatalogCourse(prisma, request.params.id)
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

    if (teacherId) {
      await assertTeacherCanTeachCourse(courseId, teacherId)
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
    const nextCourseId = request.body.course_id ? String(request.body.course_id) : undefined

    if (nextCourseId) {
      const existingOffering = await prisma.courseOffering.findUnique({
        where: { id: request.params.id },
        include: {
          staff: {
            include: {
              user: true,
            },
          },
        },
      })

      if (!existingOffering) {
        throw httpError(404, 'Course offering was not found.')
      }

      await assertStaffCanTeachCourse(nextCourseId, existingOffering.staff)
    }

    const offering = await prisma.courseOffering.update({
      where: { id: request.params.id },
      data: {
        courseId: nextCourseId,
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
  '/course-offerings/:id/content-import',
  courseContentUpload.single('file'),
  asyncHandler(async (request, response) => {
    if (!request.file) {
      sendError(response, 400, 'A course content ZIP file is required.')
      return
    }

    try {
      const offering = await prisma.courseOffering.findUnique({
        where: { id: request.params.id },
      })

      if (!offering) {
        sendError(response, 404, 'Course offering was not found.')
        return
      }

      const result = await importCanvasCourseContent(prisma, {
        adminId: request.currentUser.id,
        offering,
        originalFileName: request.file.originalname,
        zipPath: request.file.path,
      })

      response.status(201).json(result)
    } finally {
      await rm(request.file.path, { force: true }).catch(() => undefined)
    }
  }),
)

adminRouter.post(
  '/course-offerings/:id/members',
  asyncHandler(async (request, response) => {
    const role = request.body.role
    const userId = requireBodyString(request.body, 'user_id')

    if (role === 'student') {
      const [student, targetOffering] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId } }),
        prisma.courseOffering.findUnique({ where: { id: request.params.id } }),
      ])

      if (!student || student.role !== 'student') {
        sendError(response, 400, 'Only student profiles can be enrolled as students.')
        return
      }

      if (!targetOffering) {
        sendError(response, 404, 'Course offering was not found.')
        return
      }

      await prisma.enrollment.upsert({
        where: { offeringId_userId: { offeringId: request.params.id, userId } },
        update: {},
        create: { offeringId: request.params.id, userId },
      })
      await prisma.courseRegistrationRequest.updateMany({
        where: {
          offeringId: request.params.id,
          userId,
          status: {
            not: 'approved',
          },
        },
        data: {
          status: 'approved',
          decidedAt: new Date(),
          decidedById: request.currentUser.id,
        },
      })
    } else if (role === 'teacher' || role === 'teaching_assistant') {
      const offering = await prisma.courseOffering.findUnique({
        where: { id: request.params.id },
        select: { courseId: true },
      })

      if (!offering) {
        sendError(response, 404, 'Course offering was not found.')
        return
      }

      await assertTeacherCanTeachCourse(offering.courseId, userId)

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

adminRouter.post(
  '/course-registration-requests/:id/approve',
  asyncHandler(async (request, response) => {
    await approveRegistrationRequest(prisma, {
      requestId: request.params.id,
      adminId: request.currentUser.id,
    })

    response.json({ success: true })
  }),
)

adminRouter.post(
  '/course-registration-requests/:id/reject',
  asyncHandler(async (request, response) => {
    await rejectRegistrationRequest(prisma, {
      requestId: request.params.id,
      adminId: request.currentUser.id,
    })

    response.json({ success: true })
  }),
)

adminRouter.post(
  '/users/:id/completed-courses',
  asyncHandler(async (request, response) => {
    const courseId = requireBodyString(request.body, 'course_id')
    const completion = await prisma.studentCourseCompletion.upsert({
      where: {
        studentId_courseId: {
          studentId: request.params.id,
          courseId,
        },
      },
      update: {
        createdById: request.currentUser.id,
      },
      create: {
        studentId: request.params.id,
        courseId,
        createdById: request.currentUser.id,
      },
    })

    response.status(201).json(mapStudentCourseCompletion(completion))
  }),
)

adminRouter.delete(
  '/student-course-completions/:id',
  asyncHandler(async (request, response) => {
    await prisma.studentCourseCompletion.delete({ where: { id: request.params.id } })
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
      const offering = await prisma.courseOffering.findUnique({
        where: { id: offeringId },
        select: { courseId: true },
      })

      if (!offering) {
        sendError(response, 404, 'Course offering was not found.')
        return
      }

      await assertTeacherCanTeachCourse(offering.courseId, String(request.body.user_id))

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
    const [profiles, managedCredentials, courses, studentCompletions] = await Promise.all([
      prisma.user.findMany({ orderBy: [{ displayName: 'asc' }, { email: 'asc' }] }),
      prisma.managedUserCredential.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.course.findMany({ orderBy: { code: 'asc' } }),
      prisma.studentCourseCompletion.findMany({ orderBy: [{ studentId: 'asc' }, { completedAt: 'desc' }] }),
    ])

    response.json({
      profiles: profiles.map(mapUserProfile),
      managedCredentials: managedCredentials.map(mapManagedCredential),
      courses: courses.map(mapCourse),
      studentCompletions: studentCompletions.map(mapStudentCourseCompletion),
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
    const mainMajorId =
      role === 'teacher'
        ? request.body.main_major_id === undefined
          ? undefined
          : request.body.main_major_id || null
        : role
          ? null
          : request.body.main_major_id === undefined
            ? undefined
            : request.body.main_major_id || null
    const childMajorId =
      role === 'student'
        ? request.body.child_major_id === undefined
          ? undefined
          : request.body.child_major_id || null
        : role
          ? null
          : request.body.child_major_id === undefined
            ? undefined
            : request.body.child_major_id || null
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
        mainMajorId,
        childMajorId,
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
    const user = await prisma.$transaction(async (transaction) => {
      const updatedUser = await transaction.user.update({
        where: { id: request.params.id },
        data: {
          passwordHash: hashPassword(tempPassword),
          mustChangePassword: true,
        },
      })

      await transaction.managedUserCredential.upsert({
        where: {
          userId: updatedUser.id,
        },
        create: {
          userId: updatedUser.id,
          tempPassword,
          createdById: request.currentUser.id,
        },
        update: {
          tempPassword,
          createdById: request.currentUser.id,
          createdAt: new Date(),
        },
      })

      return updatedUser
    })

    response.json({
      success: true,
      user_id: user.id,
      email: user.email,
      temp_password: tempPassword,
    })
  }),
)
