import assert from 'node:assert/strict'
import test from 'node:test'

// Offline, deterministic integration tests for the SwinLearn chatbot orchestrator
// (server/services/swinlearnMessageHandler.js). The orchestrator injects its
// sub-services through optional parameters (with production defaults), so every
// flow can be exercised without API keys or a live database. These tests verify
// the wiring/routing of each feature, not the LLM quality (that is covered by the
// live NLU eval suite, nluEval.live.test.mjs).

const fakePrereqContext = () => ({
  student: { id: 's1', child_major_id: 'cm1' },
  courses: [{ id: 'c1', code: 'COS10001', title: 'Intro to Programming' }],
  childMajors: [],
  curriculumRules: [],
  completions: [
    { id: 'comp1', student_id: 's1', course_id: 'c1', final_score: 75, completed_at: '2025-01-01' },
  ],
})

const baseArgs = ({
  override = {},
  groq = configuredGroq(),
  rag = { configured: false, embedder: {}, vectorStore: {} },
  sub = {},
} = {}) => ({
  courseLabels: [],
  courseScope: { scopeMode: 'all', courseCodes: [], excludedFromPool: [] },
  explicitUiIntent: '',
  groq,
  history: [],
  message: 'hello',
  offerings: [],
  perfectCvRequest: false,
  prisma: {},
  rag,
  responseLocale: 'vi',
  route: { intent: 'document_qa', confidence: 1, extracted_data: { keywords: 'final exam' }, fallback_message: null },
  scopedOfferingIds: [],
  selectedOfferingIds: [],
  studentId: 's1',
  thread: { id: 'thread1' },
  uploadDocuments: [],
  userId: 's1',
  // Injected sub-services (defaults are the real implementations).
  loadPrerequisiteContextImpl: async () => fakePrereqContext(),
  classifyGradeAnalysisIntentImpl: async () => ({ agree: null, target_grade: null, fallback_message: null }),
  generateGeminiChatReplyImpl: async () => 'Smalltalk hi!',
  prepareCvTurnImpl: async () => ({ status: 'not_cv' }),
  preparePerfectCvTurnImpl: async () => ({ status: 'missing_assignments' }),
  retrieveImpl: async () => [],
  loadSwinlearnKnowledgeDocumentsImpl: async () => [],
  ensureSwinlearnKnowledgeIndexImpl: async () => null,
  loadStudentSubmissionDocumentsImpl: async () => [],
  buildAssignmentsIndexDocumentImpl: () => null,
  ...sub,
  ...override,
})

const configuredGroq = () => ({
  configured: true,
  async createResponse() {
    return { text: 'Tutor answer', citations: [{ sourceId: 's1', snippet: 'x' }], raw: { id: 'resp1' } }
  },
})

const unknownGroq = () => ({
  configured: false,
  async createResponse() {
    return { text: '' }
  },
})

const { handleSwinlearnMessage, UI_INTENTS } = await import('./swinlearnMessageHandler.js')
const { routeIntentGroq } = await import('./intentRouter.js')

const groqRouteResponse = (payload) => async () => ({
  ok: true,
  text: async () => JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) } }] }),
})

test('grade_analysis export returns a grade table offer for enrolled student', async () => {
  const result = await handleSwinlearnMessage(
    baseArgs({
      override: {
        route: { intent: 'grade_analysis', confidence: 1, extracted_data: { keywords: 'grades' }, fallback_message: null },
      },
    }),
  )
  assert.equal(result.metadata?.contentType, 'grade_export')
  assert.ok(result.metadata?.report, 'report object expected')
  assert.match(result.assistantText, /COS10001/)
  assert.match(result.assistantText, /Grade table|bảng điểm/i)
})

test('grade_analysis agree flow advances to awaiting_goal', async () => {
  const result = await handleSwinlearnMessage(
    baseArgs({
      sub: {
        classifyGradeAnalysisIntentImpl: async () => ({ agree: true, target_grade: null, fallback_message: null }),
      },
      override: {
        route: { intent: 'grade_analysis', confidence: 1, extracted_data: {}, fallback_message: null },
        gradeAnalysisContext: { state: 'offered' },
        message: 'yessss',
      },
    }),
  )

  assert.equal(result.metadata?.analysisState, 'awaiting_goal')
  assert.equal(result.metadata?.contentType, 'grade_analysis')
})

test('grade_analysis target grade produces a completed analysis', async () => {
  const result = await handleSwinlearnMessage(
    baseArgs({
      sub: {
        classifyGradeAnalysisIntentImpl: async () => ({ agree: null, target_grade: 3, fallback_message: null }),
      },
      override: {
        route: { intent: 'grade_analysis', confidence: 1, extracted_data: {}, fallback_message: null },
        gradeAnalysisContext: { state: 'awaiting_goal' },
        message: 'giỏi',
      },
    }),
  )

  assert.equal(result.metadata?.analysisState, 'complete')
  assert.equal(result.metadata?.contentType, 'grade_analysis')
  assert.match(result.assistantText, /Phân tích bản điểm|Phan tich ban diem/i)
})

