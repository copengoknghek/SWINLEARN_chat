import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildCvContextDocuments,
  buildCvScopeReply,
  buildSubmittedAssignmentsReply,
  detectCvThreadContext,
  extractAssignmentListFromHistory,
  inferProjectRole,
  isCvTopicChange,
  matchAssignmentsByTitle,
  normalizeTitle,
  parseCvClarificationReply,
  parseCvFollowUp,
  parseCvProjectRequest,
  parseListReference,
  resolveCvProjects,
  resolveCvProjectsByAssignmentIds,
  resolveCvScopeAssignmentList,
  resolveListReference,
} from './cvProjectScope.js'

const cos30043Assignments = [
  'Week 7 - Vite and Vue CLI',
  'Assignment 1',
  'Assignment 2',
  'Register Interest for D/HD',
  'Week 10 - Single Page Applicaition',
  'Week 5',
  'Week 8 - API',
  'Week 9 - Pagination',
  'Project (for all students)',
]

const cos30043NotFoundHistory = [
  {
    role: 'student',
    content: 'Make a CV entry for "Assignment 7" in COS30043',
  },
  {
    role: 'assistant',
    content: [
      'I could not find an assignment matching that title in COS30043.',
      '',
      'Assignments in COS30043:',
      ...cos30043Assignments.map((title, index) => `${index + 1}. ${title}`),
      '',
      'Which assignment did you mean?',
    ].join('\n'),
    metadata: { contentType: 'cv_scope', courseCode: 'COS30043', status: 'not_found' },
  },
]

const offering = {
  id: 'off-1',
  course: { code: 'COS30034', title: 'ML Project' },
  assignments: [
    { id: 'asg-1', offeringId: 'off-1', title: 'Capstone Project', description: 'Build an ML app.', dueAt: new Date('2026-01-01') },
    { id: 'asg-2', offeringId: 'off-1', title: 'Week 3 Report', description: 'Weekly report.', dueAt: new Date('2026-02-01') },
    { id: 'asg-3', offeringId: 'off-1', title: 'Assignment 1', description: 'First assignment.', dueAt: new Date('2026-03-01') },
    { id: 'asg-4', offeringId: 'off-1', title: 'Assignment 10', description: 'Tenth assignment.', dueAt: new Date('2026-04-01') },
    { id: 'asg-5', offeringId: 'off-1', title: 'Week 5', description: 'Week five work.', dueAt: new Date('2026-05-01') },
  ],
}

const offeringTwo = {
  id: 'off-2',
  course: { code: 'COS10009', title: 'Intro Computing' },
  assignments: [
    { id: 'asg-6', offeringId: 'off-2', title: 'Assignment 3', description: 'Third assignment.', dueAt: new Date('2026-01-01') },
  ],
}

const submissions = [
  {
    id: 'sub-1',
    assignmentId: 'asg-1',
    studentId: 'student-1',
    body: 'https://github.com/student/demo',
    filePaths: [],
    assignment: offering.assignments[0],
  },
  {
    id: 'sub-2',
    assignmentId: 'asg-6',
    studentId: 'student-1',
    body: 'Submitted assignment 3',
    filePaths: [],
    assignment: offeringTwo.assignments[0],
  },
]

test('parseCvProjectRequest detects all-mode and course code', () => {
  const request = parseCvProjectRequest(
    'Make CV entries for all my submitted assignments in COS30034',
    [{ course: { code: 'COS30034' } }],
  )

  assert.equal(request.mode, 'all')
  assert.deepEqual(request.courseCodes, ['COS30034'])
  assert.deepEqual(request.targets, [{ courseCode: 'COS30034', mode: 'all' }])
})

test('parseCvProjectRequest extracts quoted assignment title', () => {
  const request = parseCvProjectRequest(
    'Make a CV entry for "Capstone Project" in COS30034',
    [{ course: { code: 'COS30034' } }],
  )

  assert.equal(request.mode, 'named')
  assert.deepEqual(request.titles, ['Capstone Project'])
  assert.deepEqual(request.targets, [
    { courseCode: 'COS30034', mode: 'named', title: 'Capstone Project' },
  ])
})

test('parseCvProjectRequest extracts multiple quoted titles across courses', () => {
  const request = parseCvProjectRequest(
    'Make CV entries for "Assignment 1" in COS30043 and "Assignment 3" in COS10009',
    [{ course: { code: 'COS30043' } }, { course: { code: 'COS10009' } }],
  )

  assert.equal(request.mode, 'named')
  assert.deepEqual(request.targets, [
    { courseCode: 'COS30043', mode: 'named', title: 'Assignment 1' },
    { courseCode: 'COS10009', mode: 'named', title: 'Assignment 3' },
  ])
})

test('parseCvProjectRequest extracts natural language title and course pairs', () => {
  const offerings = [{ course: { code: 'COS20019' } }, { course: { code: 'COS30043' } }]
  const request = parseCvProjectRequest(
    'build cv, add assignment 1 cos20019 and assignment 3 cos30043',
    offerings,
  )

  assert.equal(request.mode, 'named')
  assert.equal(request.isCvRequest, true)
  assert.deepEqual(request.courseCodes, ['COS20019', 'COS30043'])
  assert.deepEqual(request.targets, [
    { courseCode: 'COS20019', exactTitle: true, mode: 'named', title: 'assignment 1' },
    { courseCode: 'COS30043', exactTitle: true, mode: 'named', title: 'assignment 3' },
  ])
})

