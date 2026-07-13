import assert from 'node:assert/strict'
import test from 'node:test'

import { formatSkillsSection, mergePerfectCvMarkdown } from './perfectCvMerge.mjs'

const sampleCv = `# Jane Student
Software Engineer Intern

## Contact

Phone: [Phone number]
Email : jane@test.com
Native language: Vietnamese
Foreign language:

## Education

**SWINBURNE UNIVERSITY OF TECHNOLOGY**
Software Development

## Skills

Technical Skills: vue, express
**Roles:** Full Stack

## Professional Experience

**Demo Project**

• Built API

## Certifications

- [Add certification]`

test('mergePerfectCvMarkdown updates phone headline role certifications and skills', () => {
  const merged = mergePerfectCvMarkdown(sampleCv, {
    certifications: 'AWS Cloud Practitioner',
    headlineRole: 'AI Engineer Intern',
    phone: '+84 912 345 678',
    skillsOverride: 'vue, express, prisma',
  })

  assert.match(merged, /Phone: \+84 912 345 678/)
  assert.match(merged, /Email : jane@test\.com/)
  assert.match(merged, /AI Engineer Intern/)
  assert.match(merged, /prisma/)
  assert.match(merged, /AWS Cloud Practitioner/)
  assert.match(merged, /## Professional Experience/)
})

test('formatSkillsSection renders technical skills label', () => {
  const section = formatSkillsSection({ tools: ['node'] })

  assert.match(section, /Technical Skills: node/)
})