test('document_qa routes to RAG retrieval and returns cited tutor answer', async () => {
  let retrievedQuery = null
  let retrievedOfferingIds = null

  const result = await handleSwinlearnMessage(
    baseArgs({
      rag: { configured: true, embedder: {}, vectorStore: {} },
      sub: {
        retrieveImpl: async ({ query, offeringIds }) => {
          retrievedQuery = query
          retrievedOfferingIds = offeringIds
          return [{ text: 'A relevant chunk about the topic.', sourceId: 's1' }]
        },
      },
      override: {
        route: { intent: 'document_qa', confidence: 1, extracted_data: { keywords: 'final exam' }, fallback_message: null },
        scopedOfferingIds: ['o1'],
        selectedOfferingIds: ['o1'],
        courseScope: { scopeMode: 'message', courseCodes: ['COS10001'], excludedFromPool: [] },
      },
    }),
  )

  assert.equal(retrievedQuery, 'final exam')
  assert.deepEqual(retrievedOfferingIds, ['o1'])
  assert.equal(result.assistantText, 'Tutor answer')
  assert.equal(result.citations.length, 1)
  assert.equal(result.providerResponseId, 'resp1')
  assert.equal(result.route.intent, 'document_qa')
})

test('unconfigured groq falls back to local course-content preview', async () => {
  const result = await handleSwinlearnMessage(
    baseArgs({
      groq: unknownGroq(),
      rag: { configured: false, embedder: {}, vectorStore: {} },
      override: { selectedOfferingIds: [], scopedOfferingIds: [] },
    }),
  )

  assert.match(result.assistantText, /not enrolled in any course content/i)
})

test('explicit cv_export intent produces a cv_export metadata payload', async () => {
  const result = await handleSwinlearnMessage(
    baseArgs({
      sub: {
        prepareCvTurnImpl: async () => ({ status: 'ready', documents: [{ text: 'cv doc' }], assignmentIds: ['a1'] }),
      },
      override: {
        explicitUiIntent: UI_INTENTS.cv_export,
        route: { intent: 'document_qa', confidence: 1, extracted_data: { keywords: 'cv' }, fallback_message: null },
      },
    }),
  )

  assert.equal(result.metadata?.contentType, 'cv_export')
  assert.deepEqual(result.metadata?.assignmentIds, ['a1'])
})

test('perfect_cv request produces a perfect_cv_export payload with profile', async () => {
  const result = await handleSwinlearnMessage(
    baseArgs({
      sub: {
        preparePerfectCvTurnImpl: async () => ({
          status: 'ready',
          documents: [{ text: 'perfect cv doc' }],
          assignmentIds: ['a1'],
          cvProfile: { phone: null, headline_role: 'Dev', certifications: null },
          education: { campus: 'HCMC', institution: 'Swinburne', majorTitle: 'CS' },
          skills: { tools: ['React'], roles: ['Frontend'] },
          header: '# Header',
        }),
      },
      override: {
        perfectCvRequest: true,
        offerings: [{ id: 'o1' }],
        assignmentIds: ['a1'],
        route: { intent: 'document_qa', confidence: 1, extracted_data: { keywords: 'cv' }, fallback_message: null },
      },
    }),
  )

  assert.equal(result.metadata?.contentType, 'perfect_cv_export')
  assert.equal(result.metadata?.cvProfile?.headline_role, 'Dev')
  assert.equal(result.metadata?.education?.institution, 'Swinburne')
})

test('free-text perfect cv request triggers the perfect cv flow via intent detection', async () => {
  let capturedAssignmentIds = null

  const result = await handleSwinlearnMessage(
    baseArgs({
      sub: {
        preparePerfectCvTurnImpl: async (args) => {
          capturedAssignmentIds = args.assignmentIds

          return {
            status: 'ready',
            documents: [{ text: 'perfect cv doc' }],
            assignmentIds: args.assignmentIds,
            cvProfile: { phone: null, headline_role: 'Dev', certifications: null },
            education: { campus: 'HCMC', institution: 'Swinburne', majorTitle: 'CS' },
            skills: { tools: ['React'], roles: ['Frontend'] },
            header: '# Header',
          }
        },
        loadOfferingKnowledgeImpl: async () => ({
          id: 'o1',
          course: { code: 'COS30043' },
          assignments: [{ id: 'a1', title: 'Assignment 1' }],
        }),
      },
      override: {
        explicitUiIntent: '',
        perfectCvRequest: false,
        offerings: [{ id: 'o1', course: { code: 'COS30043' }, assignments: [{ id: 'a1', title: 'Assignment 1' }] }],
        assignmentIds: [],
        message: 'make the perfect cv for assignment 1 in cos30043',
        prisma: {
          assignmentSubmission: {
            findMany: async () => [
              { assignmentId: 'a1', studentId: 's1', body: 'github', filePaths: [], assignment: { id: 'a1', title: 'Assignment 1', offeringId: 'o1' } },
            ],
          },
        },
        route: { intent: 'unknown', confidence: 1, extracted_data: {}, fallback_message: null },
      },
    }),
  )

  assert.equal(result.metadata?.contentType, 'perfect_cv_export')
  assert.ok(Array.isArray(capturedAssignmentIds))
  assert.deepEqual(capturedAssignmentIds, ['a1'])
})

