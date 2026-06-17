import 'dotenv/config'

import { prisma } from '../server/db.js'

const demoUserIds = ['admin-demo', 'teacher-demo', 'student-demo']
const demoCourseCodes = [
  'COS30019',
  'COS20019',
  'COS20031',
  'COS30082',
  'COS30049',
  'SWE30003',
  'COS40007',
  'COS30018',
  'COS10005',
  'COS30008',
  'COS40003',
  'STA10003',
  'SWE30009',
  'COS30043',
  'ICT20016',
  'COS10009',
  'COS10004',
  'COS10025',
  'COS10026',
  'TNE10006',
  'COS20007',
  'COS40005',
  'COS40006',
]

async function main() {
  const [demoCourses, demoUsers] = await Promise.all([
    prisma.course.findMany({
      where: { code: { in: demoCourseCodes } },
      select: { id: true },
    }),
    prisma.user.findMany({
      where: { id: { in: demoUserIds } },
      select: { id: true },
    }),
  ])
  const demoCourseIds = demoCourses.map((course) => course.id)

  if (demoCourseIds.length > 0) {
    const demoOfferings = await prisma.courseOffering.findMany({
      where: { courseId: { in: demoCourseIds } },
      select: { id: true },
    })
    const demoOfferingIds = demoOfferings.map((offering) => offering.id)

    await prisma.inboxMessage.deleteMany({
      where: {
        OR: [
          { senderId: { in: demoUserIds } },
          { body: { contains: 'Demo accounts are ready' } },
        ],
      },
    })
    await prisma.inboxThreadParticipant.deleteMany({ where: { userId: { in: demoUserIds } } })
    await prisma.inboxThread.deleteMany({ where: { createdById: { in: demoUserIds } } })
    await prisma.courseSession.deleteMany({ where: { offeringId: { in: demoOfferingIds } } })
    await prisma.assignmentSubmission.deleteMany({ where: { studentId: { in: demoUserIds } } })
    await prisma.assignment.deleteMany({ where: { offeringId: { in: demoOfferingIds } } })
    await prisma.courseRegistrationRequest.deleteMany({
      where: {
        OR: [
          { offeringId: { in: demoOfferingIds } },
          { userId: { in: demoUserIds } },
        ],
      },
    })
    await prisma.enrollment.deleteMany({
      where: {
        OR: [
          { offeringId: { in: demoOfferingIds } },
          { userId: { in: demoUserIds } },
        ],
      },
    })
    await prisma.courseStaff.deleteMany({
      where: {
        OR: [
          { offeringId: { in: demoOfferingIds } },
          { userId: { in: demoUserIds } },
        ],
      },
    })
    await prisma.courseOffering.deleteMany({ where: { id: { in: demoOfferingIds } } })
    await prisma.studentCourseCompletion.deleteMany({
      where: {
        OR: [
          { courseId: { in: demoCourseIds } },
          { studentId: { in: demoUserIds } },
        ],
      },
    })
    await prisma.coursePrerequisiteOption.deleteMany({
      where: {
        OR: [
          { requiredCourseId: { in: demoCourseIds } },
          { group: { courseId: { in: demoCourseIds } } },
        ],
      },
    })
    await prisma.coursePrerequisiteGroup.deleteMany({ where: { courseId: { in: demoCourseIds } } })
    await prisma.curriculumRule.deleteMany({ where: { courseId: { in: demoCourseIds } } })
    await prisma.course.deleteMany({ where: { id: { in: demoCourseIds } } })
  }

  await prisma.managedUserCredential.deleteMany({ where: { userId: { in: demoUserIds } } })
  await prisma.userSession.deleteMany({ where: { userId: { in: demoUserIds } } })
  await prisma.user.deleteMany({ where: { id: { in: demoUserIds } } })

  console.log(`Removed ${demoCourses.length} demo course(s) and ${demoUsers.length} demo user(s).`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
