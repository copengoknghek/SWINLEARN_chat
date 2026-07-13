import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildContactBlock,
  parsePerfectCvMarkdown,
  perfectCvMarkdownToWordHtml,
  perfectCvMarkdownToWordHtmlFromMarkdown,
  serializePerfectCvMarkdown,
} from './perfectCvFormat.mjs'

const sampleCv = `# Vo Thi Kim Huyen
AI ENGINEER INTERN

## Contact

Phone: 0123456789
Email : huyen@student.swin.edu.au
Native language: Vietnamese
Foreign language:

## Education

**SWINBURNE UNIVERSITY OF TECHNOLOGY**
Artificial Intelligence
Campus: Da Nang
Final-year Artificial Intelligence student at Swinburne University of Technology.

## Skills

Technical Skills: Vue 3, Vite, Bootstrap

## Professional Experience

**Assignment 1**
Role: Full Stack | Technologies: Vue 3, Vite
GitHub: https://github.com/example/project

• Developed a Vue 3 application using Vite.

## Certifications

- Duolingo English Test 95 point.`

test('buildContactBlock uses Email : label and Vietnamese native language', () => {
  const block = buildContactBlock({ email: 'test@swin.edu.au', phone: '0123' })

  assert.match(block, /Email : test@swin\.edu\.au/)
  assert.match(block, /Phone: 0123/)
  assert.match(block, /Native language: Vietnamese/)
})

test('parsePerfectCvMarkdown reads structured sections', () => {
  const parsed = parsePerfectCvMarkdown(sampleCv)

  assert.equal(parsed.name, 'Vo Thi Kim Huyen')
  assert.equal(parsed.headlineRole, 'AI ENGINEER INTERN')
  assert.equal(parsed.contact.email, 'huyen@student.swin.edu.au')
  assert.equal(parsed.education.majorTitle, 'Artificial Intelligence')
  assert.match(parsed.skills.technicalSkills, /Vue 3/)
  assert.match(parsed.experience, /Assignment 1/)
  assert.equal(parsed.certifications.length, 1)
})

test('parsePerfectCvMarkdown supports legacy email | phone line', () => {
  const parsed = parsePerfectCvMarkdown(`# Jane Student

jane@test.com | +84 912 345 678

## Education

**Swinburne University of Technology**`)

  assert.equal(parsed.name, 'Jane Student')
  assert.equal(parsed.contact.email, 'jane@test.com')
  assert.equal(parsed.contact.phone, '+84 912 345 678')
})

test('serializePerfectCvMarkdown round-trips key fields', () => {
  const parsed = parsePerfectCvMarkdown(sampleCv)
  const serialized = serializePerfectCvMarkdown({
    ...parsed,
    contact: { ...parsed.contact, phone: '0999888777' },
    headlineRole: 'FULL STACK INTERN',
  })

  assert.match(serialized, /Email : huyen@student\.swin\.edu\.au/)
  assert.match(serialized, /Phone: 0999888777/)
  assert.match(serialized, /FULL STACK INTERN/)
  assert.match(serialized, /## Professional Experience/)
})

test('perfectCvMarkdownToWordHtml includes large name and purple contact divider', () => {
  const parsed = parsePerfectCvMarkdown(sampleCv)
  const html = perfectCvMarkdownToWordHtml(parsed)

  assert.match(html, /Vo Thi Kim Huyen/)
  assert.match(html, /font-size:24pt/)
  assert.match(html, /#6B21A8/)
  assert.match(html, /Email : huyen@student\.swin\.edu\.au/)
})

test('perfectCvMarkdownToWordHtmlFromMarkdown wraps parser', () => {
  const html = perfectCvMarkdownToWordHtmlFromMarkdown(sampleCv)

  assert.match(html, /Professional Experience/)
  assert.match(html, /Assignment 1/)
})