test('free-text perfect cv without a named assignment defaults to all submitted projects', async () => {
  let capturedAssignmentIds = null

  const result = await handleSwinlearnMessage(
    baseArgs({
      sub: {
        preparePerfectCvTurnImpl: async (args) => {
          capturedAssignmentIds = args.assignmentIds

          return {
            status: 'ready',
            documents: [{ text: 'perfect cv doc' }],
            assignmentIds: args.assignmentIds,
            cvProfile: {},
            education: {},
            skills: {},
            header: '',
          }
        },
        loadOfferingKnowledgeImpl: async () => ({
          id: 'o1',
          course: { code: 'COS30043' },
          assignments: [{ id: 'a1', title: 'Assignment 1' }],
        }),
      },
      override: {
        explicitUiIntent: '',
        perfectCvRequest: false,
        offerings: [{ id: 'o1', course: { code: 'COS30043' }, assignments: [{ id: 'a1', title: 'Assignment 1' }] }],
        assignmentIds: [],
        message: 'i mean make the perfect cv',
        prisma: {
          assignmentSubmission: {
            findMany: async () => [
              { assignmentId: 'a1', studentId: 's1', body: 'github', filePaths: [], assignment: { id: 'a1', title: 'Assignment 1', offeringId: 'o1' } },
            ],
          },
        },
        route: { intent: 'unknown', confidence: 1, extracted_data: {}, fallback_message: null },
      },
    }),
  )

  assert.equal(result.metadata?.contentType, 'perfect_cv_export')
  assert.deepEqual(capturedAssignmentIds, ['a1'])
})

test('excluded course scope short-circuits with a scoped message and no retrieval', async () => {
  const result = await handleSwinlearnMessage(
    baseArgs({
      override: {
        courseScope: { scopeMode: 'excluded', courseCodes: ['COS99999'], excludedFromPool: ['COS99999'] },
        route: { intent: 'document_qa', confidence: 1, extracted_data: { keywords: 'x' }, fallback_message: null },
      },
    }),
  )

  assert.match(result.assistantText, /COS99999/)
  assert.equal(result.metadata, null)
})

test('smalltalk intent uses the chat reply generator', async () => {
  const result = await handleSwinlearnMessage(
    baseArgs({
      sub: { generateGeminiChatReplyImpl: async () => 'Chào bạn, mình có thể giúp gì?' },
      override: {
        route: { intent: 'smalltalk', confidence: 1, extracted_data: {}, fallback_message: null },
        message: 'hey there',
      },
    }),
  )

  assert.equal(result.assistantText, 'Chào bạn, mình có thể giúp gì?')
})

