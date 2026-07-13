import {
  buildFilteredGradeReport,
  buildGradeReport,
  formatGradeReportMarkdown,
  isGradeRefinementRequest,
} from './gradeReport.js'
import {
  detectGradeAnalysisThreadContext,
  detectLanguage,
  formatGradeAnalysisClarify,
  formatGradeAnalysisDecline,
  formatGradeAnalysisOffer,
  formatGradeAnalysisResult,
  formatGradeGoalQuestion,
  formatUnknownUnderstanding,
  isGibberish,
} from './gradeAnalysis.js'
import { targetGradeToGoalKey, classifyGradeAnalysisIntent } from './gradeAnalysisIntent.js'
import { generateGeminiChatReply } from './geminiChat.js'
import { routeIntent } from './intentRouter.js'
import { loadPrerequisiteContext } from './prerequisites.js'
import { buildStudentProgress } from './studentProgress.js'
import {
  buildAssignmentsIndexDocument,
  ensureSwinlearnKnowledgeIndex,
  loadOfferingKnowledge,
  loadSwinlearnKnowledgeDocuments,
} from './swinlearnKnowledge.js'
import {
  createSwinlearnGroqClient,
  defaultSwinlearnContextChars,
  defaultSwinlearnModel,
  defaultSwinlearnVisionModel,
} from './swinlearnGroq.js'
import { buildSwinlearnInstructions, isPerfectCvRequest } from './swinlearnPrompt.js'
import { buildExcludedCourseMessage, resolveMessageCourseScope } from './swinlearnCourseScope.js'
import {
  detectCvThreadContext,
  parseCvProjectRequest,
  prepareCvTurn,
  resolveCvProjects,
  resolveCvScopeAssignmentList,
} from './cvProjectScope.js'
import { finalizePerfectCvResponse, preparePerfectCvTurn } from './perfectCv.js'
import { loadStudentSubmissionDocuments } from './submissionIndexing.js'
import { retrieve } from './swinlearnIndexing.js'

const UI_INTENTS = {
  cv_export: 'cv_export',
  grade_export: 'grade_export',
  perfect_cv: 'perfect_cv',
}

const buildExplicitRoute = (uiIntent) => {
  if (uiIntent === UI_INTENTS.grade_export) {
    return {
      intent: 'grade_analysis',
      confidence: 1,
      extracted_data: { agree: null, keywords: 'grades', target_grade: null },
      fallback_message: null,
    }
  }

  return null
}

const cvKeywordHint = (keywords = '') => {
  const normalized = String(keywords).toLowerCase()

  return (
    normalized.includes('cv') ||
    normalized.includes('resume') ||
    normalized.includes('portfolio') ||
    normalized.includes('curriculum vitae')
  )
}

const assignmentListingHint = (keywords = '', message = '') => {
  const normalized = `${keywords} ${message}`.toLowerCase()

  return normalized.includes('assignment') || normalized.includes('assessment') || normalized.includes('bài tập')
}

const shouldTryCvFlow = ({ cvThreadContext, explicitUiIntent, route }) =>
  explicitUiIntent === UI_INTENTS.cv_export ||
  explicitUiIntent === UI_INTENTS.perfect_cv ||
  cvThreadContext ||
  (route.intent === 'document_qa' && cvKeywordHint(route.extracted_data.keywords))

const shouldSkipKnowledgeRetrieval = ({
  selectedOfferingIds,
  explicitUiIntent,
  cvThreadContext,
  gradeAnalysisContext,
  perfectCvActive,
  cvActive,
}) =>
  selectedOfferingIds.length === 0 &&
  explicitUiIntent !== UI_INTENTS.grade_export &&
  !perfectCvActive &&
  !cvActive &&
  !cvThreadContext &&
  !gradeAnalysisContext