test('parseCvProjectRequest extracts natural language pairs with trailing cv suffix', () => {
  const offerings = [{ course: { code: 'COS20019' } }, { course: { code: 'COS30043' } }]
  const request = parseCvProjectRequest(
    'add assignment 1 cos20019 and assignment 3 cos30043 to my cv',
    offerings,
  )

  assert.deepEqual(request.targets, [
    { courseCode: 'COS20019', exactTitle: true, mode: 'named', title: 'assignment 1' },
    { courseCode: 'COS30043', exactTitle: true, mode: 'named', title: 'assignment 3' },
  ])
})

test('parseCvProjectRequest extracts make a cv that add phrasing with trailing for me', () => {
  const offerings = [{ course: { code: 'COS30043' } }]
  const request = parseCvProjectRequest(
    'make a cv that add assignment 1 cos30043 for me',
    offerings,
  )

  assert.equal(request.isCvRequest, true)
  assert.deepEqual(request.targets, [
    { courseCode: 'COS30043', exactTitle: true, mode: 'named', title: 'assignment 1' },
  ])
})

const naturalCvOfferings = [{ course: { code: 'COS20019' } }, { course: { code: 'COS30043' } }]

const naturalCvPhrases = [
  {
    message: 'help me put assignment 1 on my cv for cos30043',
    targets: [{ courseCode: 'COS30043', title: 'assignment 1' }],
  },
  {
    message: 'i need resume bullets for assignment 1 in COS30043',
    targets: [{ courseCode: 'COS30043', title: 'assignment 1' }],
  },
  {
    message: 'can you generate cv entry for week 5 cos30043',
    targets: [{ courseCode: 'COS30043', title: 'week 5' }],
  },
  {
    message: 'please create portfolio entry assignment 1 cos30043',
    targets: [{ courseCode: 'COS30043', title: 'assignment 1' }],
  },
  {
    message: 'COS30043 assignment 1 cv please',
    targets: [{ courseCode: 'COS30043', title: 'assignment 1' }],
  },
  {
    message: 'assignment 1 cos20019 assignment 3 cos30043',
    targets: [
      { courseCode: 'COS20019', title: 'assignment 1' },
      { courseCode: 'COS30043', title: 'assignment 3' },
    ],
  },
  {
    message: 'write me a cv with week 5 in COS30043',
    targets: [{ courseCode: 'COS30043', title: 'week 5' }],
  },
  {
    message: 'get cv from assignment 2 for COS30043 thanks',
    targets: [{ courseCode: 'COS30043', title: 'assignment 2' }],
  },
]

for (const phrase of naturalCvPhrases) {
  test(`parseCvProjectRequest handles natural phrase: ${phrase.message}`, () => {
    const request = parseCvProjectRequest(phrase.message, naturalCvOfferings)

    assert.equal(request.mode, 'named')
    assert.deepEqual(
      request.targets.map((target) => ({
        courseCode: target.courseCode,
        title: target.title,
      })),
      phrase.targets,
    )
  })
}

test('parseCvProjectRequest strips leading conjunction and trailing course from natural title', () => {
  const offerings = [{ course: { code: 'COS30043' } }]

  const byAssignment = parseCvProjectRequest(
    'can you make cv by assignment 1 course COS30043',
    offerings,
  )
  assert.deepEqual(byAssignment.targets, [
    { courseCode: 'COS30043', exactTitle: true, mode: 'named', title: 'assignment 1' },
  ])

  const useAssignment = parseCvProjectRequest('make a cv use assignment 1 cos30043', offerings)
  assert.deepEqual(useAssignment.targets, [
    { courseCode: 'COS30043', exactTitle: true, mode: 'named', title: 'assignment 1' },
  ])
})

test('matchAssignmentsByTitle tolerates extra trailing noise tokens in the query', () => {
  const assignments = [
    { title: 'Assignment 1' },
    { title: 'Assignment 2' },
    { title: 'Week 5' },
  ]

  const matches = matchAssignmentsByTitle(assignments, 'assignment 1 course')

  assert.equal(matches.length, 1)
  assert.equal(matches[0].title, 'Assignment 1')
})

test('matchAssignmentsByTitle does bidirectional token prefix match', () => {
  const assignments = [
    { title: 'Week 5 - Lab Report' },
    { title: 'Assignment 1' },
  ]

  assert.equal(matchAssignmentsByTitle(assignments, 'week 5').length, 1)
  assert.equal(matchAssignmentsByTitle(assignments, 'assignment 1').length, 1)
})

test('matchAssignmentsByTitle finds exact and partial token matches', () => {
  assert.equal(matchAssignmentsByTitle(offering.assignments, 'capstone project').length, 1)
  assert.equal(matchAssignmentsByTitle(offering.assignments, 'week 3').length, 1)
  assert.equal(matchAssignmentsByTitle(offering.assignments, 'week 5').length, 1)
  assert.equal(matchAssignmentsByTitle(offering.assignments, 'final exam').length, 0)
})

