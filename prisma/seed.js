import { prisma } from '../server/db.js'
import { hashPassword } from '../server/services/passwords.js'

const passwordHash = hashPassword('Password123!')

async function main() {
  await prisma.inboxMessage.deleteMany()
  await prisma.inboxThreadParticipant.deleteMany()
  await prisma.inboxThread.deleteMany()
  await prisma.courseSession.deleteMany()
  await prisma.assignmentSubmission.deleteMany()
  await prisma.assignment.deleteMany()
  await prisma.enrollment.deleteMany()
  await prisma.courseStaff.deleteMany()
  await prisma.courseOffering.deleteMany()
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

  const [cloud, aiIntro, patterns, programming] = await Promise.all([
    prisma.course.create({
      data: {
        code: 'COS20019',
        title: 'Cloud Computing Architecture',
        description: 'Core cloud architecture concepts, services, deployment models, and tradeoffs.',
        createdById: admin.id,
      },
    }),
    prisma.course.create({
      data: {
        code: 'COS30019',
        title: 'Introduction to Artificial Intelligence',
        description: 'Search, knowledge representation, learning, and applied AI problem solving.',
        createdById: admin.id,
      },
    }),
    prisma.course.create({
      data: {
        code: 'COS30008',
        title: 'Data Structures and Patterns',
        description: 'Reusable data structures, design patterns, and implementation techniques.',
        createdById: admin.id,
      },
    }),
    prisma.course.create({
      data: {
        code: 'COS10009',
        title: 'Introduction to Programming',
        description: 'Programming fundamentals and computational thinking.',
        createdById: admin.id,
      },
    }),
  ])

  await prisma.curriculumRule.createMany({
    data: [
      {
        courseId: cloud.id,
        ruleType: 'core',
        scope: 'main_major',
        scopeKey: cs.id,
        mainMajorId: cs.id,
      },
      {
        courseId: programming.id,
        ruleType: 'core',
        scope: 'main_major',
        scopeKey: cs.id,
        mainMajorId: cs.id,
      },
      {
        courseId: aiIntro.id,
        ruleType: 'major',
        scope: 'child_major',
        scopeKey: childById.ai.id,
        childMajorId: childById.ai.id,
      },
      {
        courseId: aiIntro.id,
        ruleType: 'elective',
        scope: 'child_major',
        scopeKey: childById['software-development'].id,
        childMajorId: childById['software-development'].id,
      },
      {
        courseId: patterns.id,
        ruleType: 'elective',
        scope: 'global',
        scopeKey: 'global',
      },
    ],
  })

  const [cloudOffering, aiOffering] = await Promise.all([
    prisma.courseOffering.create({
      data: {
        courseId: cloud.id,
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
        courseId: aiIntro.id,
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