const loadKnowledgeDocuments = async ({
  courseScope,
  cvTurn,
  gradeAnalysisContext,
  message,
  offeringIds,
  perfectCvTurn,
  prisma,
  rag,
  route,
  scopedOfferingIds,
  skipKnowledgeRetrieval,
  uploadDocuments,
  userId,
  threadId,
  cvRequest,
  perfectCvRequest,
  retrieveImpl = retrieve,
  loadSwinlearnKnowledgeDocumentsImpl = loadSwinlearnKnowledgeDocuments,
  ensureSwinlearnKnowledgeIndexImpl = ensureSwinlearnKnowledgeIndex,
  loadStudentSubmissionDocumentsImpl = loadStudentSubmissionDocuments,
  buildAssignmentsIndexDocumentImpl = buildAssignmentsIndexDocument,
  loadOfferingKnowledgeImpl = loadOfferingKnowledge,
}) => {
  if (perfectCvTurn?.status === 'ready') {
    return perfectCvTurn.documents
  }

  if (cvRequest) {
    return cvTurn?.status === 'ready' ? cvTurn.documents : []
  }

  if (cvTurn?.status === 'ready') {
    return cvTurn.documents
  }

  if (skipKnowledgeRetrieval) {
    return []
  }

  if (courseScope.scopeMode === 'excluded') {
    return []
  }

  if (rag.configured) {
    const query = route.extracted_data.keywords?.trim() || message
    let documents = await retrieveImpl({
      embedder: rag.embedder,
      offeringIds: scopedOfferingIds,
      query,
      threadId,
      userId,
      vectorStore: rag.vectorStore,
    })

    if (documents.length === 0 && scopedOfferingIds.length > 0) {
      documents = await loadSwinlearnKnowledgeDocumentsImpl({
        maxChars: defaultSwinlearnContextChars,
        offeringIds: scopedOfferingIds,
        prisma,
      })
    }

    if (
      courseScope.scopeMode !== 'excluded' &&
      route.intent === 'document_qa' &&
      scopedOfferingIds.length === 1 &&
      assignmentListingHint(route.extracted_data.keywords, message)
    ) {
      const offering = await loadOfferingKnowledgeImpl(prisma, scopedOfferingIds[0])

      if (offering) {
        documents = [buildAssignmentsIndexDocumentImpl(offering), ...documents]
      }
    }

    return documents
  }

  const indexes = []

  for (const offeringId of scopedOfferingIds) {
    const index = await ensureSwinlearnKnowledgeIndexImpl({
      offeringId,
      prisma,
    })

    if (index?.status === 'ready') {
      indexes.push(index)
    }
  }

  const courseDocuments = await loadSwinlearnKnowledgeDocumentsImpl({
    maxChars: defaultSwinlearnContextChars,
    offeringIds: indexes.map((index) => index.offeringId),
    prisma,
  })
  const submissionDocuments = await loadStudentSubmissionDocumentsImpl({
    offeringIds: scopedOfferingIds,
    prisma,
    studentId: userId,
  })

  return [...courseDocuments, ...uploadDocuments, ...submissionDocuments]
}