test('matchAssignmentsByTitle does not match Assignment 1 to Assignment 10', () => {
  assert.equal(matchAssignmentsByTitle(offering.assignments, 'Assignment 1').length, 1)
  assert.equal(matchAssignmentsByTitle(offering.assignments, 'Assignment 1')[0].title, 'Assignment 1')
  assert.equal(matchAssignmentsByTitle(offering.assignments, 'assignment 1').length, 1)
})

const cos20019Assignments = [
  'Wk6: ACF Lab 1: Intro to AWS IAM',
  'Wk7: ACF Lab 6: Scaling and Load Balance your architecture',
  'Assignment 3 - Interview/Presentations Schedule',
  'Lab Attendance Week 1',
  'Assignment 2',
  'Assignment 3',
  'Assignment 3 Presentation/Interview',
]

const cos20019NotFoundHistory = [
  {
    role: 'student',
    content: 'Make a CV entry for "Lab2" in COS20019',
  },
  {
    role: 'assistant',
    content: [
      "I couldn't find an assignment with that name in COS20019.",
      '',
      'Here are the assignments in that course — which one did you mean?',
      ...cos20019Assignments.map((title, index) => `${index + 1}. ${title}`),
    ].join('\n'),
    metadata: { contentType: 'cv_scope', courseCode: 'COS20019', status: 'not_found' },
  },
]

const cos20019AmbiguousHistory = [
  ...cos20019NotFoundHistory,
  { role: 'student', content: '22' },
  {
    role: 'assistant',
    content: [
      'I found more than one assignment that could match "Assignment 3" in COS20019.',
      '',
      'Which one did you have in mind?',
      '1. Assignment 3 - Interview/Presentations Schedule',
      '2. Assignment 3',
      '3. Assignment 3 Presentation/Interview',
    ].join('\n'),
    metadata: { contentType: 'cv_scope', courseCode: 'COS20019', status: 'ambiguous' },
  },
]

test('matchAssignmentsByTitle prefers exact title over prefix matches', () => {
  const assignments = [
    { title: 'Assignment 3 - Interview/Presentations Schedule' },
    { title: 'Assignment 3' },
    { title: 'Assignment 3 Presentation/Interview' },
  ]

  const matches = matchAssignmentsByTitle(assignments, 'Assignment 3')

  assert.equal(matches.length, 1)
  assert.equal(matches[0].title, 'Assignment 3')
})

test('extractAssignmentListFromHistory uses most recent ambiguous list', () => {
  const titles = extractAssignmentListFromHistory(cos20019AmbiguousHistory)

  assert.deepEqual(titles, [
    'Assignment 3 - Interview/Presentations Schedule',
    'Assignment 3',
    'Assignment 3 Presentation/Interview',
  ])
})

test('parseCvFollowUp resolves ordinal against ambiguous list not earlier not_found list', () => {
  const followUp = parseCvFollowUp('2', cos20019AmbiguousHistory, [{ course: { code: 'COS20019' } }])

  assert.ok(followUp)
  assert.equal(followUp.title, 'Assignment 3')
  assert.doesNotMatch(followUp.title, /ACF Lab 6/i)
})

test('parseCvFollowUp resolves list position to exact assignment title without re-ambiguous prefix match', () => {
  const followUp = parseCvFollowUp('6', cos20019NotFoundHistory, [{ course: { code: 'COS20019' } }])

  assert.ok(followUp)
  assert.equal(followUp.title, 'Assignment 3')
  assert.equal(followUp.fromListPick, true)
})

test('resolveCvProjects resolves list pick 22 without ambiguous rematch', async () => {
  const fullAssignments = [
    'Wk6: ACF Lab 1: Intro to AWS IAM',
    'Wk7: ACF Lab 6: Scaling and Load Balance your architecture',
    'Assignment 3 - Interview/Presentations Schedule',
    'Lab Attendance Week 1',
    'Lab Attendance Week 10',
    'Lab Attendance Week 11',
    'Lab Attendance Week 12',
    'Lab Attendance Week 2',
    'Lab Attendance Week 3',
    'Lab Attendance Week 4',
    'Lab Attendance Week 5',
    'Lab Attendance Week 6',
    'Lab Attendance Week 7',
    'Lab Attendance Week 8',
    'Lab Attendance Week 9',
    'Assignment 2',
    'Wk8: ACA Module 10 Guided Lab - Creating a Highly Available Environment',
    'Wk8: ACA Module 11 Guided Lab - Automating Infrastructure Deployment with AWS CloudFormation',
    'Wk9: ACA Module 14 Challenge Lab - Implementing a Serverless Architecture for the Cafe',
    'Wk9: ACA Module 14 Guided Lab - Implementing a Serverless Architecture with AWS Lambda',
    'Wk10: ACA Module 10 Challenge Lab - Creating a Scalable and Highly Available Environment for the Cafe',
    'Assignment 3',
    'Assignment 3 Presentation/Interview',
  ]
  const history = [
    { role: 'student', content: 'Make a CV entry for "Lab2" in COS20019' },
    {
      role: 'assistant',
      content: [
        "I couldn't find an assignment with that name in COS20019.",
        '',
        'Here are the assignments in that course — which one did you mean?',
        ...fullAssignments.map((title, index) => `${index + 1}. ${title}`),
      ].join('\n'),
      metadata: { contentType: 'cv_scope', assignmentList: fullAssignments, courseCode: 'COS20019' },
    },
    { role: 'student', content: '22' },
  ]
  const followUp = parseCvFollowUp('22', history, [{ course: { code: 'COS20019' } }])
  const request = parseCvProjectRequest(followUp.syntheticMessage, [{ course: { code: 'COS20019' } }])

  request.targets[0].exactTitle = true

  const result = await resolveCvProjects({
    offerings: [
      {
        id: 'off-cos',
        course: { code: 'COS20019', title: 'Cloud' },
        assignments: fullAssignments.map((title, index) => ({
          id: `asg-${index}`,
          offeringId: 'off-cos',
          title,
          description: '',
        })),
      },
    ],
    request,
    studentId: 'student-1',
    submissions: [],
  })

  assert.equal(result.status, 'named_unsubmitted')
  assert.equal(result.title, 'Assignment 3')
})

