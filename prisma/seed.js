import { prisma } from '../server/db.js'
import { hashPassword } from '../server/services/passwords.js'

const passwordHash = hashPassword('Password123!')

const aiCurriculumCourses = [
  {
    code: 'COS30019',
    title: 'Introduction to Artificial Intelligence',
    description: 'Search, knowledge representation, learning, and applied AI problem solving.',
    ruleType: 'major',
  },
  {
    code: 'COS20019',
    title: 'Cloud Computing Architecture',
    description: 'Core cloud architecture concepts, services, deployment models, and tradeoffs.',
    ruleType: 'major',
  },
  {
    code: 'COS20031',
    title: 'Computing Technology Design Project',
    description: 'Course description pending.',
    ruleType: 'major',
  },
  {
    code: 'COS30082',
    title: 'Applied Machine Learning',
    description: 'Course description pending.',
    ruleType: 'major',
  },
  {
    code: 'COS30049',
    title: 'Computing Technology Innovation Project',
    description: 'Course description pending.',
    ruleType: 'major',
  },
  {
    code: 'SWE30003',
    title: 'Software Architectures and Design',
    description: 'Course description pending.',
    ruleType: 'major',
  },
  {
    code: 'COS40007',
    title: 'Artificial Intelligence for Engineering',
    description: 'Course description pending.',
    ruleType: 'major',
  },
  {
    code: 'COS30018',
    title: 'Intelligent Systems',
    description: 'Course description pending.',
    ruleType: 'major',
  },
  {
    code: 'COS10005',
    title: 'Web Development',
    description: 'Course description pending.',
    ruleType: 'elective',
  },
  {
    code: 'COS30008',
    title: 'Data Structures and Patterns',
    description: 'Reusable data structures, design patterns, and implementation techniques.',
    ruleType: 'elective',
  },
  {
    code: 'COS40003',
    title: 'Concurrent Programming',
    description: 'Course description pending.',
    ruleType: 'elective',
  },
  {
    code: 'STA10003',
    title: 'Foundations of Statistics',
    description: 'Course description pending.',
    ruleType: 'elective',
  },
  {
    code: 'SWE30009',
    title: 'Software Testing and Reliability',
    description: 'Course description pending.',
    ruleType: 'elective',
  },
  {
    code: 'COS30043',
    title: 'Interface Design and Development',
    description: 'Course description pending.',
    ruleType: 'elective',
  },
  {
    code: 'ICT20016',
    title: 'Work Integrated Learning Placement - Information and Communication Technology (3 months)',
    description: 'Course description pending.',
    ruleType: 'elective',
  },
  {
    code: 'COS10009',
    title: 'Introduction to Programming',
    description: 'Programming fundamentals and computational thinking.',
    ruleType: 'core',
  },
  {
    code: 'COS10004',
    title: 'Computer Systems',
    description: 'Computer systems fundamentals, operating environments, data representation, and hardware-software interaction.',
    ruleType: 'core',
  },
  {
    code: 'COS10025',
    title: 'Technology in an Indigenous Context Project',
    description: 'Course description pending.',
    ruleType: 'core',
  },
  {
    code: 'COS10026',
    title: 'Computing Technology Inquiry Project',
    description: 'Course description pending.',
    ruleType: 'core',
  },
  {
    code: 'TNE10006',
    title: 'Networks and Switching',
    description: 'Course description pending.',
    ruleType: 'core',
  },
  {
    code: 'COS20007',
    title: 'Object Oriented Programming',
    description: 'Course description pending.',
    ruleType: 'core',
  },
  {
    code: 'COS40005',
    title: 'Computing Technology Project A',
    description: 'Course description pending.',
    ruleType: 'core',
  },
  {
    code: 'COS40006',
    title: 'Computing Technology Project B',
    description: 'Continuation of the computing technology capstone with implementation, evaluation, and final delivery.',
    ruleType: 'core',
  },
]