const handleGradeAnalysis = async ({
  gradeAnalysisContext,
  message,
  prisma,
  responseLocale,
  userId,
  loadPrerequisiteContextImpl = loadPrerequisiteContext,
  classifyGradeAnalysisIntentImpl = classifyGradeAnalysisIntent,
}) => {
  if (
    gradeAnalysisContext?.state === 'offered' ||
    gradeAnalysisContext?.state === 'awaiting_goal'
  ) {
    const intent = await classifyGradeAnalysisIntentImpl({
      context: gradeAnalysisContext.state,
      locale: responseLocale,
      message,
    })

    if (intent.fallback_message) {
      // The classifier could not read a clear agree/decline or target. Before
      // asking again, let the student refine the table they were just shown
      // (e.g. "show only the P ones") so the chat feels iterative, not stuck.
      if (
        gradeAnalysisContext.state === 'offered' &&
        isGradeRefinementRequest(message)
      ) {
        const regContext = await loadPrerequisiteContextImpl(prisma, userId)

        if (regContext?.student) {
          const fullReport = buildGradeReport(
            buildStudentProgress({
              student: regContext.student,
              courses: regContext.courses,
              curriculumRules: regContext.curriculumRules,
              childMajors: regContext.childMajors,
              completions: regContext.completions,
            }),
          )
          const { report: filtered, matched } = buildFilteredGradeReport(fullReport, message)

          if (matched) {
            return {
              assistantText: `${formatGradeReportMarkdown(filtered)}\n\n${formatGradeAnalysisOffer(responseLocale)}`,
              gradeExportReply: { report: filtered, analysisState: 'offered' },
            }
          }
        }
      }

      // Reply in the user's own language rather than trusting the model's
      // fallback wording (which may be in the wrong locale).
      return {
        assistantText:
          gradeAnalysisContext.state === 'offered'
            ? formatGradeAnalysisClarify(responseLocale)
            : formatGradeGoalQuestion(responseLocale),
        gradeAnalysisReply: { analysisState: gradeAnalysisContext.state },
      }
    }

    if (gradeAnalysisContext.state === 'offered') {
      if (intent.agree === true) {
        return {
          assistantText: formatGradeGoalQuestion(responseLocale),
          gradeAnalysisReply: { analysisState: 'awaiting_goal' },
        }
      }

      if (intent.agree === false) {
        return {
          assistantText: formatGradeAnalysisDecline(responseLocale),
          gradeAnalysisReply: { analysisState: 'declined' },
        }
      }

      return {
        assistantText: formatGradeAnalysisClarify(responseLocale),
        gradeAnalysisReply: { analysisState: 'offered' },
      }
    }

    const goal = targetGradeToGoalKey(intent.target_grade)

    if (goal) {
      const regContext = await loadPrerequisiteContextImpl(prisma, userId)

      if (!regContext?.student) {
        return {
          assistantText:
            responseLocale === 'vi'
              ? 'Phan tich ban diem chi danh cho sinh vien da dang ky va co tien do hoc tap.'
              : 'Grade analysis is only available for registered students with academic progress.',
          gradeAnalysisReply: { analysisState: 'awaiting_goal' },
        }
      }

      const report = buildGradeReport(
        buildStudentProgress({
          student: regContext.student,
          courses: regContext.courses,
          curriculumRules: regContext.curriculumRules,
          childMajors: regContext.childMajors,
          completions: regContext.completions,
        }),
      )

      return {
        assistantText: formatGradeAnalysisResult(report, goal, responseLocale),
        gradeAnalysisReply: { analysisState: 'complete', contentType: 'grade_analysis' },
      }
    }

    return {
      assistantText: formatGradeGoalQuestion(responseLocale),
      gradeAnalysisReply: { analysisState: 'awaiting_goal' },
    }
  }

  const regContext = await loadPrerequisiteContextImpl(prisma, userId)

  if (!regContext?.student) {
    return {
      assistantText:
        responseLocale === 'vi'
          ? 'Xuất bảng điểm chỉ dành cho sinh viên đã đăng ký và có tiến độ học tập.'
          : 'Grade export is only available for registered students with academic progress.',
      gradeExportReply: null,
    }
  }

  const report = buildGradeReport(
    buildStudentProgress({
      student: regContext.student,
      courses: regContext.courses,
      curriculumRules: regContext.curriculumRules,
      childMajors: regContext.childMajors,
      completions: regContext.completions,
    }),
  )

  return {
    assistantText: `${formatGradeReportMarkdown(report)}\n\n${formatGradeAnalysisOffer(responseLocale)}`,
    gradeExportReply: { report, analysisState: 'offered' },
  }
}

const fallbackSwinlearnAnswer = async ({ prisma, selectedOfferingIds }) => {
  const documents = await loadSwinlearnKnowledgeDocuments({
    maxChars: 12000,
    offeringIds: selectedOfferingIds,
    prisma,
  })

  if (documents.length === 0) {
    return 'You are not enrolled in any course content I can read yet.'
  }

  const summaries = documents.map((document) => document.text.split('\n').slice(0, 12).join('\n'))

  return [
    'SWINLEARN is not connected to Groq yet, so I can only show a local course-content preview.',
    'Ask an admin to configure GROQ_API_KEY for full tutoring and summaries.',
    '',
    summaries.join('\n\n---\n\n'),
  ].join('\n')
}

const resolvePerfectCvAssignmentIdsFromText = async ({
  message,
  offerings,
  prisma,
  studentId,
  loadOfferingKnowledgeImpl,
}) => {
  const request = parseCvProjectRequest(
    message,
    offerings.map((offering) => ({ course: offering.course })),
  )

  const scopedOfferings = (
    await Promise.all(offerings.map((offering) => loadOfferingKnowledgeImpl(prisma, offering.id)))
  ).filter(Boolean)

  const scopedOfferingIds = scopedOfferings.map((offering) => offering.id)

  const submissions =
    scopedOfferingIds.length > 0
      ? await prisma.assignmentSubmission.findMany({
          where: {
            studentId,
            assignment: { offeringId: { in: scopedOfferingIds } },
          },
          include: { assignment: true },
        })
      : []

  const resolution = await resolveCvProjects({
    offerings: scopedOfferings,
    request,
    studentId,
    submissions,
  })

  if (resolution.status === 'ready') {
    return resolution.projects.map((project) => project.assignment.id)
  }

  // No specific assignment named in the text (e.g. "make the perfect cv").
  // Default to every submitted project so the full Perfect CV is produced.
  if (request.targets.length === 0) {
    return submissions.map((submission) => submission.assignmentId).filter(Boolean)
  }

  return []
}