test('resolveCvProjects resolves ambiguous list pick 2 without looping', async () => {
  const ambiguousList = [
    'Assignment 3 - Interview/Presentations Schedule',
    'Assignment 3',
    'Assignment 3 Presentation/Interview',
  ]
  const history = [
    ...cos20019NotFoundHistory,
    { role: 'student', content: '22' },
    {
      role: 'assistant',
      content: [
        'I found more than one assignment that could match "Assignment 3" in COS20019.',
        '',
        'Which one did you have in mind?',
        ...ambiguousList.map((title, index) => `${index + 1}. ${title}`),
      ].join('\n'),
      metadata: { contentType: 'cv_scope', assignmentList: ambiguousList, courseCode: 'COS20019' },
    },
    { role: 'student', content: '2' },
  ]
  const followUp = parseCvFollowUp('2', history, [{ course: { code: 'COS20019' } }])
  const request = parseCvProjectRequest(followUp.syntheticMessage, [{ course: { code: 'COS20019' } }])

  request.targets[0].exactTitle = true

  const result = await resolveCvProjects({
    offerings: [
      {
        id: 'off-cos',
        course: { code: 'COS20019', title: 'Cloud' },
        assignments: ambiguousList.map((title, index) => ({
          id: `asg-${index}`,
          offeringId: 'off-cos',
          title,
          description: '',
        })),
      },
    ],
    request,
    studentId: 'student-1',
    submissions: [],
  })

  assert.equal(result.status, 'named_unsubmitted')
  assert.equal(result.title, 'Assignment 3')
})

test('parseCvFollowUp resolves i mean Assignment 3 to exact assignment on ambiguous list', () => {
  const ambiguousList = [
    'Assignment 3 - Interview/Presentations Schedule',
    'Assignment 3',
    'Assignment 3 Presentation/Interview',
  ]
  const history = [
    ...cos20019NotFoundHistory,
    {
      role: 'assistant',
      content: 'I found more than one assignment that could match "Assignment 3" in COS20019.',
      metadata: { contentType: 'cv_scope', assignmentList: ambiguousList, courseCode: 'COS20019' },
    },
  ]
  const followUp = parseCvFollowUp('i mean Assignment 3', history, [{ course: { code: 'COS20019' } }])

  assert.ok(followUp)
  assert.equal(followUp.status, undefined)
  assert.equal(followUp.title, 'Assignment 3')
})

test('extractAssignmentListFromHistory prefers metadata assignmentList', () => {
  const titles = extractAssignmentListFromHistory([
    {
      role: 'assistant',
      content: '1. Wrong\n2. Also wrong',
      metadata: {
        assignmentList: ['Assignment 3 - Interview/Presentations Schedule', 'Assignment 3'],
      },
    },
  ])

  assert.deepEqual(titles, ['Assignment 3 - Interview/Presentations Schedule', 'Assignment 3'])
})

test('resolveCvScopeAssignmentList returns assignment titles from resolution', () => {
  const list = resolveCvScopeAssignmentList({
    resolution: {
      assignmentTitles: ['Assignment 3', 'Assignment 2'],
      status: 'not_found',
    },
    status: 'not_found',
  })

  assert.deepEqual(list, ['Assignment 3', 'Assignment 2'])
})

test('resolveCvProjects excludes unsubmitted named assignment', async () => {
  const result = await resolveCvProjects({
    offerings: [offering],
    request: parseCvProjectRequest('CV for Week 5 in COS30034', [{ course: { code: 'COS30034' } }]),
    studentId: 'student-1',
    submissions: [],
  })

  assert.equal(result.status, 'named_unsubmitted')
  assert.equal(result.assignment?.title, 'Week 5')
})

test('resolveCvProjects returns not_found with assignment list', async () => {
  const result = await resolveCvProjects({
    offerings: [offering],
    request: parseCvProjectRequest('CV for Final Exam in COS30034', [{ course: { code: 'COS30034' } }]),
    studentId: 'student-1',
    submissions,
  })

  assert.equal(result.status, 'not_found')
  const reply = buildCvScopeReply({
    assignmentTitles: result.assignmentTitles,
    courseCode: result.courseCode,
    status: result.status,
  })
  assert.match(reply, /Capstone Project/)
  assert.match(reply, /Week 3 Report/)
})

