import assert from 'node:assert/strict'
import test from 'node:test'

import {
  aggregateCvSkills,
  assemblePerfectCvMarkdown,
  buildPerfectCvCertificationsSection,
  buildPerfectCvHeader,
  buildPerfectCvSkillsSection,
  extractExperienceSection,
  finalizePerfectCvResponse,
  formatPhoneForCv,
  resolveStudentEducation,
  SWINBURNE_INSTITUTION,
} from './perfectCv.js'

const user = {
  fullName: 'Jane Student',
  email: 'jane@student.swin.edu.au',
  campus: 'hanoi',
  childMajor: { title: 'Software Development' },
}

test('resolveStudentEducation uses institution and child major', () => {
  const education = resolveStudentEducation(user)

  assert.equal(education.institution, SWINBURNE_INSTITUTION)
  assert.equal(education.majorTitle, 'Software Development')
  assert.equal(education.campus, 'hanoi')
})

test('formatPhoneForCv uses placeholder when empty', () => {
  assert.equal(formatPhoneForCv(null), '[Phone number]')
  assert.equal(formatPhoneForCv('+84 912 345 678'), '+84 912 345 678')
})

test('buildPerfectCvHeader includes labeled contact and education', () => {
  const header = buildPerfectCvHeader(
    user,
    { phone: '+84 912 345 678', headlineRole: 'Software Engineer Intern' },
    resolveStudentEducation(user),
  )

  assert.match(header, /# Jane Student/)
  assert.match(header, /Software Engineer Intern/)
  assert.match(header, /## Contact/)
  assert.match(header, /Phone: \+84 912 345 678/)
  assert.match(header, /Email : jane@student\.swin\.edu\.au/)
  assert.match(header, /Native language: Vietnamese/)
  assert.match(header, /SWINBURNE UNIVERSITY OF TECHNOLOGY/)
  assert.match(header, /Software Development/)
  assert.match(header, /Campus: Hanoi/)
  assert.match(header, /Final-year Software Development student/)
})

test('buildPerfectCvSkillsSection uses technical skills label', () => {
  const section = buildPerfectCvSkillsSection({
    tools: ['vue', 'express'],
    roles: ['Full Stack'],
  })

  assert.match(section, /Technical Skills: vue, express/)
  assert.doesNotMatch(section, /Roles:/)
})

test('buildPerfectCvCertificationsSection uses placeholder when empty', () => {
  const section = buildPerfectCvCertificationsSection({ certifications: null })

  assert.match(section, /\[Add certification\]/)
})

test('buildPerfectCvCertificationsSection formats saved entries', () => {
  const section = buildPerfectCvCertificationsSection({
    certifications: 'AWS Cloud Practitioner\nGoogle Data Analytics',
  })

  assert.match(section, /- AWS Cloud Practitioner/)
  assert.match(section, /- Google Data Analytics/)
})

test('aggregateCvSkills dedupes evidence across projects', () => {
  const skills = aggregateCvSkills([
    {
      submission: {
        body: 'Built with vue and express',
        filePaths: [],
      },
    },
    {
      submission: {
        body: 'Used prisma and express API',
        filePaths: [],
      },
    },
  ])

  assert.ok(skills.tools.includes('vue'))
  assert.ok(skills.tools.includes('express'))
  assert.ok(skills.tools.includes('prisma'))
  assert.ok(skills.roles.includes('Full Stack'))
})

test('assemblePerfectCvMarkdown joins sections', () => {
  const markdown = assemblePerfectCvMarkdown({
    certifications: '\n## Certifications\n\n- AWS',
    experience: '## Professional Experience\n\n**Demo Project**\n\n• Built API',
    header:
      '# Jane\n\n## Contact\n\nPhone: [Phone number]\nEmail : jane@test.com\nNative language: Vietnamese\nForeign language:\n\n## Education\n\n**SWINBURNE UNIVERSITY OF TECHNOLOGY**',
    skills: { roles: ['Backend'], tools: ['express'] },
  })

  assert.match(markdown, /# Jane/)
  assert.match(markdown, /## Skills/)
  assert.match(markdown, /## Professional Experience/)
  assert.match(markdown, /## Certifications/)
})

test('extractExperienceSection normalizes legacy Experience heading', () => {
  const experience = extractExperienceSection(
    '# Name\n\n## Experience\n\n**Project**\n\n• Did work',
  )

  assert.match(experience, /^## Professional Experience/)
  assert.match(experience, /\*\*Project\*\*/)
})

test('extractExperienceSection keeps Professional Experience heading', () => {
  const experience = extractExperienceSection(
    '# Name\n\n## Professional Experience\n\n**Project**\n\n• Did work',
  )

  assert.match(experience, /^## Professional Experience/)
})

test('finalizePerfectCvResponse assembles groq experience into full cv', () => {
  const full = finalizePerfectCvResponse('## Professional Experience\n\n**App**\n\n• Built UI', {
    certifications: '\n## Certifications\n\n- [Add certification]',
    header:
      '# Jane\n\n## Contact\n\nPhone: [Phone number]\nEmail : jane@test.com\nNative language: Vietnamese\nForeign language:\n\n## Education\n\n**SWINBURNE UNIVERSITY OF TECHNOLOGY**',
    skills: { roles: [], tools: ['react'] },
  })

  assert.match(full, /# Jane/)
  assert.match(full, /Email : jane@test.com/)
  assert.match(full, /react/)
  assert.match(full, /## Professional Experience/)
  assert.match(full, /## Certifications/)
})