const aiPrerequisitesByCourseCode = {
  COS30019: [
    {
      requirementType: 'course_alternatives',
      options: [
        { code: 'COS20007', requirementMode: 'passed_or_concurrent' },
        { code: 'COS30008', requirementMode: 'passed_or_concurrent' },
      ],
    },
  ],
  COS30082: [
    {
      requirementType: 'course_alternatives',
      options: [
        { code: 'COS30018', requirementMode: 'passed_or_concurrent' },
        { code: 'COS30019', requirementMode: 'passed_or_concurrent' },
      ],
    },
  ],
  COS40007: [
    {
      requirementType: 'course_alternatives',
      options: [{ code: 'COS10009', requirementMode: 'passed' }],
    },
    {
      requirementType: 'completed_credit_points',
      minimumCreditPoints: 100,
    },
  ],
  ICT20016: [
    {
      requirementType: 'completed_credit_points',
      minimumCreditPoints: 150,
    },
  ],
  COS20007: [
    {
      requirementType: 'course_alternatives',
      options: [{ code: 'COS10009', requirementMode: 'passed' }],
    },
  ],
  COS40005: [
    {
      requirementType: 'completed_credit_points',
      minimumCreditPoints: 100,
    },
  ],
  COS40006: [
    {
      requirementType: 'course_alternatives',
      options: [{ code: 'COS40005', requirementMode: 'passed' }],
    },
  ],
}

const seededCourseId = (code) => `course-${code.toLowerCase()}`

const curriculumRuleForCourse = (course, cs, aiMajor) => {
  if (course.ruleType === 'core') {
    return {
      courseId: seededCourseId(course.code),
      ruleType: 'core',
      scope: 'main_major',
      scopeKey: cs.id,
      mainMajorId: cs.id,
    }
  }

  if (course.ruleType === 'major') {
    return {
      courseId: seededCourseId(course.code),
      ruleType: 'major',
      scope: 'child_major',
      scopeKey: aiMajor.id,
      childMajorId: aiMajor.id,
    }
  }

  return {
    courseId: seededCourseId(course.code),
    ruleType: 'elective',
    scope: 'global',
    scopeKey: 'global',
  }
}

async function seedAiPrerequisites(courseByCode) {
  const targetCourseIds = aiCurriculumCourses.map((course) => courseByCode[course.code]?.id).filter(Boolean)

  if (targetCourseIds.length !== aiCurriculumCourses.length) {
    const missingCodes = aiCurriculumCourses
      .filter((course) => !courseByCode[course.code])
      .map((course) => course.code)
      .join(', ')

    throw new Error(`Cannot seed AI prerequisites because these courses are missing: ${missingCodes}`)
  }

  await prisma.coursePrerequisiteGroup.deleteMany({
    where: {
      courseId: {
        in: targetCourseIds,
      },
    },
  })

  for (const [courseCode, groups] of Object.entries(aiPrerequisitesByCourseCode)) {
    const course = courseByCode[courseCode]

    for (const [groupIndex, group] of groups.entries()) {
      await prisma.coursePrerequisiteGroup.create({
        data: {
          courseId: course.id,
          requirementType: group.requirementType,
          minimumCreditPoints: group.minimumCreditPoints ?? null,
          sortOrder: groupIndex,
          options: {
            create: (group.options ?? []).map((option, optionIndex) => ({
              requiredCourseId: courseByCode[option.code].id,
              requirementMode: option.requirementMode,
              sortOrder: optionIndex,
            })),
          },
        },
      })
    }
  }
}