test('resolveCvProjects all-mode includes only submitted assignments', async () => {
  const result = await resolveCvProjects({
    offerings: [offering],
    request: parseCvProjectRequest('all assignments in COS30034', [{ course: { code: 'COS30034' } }]),
    studentId: 'student-1',
    submissions,
  })

  assert.equal(result.status, 'ready')
  assert.equal(result.projects.length, 1)
  assert.equal(result.projects[0].assignment.title, 'Capstone Project')
  assert.deepEqual(result.skippedUnsubmitted, ['Week 3 Report', 'Assignment 1', 'Assignment 10', 'Week 5'])
})

test('resolveCvProjects blocks multi-course request when any target is unsubmitted', async () => {
  const result = await resolveCvProjects({
    offerings: [offering, offeringTwo],
    request: parseCvProjectRequest(
      'CV for "Capstone Project" in COS30034 and "Assignment 3" in COS10009',
      [{ course: { code: 'COS30034' } }, { course: { code: 'COS10009' } }],
    ),
    studentId: 'student-1',
    submissions: submissions.filter((submission) => submission.assignmentId === 'asg-1'),
  })

  assert.equal(result.status, 'blocked')
  const reply = buildCvScopeReply({
    failures: result.failures,
    status: result.status,
    targetResults: result.targetResults,
  })
  assert.match(reply, /you have not submitted this assignment yet/i)
  assert.match(reply, /COS10009/)
  assert.match(reply, /Reply with the exact assignment titles/i)
})

test('resolveCvProjects lists course assignments when multi-course targets are not found', async () => {
  const result = await resolveCvProjects({
    offerings: [offering, offeringTwo],
    request: parseCvProjectRequest(
      'Make CV entries for "Assignment 7" in COS30034 and "Final Exam" in COS10009',
      [{ course: { code: 'COS30034' } }, { course: { code: 'COS10009' } }],
    ),
    studentId: 'student-1',
    submissions: [],
  })

  assert.equal(result.status, 'blocked')
  const reply = buildCvScopeReply({
    failures: result.failures,
    status: result.status,
    targetResults: result.targetResults,
  })
  assert.match(reply, /no assignment with that name in COS30034/i)
  assert.match(reply, /Assignments in COS30034:/)
  assert.match(reply, /Capstone Project/)
  assert.match(reply, /Assignments in COS10009:/)
  assert.match(reply, /Reply with the exact assignment titles/i)
})

test('resolveCvProjects returns ready for multi-course when all targets submitted', async () => {
  const result = await resolveCvProjects({
    offerings: [offering, offeringTwo],
    request: parseCvProjectRequest(
      'CV for "Capstone Project" in COS30034 and "Assignment 3" in COS10009',
      [{ course: { code: 'COS30034' } }, { course: { code: 'COS10009' } }],
    ),
    studentId: 'student-1',
    submissions,
  })

  assert.equal(result.status, 'ready')
  assert.equal(result.projects.length, 2)
})

test('buildCvContextDocuments includes teacher, submission, and role hints', async () => {
  const result = await resolveCvProjects({
    offerings: [offering],
    request: parseCvProjectRequest('CV for Capstone Project in COS30034', [{ course: { code: 'COS30034' } }]),
    studentId: 'student-1',
    submissions,
  })

  const documents = await buildCvContextDocuments({
    fetchGithub: async () => ({ error: null, text: 'Repo: student/demo\nREADME\nReact app with Vite.' }),
    offering,
    projects: result.projects,
  })

  assert.equal(documents.length, 2)
  assert.match(documents[0].text, /Teacher assignment/)
  assert.match(documents[1].text, /Student response/)
  assert.match(documents[1].text, /Inferred contribution: Frontend/)
})

test('inferProjectRole detects frontend technologies from README text', () => {
  const role = inferProjectRole({
    githubText: 'Built with Vue, Bootstrap, and Vite.',
    submissionText: '',
    filePaths: [],
  })

  assert.equal(role.role, 'Frontend')
  assert.ok(role.evidence.includes('vue'))
})

test('detectCvThreadContext recognizes cv_export and cv_scope messages', () => {
  assert.equal(
    detectCvThreadContext([
      { role: 'assistant', content: '## Project', metadata: { contentType: 'cv_export' } },
    ]),
    true,
  )
  assert.equal(
    detectCvThreadContext([
      {
        role: 'assistant',
        content: 'You have not submitted "Week 5" yet',
        metadata: { contentType: 'cv_scope', courseCode: 'COS30043' },
      },
    ]),
    true,
  )
  assert.equal(detectCvThreadContext([{ role: 'student', content: 'What is Vue?' }]), false)
})

test('parseCvClarificationReply maps natural language title and course pairs to CV request', () => {
  const clarification = parseCvClarificationReply(
    'Lab Attendance Week 1 cos20019 and Project (for all students) cos30043',
  )

  assert.ok(clarification)
  assert.equal(
    clarification.syntheticMessage,
    'Make CV entries for "Lab Attendance Week 1" in COS20019 and "Project (for all students)" in COS30043',
  )
  assert.deepEqual(clarification.targets, [
    { courseCode: 'COS20019', exactTitle: true, mode: 'named', title: 'Lab Attendance Week 1' },
    { courseCode: 'COS30043', exactTitle: true, mode: 'named', title: 'Project (for all students)' },
  ])
})

