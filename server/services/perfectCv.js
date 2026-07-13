import {
  buildContactBlock,
  buildEducationBlock,
  buildPerfectCvHeaderBlock,
  buildSkillsBlock,
  campusLabels,
  CERT_PLACEHOLDER,
  formatPhoneForCv,
  PHONE_PLACEHOLDER,
} from '../../src/features/swinlearn/lib/perfectCvFormat.mjs'
import { buildCvContextDocuments, collectCvTechEvidence, resolveCvProjectsByAssignmentIds } from './cvProjectScope.js'

export const SWINBURNE_INSTITUTION = 'Swinburne University of Technology'

export { formatPhoneForCv, PHONE_PLACEHOLDER }

export function resolveStudentEducation(user) {
  return {
    campus: user?.campus ?? null,
    institution: SWINBURNE_INSTITUTION,
    majorTitle: user?.childMajor?.title ?? null,
  }
}

export async function loadStudentCvContext(prisma, userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      childMajor: true,
      cvProfile: true,
    },
  })
}

export function aggregateCvSkills(projects = []) {
  const tools = new Set()
  const roles = new Set()

  for (const project of projects) {
    const submission = project.submission ?? {}
    const evidence = collectCvTechEvidence({
      filePaths: Array.isArray(submission.filePaths) ? submission.filePaths : [],
      githubText: '',
      submissionText: String(submission.body ?? ''),
    })

    if (evidence.role && evidence.role !== 'General') {
      roles.add(evidence.role)
    }

    for (const item of evidence.tools) {
      tools.add(item)
    }
  }

  return {
    roles: [...roles],
    tools: [...tools],
  }
}

export function buildPerfectCvHeader(user, cvProfile, education) {
  return [
    buildPerfectCvHeaderBlock(user, cvProfile),
    '',
    buildContactBlock({ email: user?.email ?? '', phone: cvProfile?.phone }),
    '',
    buildEducationBlock(education),
  ].join('\n')
}

export function buildPerfectCvSkillsSection(skills = { tools: [], roles: [] }) {
  return `\n${buildSkillsBlock(skills)}`
}

export function buildPerfectCvCertificationsSection(cvProfile) {
  const raw = String(cvProfile?.certifications ?? '').trim()
  const lines = ['', '## Certifications', '']

  if (!raw) {
    lines.push(`- ${CERT_PLACEHOLDER}`)
    return lines.join('\n')
  }

  for (const entry of raw.split('\n').map((line) => line.trim()).filter(Boolean)) {
    lines.push(`- ${entry}`)
  }

  return lines.join('\n')
}

export function buildPerfectCvContextDocument({
  user,
  cvProfile,
  education,
  skills,
  projectTitles = [],
}) {
  const certifications = String(cvProfile?.certifications ?? '').trim() || CERT_PLACEHOLDER
  const headlineRole = String(cvProfile?.headlineRole ?? '').trim()

  return {
    id: 'perfect-cv-profile',
    source: 'perfect_cv_profile',
    text: [
      'Perfect CV profile (do not invent or change):',
      `Name: ${user?.fullName ?? user?.displayName ?? 'Student'}`,
      headlineRole ? `Headline role: ${headlineRole}` : null,
      `Email: ${user?.email ?? ''}`,
      `Phone: ${formatPhoneForCv(cvProfile?.phone)}`,
      `Education: ${education.institution}${education.majorTitle ? ` — ${education.majorTitle}` : ''}`,
      education.campus ? `Campus: ${campusLabels[education.campus] ?? education.campus}` : null,
      `Technical skills: ${skills.tools.join(', ') || '[none yet]'}`,
      `Certifications: ${certifications}`,
      `Projects to include (in order): ${projectTitles.join('; ') || '[none]'}`,
      'Output only the ## Professional Experience section. Do not repeat header, contact, education, skills, or certifications.',
    ]
      .filter(Boolean)
      .join('\n'),
  }
}

export function assemblePerfectCvMarkdown({ header, skills, experience, certifications }) {
  const experienceSection = String(experience ?? '').trim()

  return [header, buildPerfectCvSkillsSection(skills), '', experienceSection, certifications]
    .filter((section) => String(section ?? '').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function extractExperienceSection(markdown) {
  const text = String(markdown ?? '').trim()

  if (!text) {
    return ''
  }

  const professionalMatch = text.match(/##\s*Professional Experience\b([\s\S]*)/i)

  if (professionalMatch) {
    return `## Professional Experience${professionalMatch[1]}`.trim()
  }

  const legacyMatch = text.match(/##\s*Experience\b([\s\S]*)/i)

  if (legacyMatch) {
    return `## Professional Experience${legacyMatch[1]}`.trim()
  }

  return `## Professional Experience\n\n${text}`.trim()
}

export async function preparePerfectCvTurn({
  assignmentIds = [],
  loadOfferingKnowledge,
  offeringIds = [],
  prisma,
  studentId,
}) {
  const normalizedIds = [...new Set(assignmentIds.map((id) => String(id).trim()).filter(Boolean))]

  if (normalizedIds.length === 0) {
    return {
      assistantText:
        'Select at least one submitted project for your Perfect CV, then try again.',
      status: 'missing_assignments',
    }
  }

  const user = await loadStudentCvContext(prisma, studentId)

  if (!user) {
    return { status: 'missing_user' }
  }

  const offerings = (
    await Promise.all(offeringIds.map((offeringId) => loadOfferingKnowledge(prisma, offeringId)))
  ).filter(Boolean)

  const resolution = await resolveCvProjectsByAssignmentIds({
    assignmentIds: normalizedIds,
    offerings,
    prisma,
    studentId,
  })

  if (resolution.status !== 'ready') {
    return {
      assistantText: resolution.assistantText,
      resolution,
      status: resolution.status,
    }
  }

  const education = resolveStudentEducation(user)
  const cvProfile = user.cvProfile ?? { phone: null, headlineRole: null, certifications: null }
  const skills = aggregateCvSkills(resolution.projects)
  const header = buildPerfectCvHeader(user, cvProfile, education)
  const certifications = buildPerfectCvCertificationsSection(cvProfile)
  const projectTitles = resolution.projects.map((project) => project.assignment.title)
  const documents = [
    buildPerfectCvContextDocument({
      cvProfile,
      education,
      projectTitles,
      skills,
      user,
    }),
  ]

  const offeringIdsUsed = [
    ...new Set(resolution.projects.map((project) => project.assignment.offeringId)),
  ]

  for (const offeringId of offeringIdsUsed) {
    const offering = offerings.find((entry) => entry.id === offeringId)

    if (!offering) {
      continue
    }

    const projects = resolution.projects.filter((project) => project.assignment.offeringId === offeringId)

    documents.push(
      ...(await buildCvContextDocuments({
        offering,
        projects,
      })),
    )
  }

  return {
    assignmentIds: resolution.projects.map((project) => project.assignment.id),
    certifications,
    cvProfile: {
      certifications: cvProfile.certifications ?? null,
      headline_role: cvProfile.headlineRole ?? null,
      phone: cvProfile.phone ?? null,
    },
    documents,
    education: {
      campus: education.campus,
      institution: education.institution,
      majorTitle: education.majorTitle,
    },
    header,
    resolution,
    skills,
    status: 'ready',
  }
}

export function finalizePerfectCvResponse(experienceMarkdown, perfectCvTurn) {
  const experience = extractExperienceSection(experienceMarkdown)

  return assemblePerfectCvMarkdown({
    certifications: perfectCvTurn.certifications,
    experience,
    header: perfectCvTurn.header,
    skills: perfectCvTurn.skills,
  })
}