test('unknown intent replies with a did-not-understand message', async () => {
  const result = await handleSwinlearnMessage(
    baseArgs({
      sub: { generateGeminiChatReplyImpl: async () => 'Xin chào! Mình là SWINLEARN.' },
      override: {
        route: { intent: 'unknown', confidence: 1, extracted_data: {}, fallback_message: null },
        message: 'ieuncfwde',
        responseLocale: 'en',
      },
    }),
  )

  assert.match(result.assistantText, /didn't quite catch that/i)
  assert.equal(result.metadata, null)
})

test('smalltalk gibberish does not greet or repeat; it asks to clarify', async () => {
  // Even if the LLM mislabels gibberish as smalltalk, the local gibberish
  // guard must intercept it instead of greeting.
  const result = await handleSwinlearnMessage(
    baseArgs({
      sub: { generateGeminiChatReplyImpl: async () => 'Xin chào! Mình là SWINLEARN.' },
      override: {
        route: { intent: 'smalltalk', confidence: 1, extracted_data: {}, fallback_message: null },
        message: 'hehe',
        responseLocale: 'en',
      },
    }),
  )

  assert.match(result.assistantText, /didn't quite catch that/i)
  assert.notEqual(result.assistantText, 'Xin chào! Mình là SWINLEARN.')
})

test('gibberish after a completed grade analysis does not re-enter the flow', async () => {
  const result = await handleSwinlearnMessage(
    baseArgs({
      override: {
        message: 'h',
        responseLocale: 'en',
        gradeAnalysisContext: null,
        route: { intent: 'smalltalk', confidence: 1, extracted_data: {}, fallback_message: null },
        history: [
          { role: 'assistant', metadata: { contentType: 'grade_export', analysisState: 'awaiting_goal' } },
          { role: 'user', metadata: { content: '3' } },
          { role: 'assistant', metadata: { contentType: 'grade_analysis', analysisState: 'complete' } },
          { role: 'user', metadata: { content: 'h' } },
        ],
      },
    }),
  )

  // Terminal state -> no grade flow, and gibberish -> clarification, not a greeting.
  assert.match(result.assistantText, /didn't quite catch that/i)
  assert.equal(result.metadata, null)
})

const multiGradeContext = () => ({
  student: { id: 's1', child_major_id: 'cm1' },
  courses: [
    { id: 'c1', code: 'COS10009', title: 'Intro to Programming' },
    { id: 'c2', code: 'COS10005', title: 'Web Development' },
    { id: 'c3', code: 'COS10004', title: 'Computer Systems' },
  ],
  childMajors: [],
  curriculumRules: [],
  completions: [
    { id: 'comp1', student_id: 's1', course_id: 'c1', final_score: 57, completed_at: '2025-01-01' },
    { id: 'comp2', student_id: 's1', course_id: 'c2', final_score: 75, completed_at: '2025-01-01' },
    { id: 'comp3', student_id: 's1', course_id: 'c3', final_score: 50, completed_at: '2025-01-01' },
  ],
})

test('offered-state refinement filters the grade table to P grades (English in, English out)', async () => {
  const result = await handleSwinlearnMessage(
    baseArgs({
      sub: {
        loadPrerequisiteContextImpl: async () => multiGradeContext(),
        // Classifier cannot read a clear yes/no -> fallback, so the handler
        // must try a table refinement instead of re-asking.
        classifyGradeAnalysisIntentImpl: async () => ({
          agree: null,
          target_grade: null,
          fallback_message: 'Sorry, I did not catch that. Reply yes or no.',
        }),
      },
      override: {
        route: { intent: 'grade_analysis', confidence: 1, extracted_data: {}, fallback_message: null },
        gradeAnalysisContext: { state: 'offered' },
        responseLocale: 'en',
        message: 'just show only the P one',
      },
    }),
  )

  assert.equal(result.metadata?.contentType, 'grade_export')
  // Filtered table should keep the two P courses and drop the D.
  assert.match(result.assistantText, /COS10009/)
  assert.match(result.assistantText, /COS10004/)
  assert.doesNotMatch(result.assistantText, /COS10005/)
  assert.match(result.assistantText, /Would you like me to analyze/)
})

test('offered-state unclear reply uses the user language for clarification', async () => {
  const result = await handleSwinlearnMessage(
    baseArgs({
      sub: {
        // Classifier returns a Vietnamese fallback, but the handler must reply
        // in the user's language, not the model's wording.
        classifyGradeAnalysisIntentImpl: async () => ({
          agree: null,
          target_grade: null,
          fallback_message: 'Xin lỗi, mình chưa hiểu ý bạn.',
        }),
      },
      override: {
        route: { intent: 'grade_analysis', confidence: 1, extracted_data: {}, fallback_message: null },
        gradeAnalysisContext: { state: 'offered' },
        responseLocale: 'en',
        message: 'what do you mean',
      },
    }),
  )

  // Not a refinement request, so the localized English clarification wins over
  // the classifier's Vietnamese fallback.
  assert.match(result.assistantText, /Would you like me to analyze|reply "yes" or "no"/i)
  assert.doesNotMatch(result.assistantText, /Xin lỗi, mình chưa hiểu/)
})

test('free-typed grade request routes via Groq (no Gemini) to grade export', async () => {
  // Reproduces the bug: with only a Groq key and no Gemini, a free-typed grade
  // request must still reach the grade flow instead of being answered as a
  // course-knowledge question.
  const route = await routeIntentGroq({
    apiKey: 'test-groq-key',
    fetchImpl: groqRouteResponse({
      confidence: 0.92,
      extracted_data: { agree: null, keywords: 'grades', target_grade: null },
      fallback_message: null,
      intent: 'grade_analysis',
    }),
    message: 'i want to see my grade table',
  })

  assert.equal(route.intent, 'grade_analysis')

  const result = await handleSwinlearnMessage(baseArgs({ override: { route } }))

  assert.equal(result.metadata?.contentType, 'grade_export')
  assert.match(result.assistantText, /Grade table/)
})