test('parseCvClarificationReply accepts in-course phrasing and quoted titles', () => {
  const clarification = parseCvClarificationReply(
    '"Lab Attendance Week 1" in COS20019 and "Project (for all students)" in COS30043',
  )

  assert.ok(clarification)
  assert.equal(
    clarification.syntheticMessage,
    'Make CV entries for "Lab Attendance Week 1" in COS20019 and "Project (for all students)" in COS30043',
  )
})

test('parseCvFollowUp resolves multi-course clarification after blocked CV scope reply', async () => {
  const blockedReply = buildCvScopeReply({
    failures: [
      { assignmentTitles: cos20019Assignments, courseCode: 'COS20019', status: 'not_found', title: 'Assignment 1' },
      { assignmentTitles: cos30043Assignments, courseCode: 'COS30043', status: 'not_found', title: 'Assignment 3' },
    ],
    status: 'blocked',
    targetResults: [
      {
        courseCode: 'COS20019',
        status: 'not_found',
        target: { courseCode: 'COS20019', mode: 'named', title: 'Assignment 1' },
        title: 'Assignment 1',
      },
      {
        courseCode: 'COS30043',
        status: 'not_found',
        target: { courseCode: 'COS30043', mode: 'named', title: 'Assignment 3' },
        title: 'Assignment 3',
      },
    ],
  })
  const history = [
    {
      role: 'student',
      content: 'Make CV entries for "Assignment 1" in COS20019 and "Assignment 3" in COS30043',
    },
    {
      role: 'assistant',
      content: blockedReply,
      metadata: { contentType: 'cv_scope', courseCode: 'COS20019', status: 'blocked' },
    },
  ]
  const followUp = parseCvFollowUp(
    'Lab Attendance Week 1 cos20019 and Project (for all students) cos30043',
    history,
    [{ course: { code: 'COS20019' } }, { course: { code: 'COS30043' } }],
  )

  assert.ok(followUp)
  assert.equal(followUp.fromClarification, true)
  const request = {
    ...parseCvProjectRequest(followUp.syntheticMessage, [
      { course: { code: 'COS20019' } },
      { course: { code: 'COS30043' } },
    ]),
    targets: followUp.targets,
  }
  const result = await resolveCvProjects({
    offerings: [
      {
        id: 'off-cos20019',
        course: { code: 'COS20019', title: 'Cloud' },
        assignments: cos20019Assignments.map((title, index) => ({
          id: `asg-20019-${index}`,
          offeringId: 'off-cos20019',
          title,
          description: '',
        })),
      },
      {
        id: 'off-cos30043',
        course: { code: 'COS30043', title: 'Interface Design' },
        assignments: cos30043Assignments.map((title, index) => ({
          id: `asg-30043-${index}`,
          offeringId: 'off-cos30043',
          title,
          description: '',
        })),
      },
    ],
    request,
    studentId: 'student-1',
    submissions: [],
  })

  assert.equal(result.status, 'blocked')
  const reply = buildCvScopeReply({
    failures: result.failures,
    status: result.status,
    targetResults: result.targetResults,
  })
  assert.match(reply, /Lab Attendance Week 1.*you have not submitted/i)
  assert.match(reply, /Project \(for all students\).*you have not submitted/i)
})

test('parseCvFollowUp rebuilds synthetic CV request from clarification', () => {
  const history = [
    {
      role: 'student',
      content: 'Make a CV entry for "Assignment 5" in COS30043',
    },
    {
      role: 'assistant',
      content: 'I could not find an assignment matching that title in COS30043.',
      metadata: { contentType: 'cv_scope', courseCode: 'COS30043', status: 'not_found' },
    },
  ]
  const followUp = parseCvFollowUp('sorry, my mistake the assignment i want is week 5', history, [
    { course: { code: 'COS30043' } },
  ])

  assert.ok(followUp)
  assert.equal(followUp.courseCode, 'COS30043')
  assert.equal(followUp.title, 'week 5')
  assert.match(followUp.syntheticMessage, /week 5/i)
  assert.match(followUp.syntheticMessage, /COS30043/)
})

test('parseCvFollowUp handles i mean shorthand after not_found', () => {
  const history = [
    {
      role: 'student',
      content: 'Make a CV entry for "Assignment 5" in COS30043',
    },
    {
      role: 'assistant',
      content: 'I could not find an assignment matching that title in COS30043.',
      metadata: { contentType: 'cv_scope', courseCode: 'COS30043', status: 'not_found' },
    },
    {
      role: 'student',
      content: 'i mean week 5',
    },
  ]
  const followUp = parseCvFollowUp('i mean week 5', history, [{ course: { code: 'COS30043' } }])

  assert.ok(followUp)
  assert.equal(followUp.title, 'week 5')
  assert.equal(followUp.courseCode, 'COS30043')
})