async function main() {
  await prisma.inboxMessage.deleteMany()
  await prisma.inboxThreadParticipant.deleteMany()
  await prisma.inboxThread.deleteMany()
  await prisma.courseSession.deleteMany()
  await prisma.assignmentSubmission.deleteMany()
  await prisma.assignment.deleteMany()
  await prisma.courseRegistrationRequest.deleteMany()
  await prisma.enrollment.deleteMany()
  await prisma.courseStaff.deleteMany()
  await prisma.courseOffering.deleteMany()
  await prisma.studentCourseCompletion.deleteMany()
  await prisma.coursePrerequisiteOption.deleteMany()
  await prisma.coursePrerequisiteGroup.deleteMany()
  await prisma.curriculumRule.deleteMany()
  await prisma.course.deleteMany()
  await prisma.managedUserCredential.deleteMany()
  await prisma.userSession.deleteMany()
  await prisma.user.deleteMany()
  await prisma.childMajor.deleteMany()
  await prisma.mainMajor.deleteMany()

  const cs = await prisma.mainMajor.create({
    data: {
      id: 'cs',
      title: 'Computer Science',
      summary: 'Computing, software, data, security, networks, games, and AI.',
      sortOrder: 1,
    },
  })
  const business = await prisma.mainMajor.create({
    data: {
      id: 'business',
      title: 'Business',
      summary: 'Business, management, marketing, finance, and entrepreneurship.',
      sortOrder: 2,
    },
  })
  const media = await prisma.mainMajor.create({
    data: {
      id: 'media',
      title: 'Media',
      summary: 'Media, communication, digital content, and creative production.',
      sortOrder: 3,
    },
  })

  const childMajors = await Promise.all([
    prisma.childMajor.create({
      data: {
        id: 'ai',
        mainMajorId: cs.id,
        title: 'Artificial Intelligence',
        summary: 'Machine learning, intelligent systems, and applied AI.',
        sortOrder: 1,
      },
    }),
    prisma.childMajor.create({
      data: {
        id: 'software-development',
        mainMajorId: cs.id,
        title: 'Software Development',
        summary: 'Application design, full-stack engineering, and software delivery.',
        sortOrder: 2,
      },
    }),
    prisma.childMajor.create({
      data: {
        id: 'data-analysis',
        mainMajorId: cs.id,
        title: 'Data Analysis',
        summary: 'Data processing, analytics, and decision support.',
        sortOrder: 3,
      },
    }),
    prisma.childMajor.create({
      data: {
        id: 'cyber-security',
        mainMajorId: cs.id,
        title: 'Cyber Security',
        summary: 'Security operations, systems hardening, and risk management.',
        sortOrder: 4,
      },
    }),
    prisma.childMajor.create({
      data: {
        id: 'networking',
        mainMajorId: cs.id,
        title: 'Networking',
        summary: 'Network architecture, cloud connectivity, and infrastructure.',
        sortOrder: 5,
      },
    }),
    prisma.childMajor.create({
      data: {
        id: 'games-development',
        mainMajorId: cs.id,
        title: 'Games Development',
        summary: 'Game design, interactive systems, and real-time experiences.',
        sortOrder: 6,
      },
    }),
    prisma.childMajor.create({
      data: {
        id: 'marketing',
        mainMajorId: business.id,
        title: 'Marketing',
        summary: 'Brand, market research, campaign strategy, and analytics.',
        sortOrder: 1,
      },
    }),
    prisma.childMajor.create({
      data: {
        id: 'digital-media',
        mainMajorId: media.id,
        title: 'Digital Media',
        summary: 'Digital content, storytelling, and production workflows.',
        sortOrder: 1,
      },
    }),
  ])

  const childById = Object.fromEntries(childMajors.map((major) => [major.id, major]))

  const [admin, teacher, student] = await Promise.all([
    prisma.user.create({
      data: {
        id: 'admin-demo',
        email: 'admin@swinlearn.test',
        passwordHash,
        role: 'admin',
        fullName: 'Admin Demo',
        displayName: 'Admin Demo',
        campus: 'hanoi',
        mustChangePassword: false,
      },
    }),
    prisma.user.create({
      data: {
        id: 'teacher-demo',
        email: 'teacher@swinlearn.test',
        passwordHash,
        role: 'teacher',
        fullName: 'Teacher Demo',
        displayName: 'Teacher Demo',
        campus: 'hanoi',
        studentId: 'TCH0001',
        mainMajorId: cs.id,
        mustChangePassword: false,
      },
    }),
    prisma.user.create({
      data: {
        id: 'student-demo',
        email: 'student@swinlearn.test',
        passwordHash,
        role: 'student',
        fullName: 'Student Demo',
        displayName: 'Student Demo',
        campus: 'hanoi',
        studentId: 'STD0001',
        childMajorId: childById.ai.id,
        mustChangePassword: false,
      },
    }),
  ])

  const courses = await Promise.all(
    aiCurriculumCourses.map((course) =>
      prisma.course.create({
        data: {
          id: seededCourseId(course.code),
          code: course.code,
          title: course.title,
          description: course.description,
          createdById: admin.id,
        },
      }),
    ),
  )
  const courseByCode = Object.fromEntries(courses.map((course) => [course.code, course]))

  await prisma.curriculumRule.createMany({
    data: aiCurriculumCourses.map((course) => curriculumRuleForCourse(course, cs, childById.ai)),
  })

  await seedAiPrerequisites(courseByCode)

  await prisma.studentCourseCompletion.create({
    data: {
      studentId: student.id,
      courseId: courseByCode.COS10009.id,
      createdById: admin.id,
    },
  })

  const [cloudOffering, aiOffering] = await Promise.all([
    prisma.courseOffering.create({
      data: {
        courseId: courseByCode.COS20019.id,
        term: 'semester_1',
        academicYear: 2026,
        status: 'active',
        createdById: admin.id,
        staff: {
          create: {
            userId: teacher.id,
            role: 'teacher',
          },
        },
        enrollments: {
          create: {
            userId: student.id,
          },
        },
      },
    }),
    prisma.courseOffering.create({
      data: {
        courseId: courseByCode.COS30019.id,
        term: 'semester_1',
        academicYear: 2026,
        status: 'active',
        createdById: admin.id,
        staff: {
          create: {
            userId: teacher.id,
            role: 'teacher',
          },
        },
        enrollments: {
          create: {
            userId: student.id,
          },
        },
      },
    }),
  ])

  await prisma.assignment.create({
    data: {
      offeringId: aiOffering.id,
      title: 'AI Search Reflection',
      description: 'Explain one informed search strategy and where it performs well.',
      dueAt: new Date('2026-07-01T09:00:00+07:00'),
      status: 'published',
      createdById: teacher.id,
    },
  })

  await prisma.courseSession.createMany({
    data: [
      {
        offeringId: cloudOffering.id,
        title: 'Cloud Architecture Lecture',
        sessionType: 'class',
        startsAt: new Date('2026-06-15T09:00:00+07:00'),
        endsAt: new Date('2026-06-15T11:00:00+07:00'),
        location: 'Room 401',
        createdById: teacher.id,
      },
      {
        offeringId: aiOffering.id,
        title: 'AI Lab',
        sessionType: 'lab',
        startsAt: new Date('2026-06-17T13:00:00+07:00'),
        endsAt: new Date('2026-06-17T15:00:00+07:00'),
        location: 'Lab 3',
        createdById: teacher.id,
      },
    ],
  })

  const thread = await prisma.inboxThread.create({
    data: {
      subject: 'Welcome to SWINLEARN',
      createdById: admin.id,
      participants: {
        create: [
          { userId: admin.id, lastReadAt: new Date() },
          { userId: teacher.id },
          { userId: student.id },
        ],
      },
      messages: {
        create: {
          senderId: admin.id,
          body: 'Demo accounts are ready. Use Password123! for seeded users.',
        },
      },
    },
  })

  await prisma.inboxThread.update({
    where: { id: thread.id },
    data: { updatedAt: new Date() },
  })
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
