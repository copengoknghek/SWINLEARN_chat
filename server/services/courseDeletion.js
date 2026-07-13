import { cleanupOfferingVectors } from './swinlearnIndexing.js'

export async function deleteCatalogCourse(prismaClient, courseId) {
  const offerings = await prismaClient.courseOffering.findMany({
    select: { id: true },
    where: { courseId },
  })

  await cleanupOfferingVectors({
    offeringIds: offerings.map((offering) => offering.id),
  })

  return prismaClient.$transaction(async (transaction) => {
    await transaction.assignmentSubmission.deleteMany({
      where: {
        assignment: {
          offering: {
            courseId,
          },
        },
      },
    })
    await transaction.assignment.deleteMany({
      where: {
        offering: {
          courseId,
        },
      },
    })
    await transaction.courseSession.deleteMany({
      where: {
        offering: {
          courseId,
        },
      },
    })
    await transaction.courseStaff.deleteMany({
      where: {
        offering: {
          courseId,
        },
      },
    })
    await transaction.enrollment.deleteMany({
      where: {
        offering: {
          courseId,
        },
      },
    })
    await transaction.studentCourseCompletion.deleteMany({ where: { courseId } })
    await transaction.coursePrerequisiteOption.deleteMany({
      where: {
        OR: [
          { requiredCourseId: courseId },
          {
            group: {
              courseId,
            },
          },
        ],
      },
    })
    await transaction.coursePrerequisiteGroup.deleteMany({ where: { courseId } })
    await transaction.courseOffering.deleteMany({ where: { courseId } })
    await transaction.curriculumRule.deleteMany({ where: { courseId } })

    return transaction.course.delete({ where: { id: courseId } })
  })
}