test('parseCvProjectRequest accepts natural cv phrasing without quoted title', () => {
  const request = parseCvProjectRequest('cv for week 5 in COS30043', [{ course: { code: 'COS30043' } }])

  assert.equal(request.isCvRequest, true)
  assert.equal(request.targets.length, 1)
  assert.equal(request.targets[0].title, 'week 5')
  assert.equal(request.targets[0].courseCode, 'COS30043')
})

test('resolveCvProjects resolves week 5 follow-up target', async () => {
  const followUp = parseCvFollowUp(
    'i mean week 5',
    [
      {
        role: 'assistant',
        content: 'I could not find an assignment matching that title in COS30043.',
        metadata: { contentType: 'cv_scope', courseCode: 'COS30043', status: 'not_found' },
      },
    ],
    [{ course: { code: 'COS30043' } }],
  )
  const request = parseCvProjectRequest(followUp.syntheticMessage, [{ course: { code: 'COS30043' } }])
  const result = await resolveCvProjects({
    offerings: [
      {
        id: 'off-cos',
        course: { code: 'COS30043', title: 'Interface Design' },
        assignments: [{ id: 'asg-w5', offeringId: 'off-cos', title: 'Week 5', description: '' }],
      },
    ],
    request,
    studentId: 'student-1',
    submissions: [],
  })

  assert.equal(result.status, 'named_unsubmitted')
  assert.equal(result.title, 'Week 5')
})

test('buildCvScopeReply formats not_found response', () => {
  const text = buildCvScopeReply({
    assignmentTitles: ['Capstone Project', 'Week 3 Report'],
    courseCode: 'COS30034',
    status: 'not_found',
  })

  assert.match(text, /COS30034/)
  assert.match(text, /1\. Capstone Project/)
  assert.match(text, /which one did you mean/i)
  assert.doesNotMatch(text, /Which course did you mean\?/)
})

test('parseListReference recognizes ordinal phrases', () => {
  assert.deepEqual(parseListReference('the first one'), { type: 'ordinal', position: 1 })
  assert.deepEqual(parseListReference('the second'), { type: 'ordinal', position: 2 })
  assert.deepEqual(parseListReference('number 3'), { type: 'ordinal', position: 3 })
  assert.deepEqual(parseListReference('assignment 1'), { type: 'assignment_number', number: 1 })
  assert.deepEqual(parseListReference('the first assignment'), { type: 'ambiguous_first_assignment' })
})

test('extractAssignmentListFromHistory reads numbered assignment list', () => {
  const titles = extractAssignmentListFromHistory(cos30043NotFoundHistory)

  assert.deepEqual(titles, cos30043Assignments)
})

test('resolveListReference maps ordinals to listed assignment titles', () => {
  const first = resolveListReference(parseListReference('the first one'), cos30043Assignments)
  const second = resolveListReference(parseListReference('the second'), cos30043Assignments)

  assert.equal(first.resolved, 'Week 7 - Vite and Vue CLI')
  assert.equal(second.resolved, 'Assignment 1')
})

test('resolveListReference asks when first assignment is ambiguous', () => {
  const result = resolveListReference(parseListReference('the first assignment'), cos30043Assignments)

  assert.equal(result.resolved, undefined)
  assert.deepEqual(result.ambiguous, ['Week 7 - Vite and Vue CLI', 'Assignment 1'])
})

test('parseCvFollowUp resolves oh i mean the first one from prior list', () => {
  const followUp = parseCvFollowUp('oh i mean the first one', cos30043NotFoundHistory, [
    { course: { code: 'COS30043' } },
  ])

  assert.ok(followUp)
  assert.equal(followUp.title, 'Week 7 - Vite and Vue CLI')
  assert.match(followUp.syntheticMessage, /Week 7 - Vite and Vue CLI/)
})

test('parseCvFollowUp resolves the second to second listed assignment', () => {
  const followUp = parseCvFollowUp('i mean the second', cos30043NotFoundHistory, [
    { course: { code: 'COS30043' } },
  ])

  assert.ok(followUp)
  assert.equal(followUp.title, 'Assignment 1')
})

test('parseCvFollowUp returns ambiguity for the first assignment', () => {
  const followUp = parseCvFollowUp('the first assignment', cos30043NotFoundHistory, [
    { course: { code: 'COS30043' } },
  ])

  assert.ok(followUp)
  assert.equal(followUp.status, 'list_reference_ambiguous')
  assert.deepEqual(followUp.candidates, ['Week 7 - Vite and Vue CLI', 'Assignment 1'])
})

test('resolveCvProjects resolves follow-up the first one to listed assignment', async () => {
  const followUp = parseCvFollowUp('oh i mean the first one', cos30043NotFoundHistory, [
    { course: { code: 'COS30043' } },
  ])
  const request = parseCvProjectRequest(followUp.syntheticMessage, [{ course: { code: 'COS30043' } }])
  const result = await resolveCvProjects({
    offerings: [
      {
        id: 'off-cos',
        course: { code: 'COS30043', title: 'Interface Design' },
        assignments: cos30043Assignments.map((title, index) => ({
          id: `asg-${index}`,
          offeringId: 'off-cos',
          title,
          description: '',
        })),
      },
    ],
    request,
    studentId: 'student-1',
    submissions: [],
  })

  assert.equal(result.status, 'named_unsubmitted')
  assert.equal(result.title, 'Week 7 - Vite and Vue CLI')
})