export async function handleSwinlearnMessage({
  assignmentIds = [],
  attachmentsInput = [],
  courseScope,
  courseLabels,
  cvThreadContext,
  explicitUiIntent = '',
  gradeAnalysisContext,
  groq = createSwinlearnGroqClient(),
  history = [],
  imageInputs = [],
  loadOfferingKnowledgeImpl = loadOfferingKnowledge,
  loadPrerequisiteContextImpl = loadPrerequisiteContext,
  classifyGradeAnalysisIntentImpl = classifyGradeAnalysisIntent,
  prepareCvTurnImpl = prepareCvTurn,
  preparePerfectCvTurnImpl = preparePerfectCvTurn,
  generateGeminiChatReplyImpl = generateGeminiChatReply,
  retrieveImpl = retrieve,
  loadSwinlearnKnowledgeDocumentsImpl = loadSwinlearnKnowledgeDocuments,
  ensureSwinlearnKnowledgeIndexImpl = ensureSwinlearnKnowledgeIndex,
  loadStudentSubmissionDocumentsImpl = loadStudentSubmissionDocuments,
  buildAssignmentsIndexDocumentImpl = buildAssignmentsIndexDocument,
  message,
  offerings = [],
  perfectCvRequest = false,
  prisma,
  rag,
  responseLocale,
  route,
  scopedOfferingIds,
  selectedOfferingIds,
  studentId,
  thread,
  uploadDocuments = [],
  userId,
}) {
  let assistantText = ''
  let citations = []
  let providerResponseId = null
  let gradeExportReply = null
  let gradeAnalysisReply = null
  let cvTurn = null
  let perfectCvTurn = null

  let perfectCvAssignmentIds = [...assignmentIds]

  // The Perfect CV button supplies assignmentIds via the UI, but when a user
  // types it in chat (e.g. "make the perfect cv for assignment 1 in COS30043")
  // we detect the intent from the text and resolve the assignment(s) too.
  if (!perfectCvRequest && perfectCvAssignmentIds.length === 0 && isPerfectCvRequest(message)) {
    perfectCvRequest = true
    perfectCvAssignmentIds = await resolvePerfectCvAssignmentIdsFromText({
      loadOfferingKnowledgeImpl,
      message,
      offerings,
      prisma,
      studentId,
    })
  }

  if (perfectCvRequest) {
    perfectCvTurn = await preparePerfectCvTurnImpl({
      assignmentIds: perfectCvAssignmentIds,
      loadOfferingKnowledge: loadOfferingKnowledgeImpl,
      offeringIds: offerings.map((offering) => offering.id),
      prisma,
      studentId,
    })
  }

  const cvRequest = shouldTryCvFlow({
    cvThreadContext,
    explicitUiIntent,
    route,
  })

  if (cvRequest) {
    cvTurn = await prepareCvTurnImpl({
      forceCv:
        explicitUiIntent === UI_INTENTS.cv_export ||
        Boolean(cvThreadContext),
      history,
      loadOfferingKnowledge: loadOfferingKnowledgeImpl,
      message,
      offeringIds: scopedOfferingIds,
      prisma,
      studentId,
    })
  }

  const instructions = buildSwinlearnInstructions({
    courseLabels,
    cvMode:
      perfectCvRequest ||
      cvRequest ||
      cvTurn?.status === 'ready' ||
      perfectCvTurn?.status === 'ready',
    perfectCvMode: perfectCvRequest && perfectCvTurn?.status === 'ready',
    scopeMode: courseScope.scopeMode,
    scopedCourseCodes: courseScope.courseCodes,
    knowledgePoolEmpty: selectedOfferingIds.length === 0,
  })

  const skipKnowledgeRetrieval = shouldSkipKnowledgeRetrieval({
    selectedOfferingIds,
    explicitUiIntent,
    cvThreadContext,
    gradeAnalysisContext,
    perfectCvActive: perfectCvRequest,
    cvActive: cvRequest,
  })

  const documents = await loadKnowledgeDocuments({
    courseScope,
    cvTurn,
    gradeAnalysisContext,
    message,
    offeringIds: offerings.map((offering) => offering.id),
    perfectCvTurn,
    prisma,
    rag,
    route,
    scopedOfferingIds,
    skipKnowledgeRetrieval,
    uploadDocuments,
    userId,
    threadId: thread.id,
    cvRequest,
    perfectCvRequest,
    retrieveImpl,
    loadSwinlearnKnowledgeDocumentsImpl,
    ensureSwinlearnKnowledgeIndexImpl,
    loadStudentSubmissionDocumentsImpl,
    buildAssignmentsIndexDocumentImpl,
    loadOfferingKnowledgeImpl,
  })

  if (courseScope.scopeMode === 'excluded') {
    assistantText = buildExcludedCourseMessage(
      courseScope.excludedFromPool.length > 0 ? courseScope.excludedFromPool : courseScope.courseCodes,
    )
  } else if (route.intent === 'smalltalk' && !gradeAnalysisContext) {
    if (isGibberish(message)) {
      assistantText = formatUnknownUnderstanding(responseLocale)
    } else {
      assistantText = await generateGeminiChatReplyImpl({
        history,
        message,
      })
    }
  } else if (route.intent === 'unknown' && !gradeAnalysisContext) {
    assistantText = formatUnknownUnderstanding(responseLocale)
  } else if (route.intent === 'grade_analysis' || gradeAnalysisContext) {
    const gradeResult = await handleGradeAnalysis({
      gradeAnalysisContext,
      message,
      prisma,
      responseLocale,
      userId: studentId,
      loadPrerequisiteContextImpl,
      classifyGradeAnalysisIntentImpl,
    })

    assistantText = gradeResult.assistantText
    gradeExportReply = gradeResult.gradeExportReply ?? null
    gradeAnalysisReply = gradeResult.gradeAnalysisReply ?? null
  } else if (perfectCvTurn?.status && perfectCvTurn.status !== 'ready') {
    assistantText = perfectCvTurn.assistantText
  } else if (cvTurn?.status && cvTurn.status !== 'not_cv' && cvTurn.status !== 'ready') {
    assistantText = cvTurn.assistantText
  } else if (perfectCvTurn?.status === 'ready' && !groq.configured) {
    assistantText = finalizePerfectCvResponse(
      '## Experience\n\n_Connect SWINLEARN to Groq to generate project bullets from your submissions._',
      perfectCvTurn,
    )
  } else if (!groq.configured) {
    assistantText = await fallbackSwinlearnAnswer({
      prisma,
      selectedOfferingIds: scopedOfferingIds,
    })
  } else {
    const result = await groq.createResponse({
      documents,
      history,
      imageInputs,
      instructions,
      message,
      model: imageInputs.length > 0 ? defaultSwinlearnVisionModel : defaultSwinlearnModel,
    })

    assistantText = result.text || 'I could not generate a response from the selected course knowledge.'
    citations = result.citations
    providerResponseId = result.raw?.id ?? null

    if (perfectCvTurn?.status === 'ready') {
      assistantText = finalizePerfectCvResponse(assistantText, perfectCvTurn)
    }
  }

  const metadata =
    perfectCvTurn?.status === 'ready'
      ? {
          assignmentIds: perfectCvTurn.assignmentIds,
          contentType: 'perfect_cv_export',
          cvProfile: perfectCvTurn.cvProfile,
          education: perfectCvTurn.education,
          skills: perfectCvTurn.skills,
        }
      : perfectCvTurn?.status && perfectCvTurn.status !== 'ready'
        ? {
            contentType: 'cv_scope',
            status: perfectCvTurn.status,
          }
        : cvTurn?.status === 'ready'
          ? {
              assignmentIds: cvTurn.assignmentIds,
              contentType: 'cv_export',
            }
          : cvTurn?.status && cvTurn.status !== 'not_cv'
            ? {
                assignmentList: resolveCvScopeAssignmentList(cvTurn),
                contentType: 'cv_scope',
                courseCode:
                  cvTurn.resolution?.courseCode ??
                  cvTurn.resolution?.targetResults?.[0]?.courseCode ??
                  cvTurn.followUp?.courseCode ??
                  null,
                status: cvTurn.status,
              }
            : gradeExportReply
              ? {
                  contentType: 'grade_export',
                  report: gradeExportReply.report,
                  analysisState: gradeExportReply.analysisState ?? 'offered',
                }
              : gradeAnalysisReply
                ? {
                    contentType: gradeAnalysisReply.contentType ?? 'grade_analysis',
                    analysisState: gradeAnalysisReply.analysisState,
                  }
                : null

  return {
    assistantText,
    citations,
    metadata,
    model: groq.configured
      ? imageInputs.length > 0
        ? defaultSwinlearnVisionModel
        : defaultSwinlearnModel
      : null,
    providerResponseId,
    route,
  }
}

export { buildExplicitRoute, UI_INTENTS }