test('buildCvScopeReply formats list_reference_ambiguous response', () => {
  const text = buildCvScopeReply({
    candidates: [{ title: 'Week 7 - Vite and Vue CLI' }, { title: 'Assignment 1' }],
    courseCode: 'COS30043',
    status: 'list_reference_ambiguous',
    title: 'the first assignment',
  })

  assert.match(text, /not sure which assignment you mean/i)
  assert.match(text, /Week 7 - Vite and Vue CLI/)
  assert.match(text, /Assignment 1/)
})

test('normalizeTitle strips punctuation for matching', () => {
  assert.equal(normalizeTitle('Capstone Project!'), 'capstone project')
})

test('isCvTopicChange detects new questions that should leave CV thread', () => {
  assert.equal(isCvTopicChange('what assignment i already submit in this course'), true)
  assert.equal(isCvTopicChange('which assignments have I submitted?'), true)
  assert.equal(isCvTopicChange('how many assignment that i submited'), true)
  assert.equal(isCvTopicChange('only 1?'), true)
  assert.equal(isCvTopicChange('explain Vue routing'), true)
  assert.equal(isCvTopicChange('i mean week 5'), false)
  assert.equal(isCvTopicChange('week 5'), false)
  assert.equal(isCvTopicChange('Make a CV entry for "Week 5" in COS30043'), false)
})

test('parseCvFollowUp ignores topic-change questions after CV thread', () => {
  const history = [
    {
      role: 'student',
      content: 'Make a CV entry for "Assignment 7" in COS30043',
    },
    {
      role: 'assistant',
      content: 'You have not submitted "Week 5" in COS30043 yet, so it cannot be added to your CV.',
      metadata: { contentType: 'cv_scope', courseCode: 'COS30043', status: 'named_unsubmitted' },
    },
  ]
  const followUp = parseCvFollowUp('what assignment i already submit in this course', history, [
    { course: { code: 'COS30043' } },
  ])

  assert.equal(followUp, null)
})

test('buildSubmittedAssignmentsReply lists submitted work for one course', () => {
  const text = buildSubmittedAssignmentsReply(
    [
      {
        course_code: 'COS30043',
        course_title: 'Interface Design',
        assignments: [
          { title: 'Assignment 1' },
          { title: 'Week 5' },
        ],
      },
    ],
    'COS30043',
  )

  assert.match(text, /COS30043/)
  assert.match(text, /Assignment 1/)
  assert.match(text, /Week 5/)
  assert.match(text, /you've submitted 2 assignments/i)
})

test('buildSubmittedAssignmentsReply handles empty submissions', () => {
  const text = buildSubmittedAssignmentsReply(
    [
      {
        course_code: 'COS30043',
        course_title: 'Interface Design',
        assignments: [],
      },
    ],
    'COS30043',
  )

  assert.match(text, /don't see any submitted assignments/i)
})

test('buildSubmittedAssignmentsReply confirms follow-up questions in tutor tone', () => {
  const history = [
    { role: 'student', content: 'how many assignment i submited' },
    {
      role: 'assistant',
      content: 'In COS30043, you\'ve submitted one assignment so far: "Assignment 1".',
      metadata: { contentType: 'submitted_assignments', courseCode: 'COS30043' },
    },
  ]
  const text = buildSubmittedAssignmentsReply(
    [
      {
        course_code: 'COS30043',
        course_title: 'Interface Design',
        assignments: [{ title: 'Assignment 1' }],
      },
    ],
    'COS30043',
    { history, message: 'just only 1?' },
  )

  assert.match(text, /^Yes —/i)
  assert.match(text, /only submitted one assignment/i)
  assert.match(text, /Assignment 1/)
  assert.doesNotMatch(text, /^Submitted assignments in/i)
})

test('resolveCvProjectsByAssignmentIds returns ready for submitted assignments', async () => {
  const { resolveCvProjectsByAssignmentIds } = await import('./cvProjectScope.js')

  const prisma = {
    assignmentSubmission: {
      findMany: async () => [
        {
          assignmentId: 'asg-1',
          studentId: 'student-1',
          body: 'demo',
          filePaths: [],
          assignment: {
            id: 'asg-1',
            offeringId: 'off-1',
            title: 'Capstone Project',
          },
        },
      ],
    },
  }

  const result = await resolveCvProjectsByAssignmentIds({
    assignmentIds: ['asg-1'],
    offerings: [offering],
    prisma,
    studentId: 'student-1',
  })

  assert.equal(result.status, 'ready')
  assert.equal(result.projects.length, 1)
  assert.equal(result.projects[0].assignment.title, 'Capstone Project')
})

test('resolveCvProjectsByAssignmentIds blocks unsubmitted assignments', async () => {
  const { resolveCvProjectsByAssignmentIds } = await import('./cvProjectScope.js')

  const prisma = {
    assignmentSubmission: {
      findMany: async () => [],
    },
  }

  const result = await resolveCvProjectsByAssignmentIds({
    assignmentIds: ['asg-missing'],
    offerings: [offering],
    prisma,
    studentId: 'student-1',
  })

  assert.equal(result.status, 'not_submitted')
  assert.match(result.assistantText, /not in your submissions/i)
})
