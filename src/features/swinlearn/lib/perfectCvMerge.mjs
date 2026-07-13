import {
  buildSkillsBlock,
  parsePerfectCvMarkdown,
  serializePerfectCvMarkdown,
} from './perfectCvFormat.mjs'

const SKILLS_SECTION_PATTERN = /## Skills[\s\S]*?(?=\n## |$)/
const CERTIFICATIONS_SECTION_PATTERN = /## Certifications[\s\S]*$/

export function formatSkillsSection(skills = { tools: [] }) {
  return `${buildSkillsBlock(skills)}\n`
}

export function formatCertificationsSection(certifications = '') {
  const entries = String(certifications ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (entries.length === 0) {
    return '## Certifications\n\n- [Add certification]'
  }

  return `## Certifications\n\n${entries.map((entry) => `- ${entry}`).join('\n')}`
}

export function parseSkillsOverride(text = '') {
  const tools = String(text ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  return { roles: [], tools }
}

function replaceHeaderAndContact(markdown, { phone, email, headlineRole, name }) {
  const parsed = parsePerfectCvMarkdown(markdown)

  return serializePerfectCvMarkdown({
    ...parsed,
    contact: {
      ...parsed.contact,
      email: email ?? parsed.contact.email,
      phone: phone !== undefined ? String(phone).trim() || '[Phone number]' : parsed.contact.phone,
    },
    headlineRole: headlineRole !== undefined ? String(headlineRole).trim() : parsed.headlineRole,
    name: name ?? parsed.name,
  })
}

export function mergePerfectCvMarkdown(
  markdown,
  { phone, certifications, headlineRole, skillsOverride } = {},
) {
  let result = String(markdown ?? '')

  if (phone !== undefined || headlineRole !== undefined) {
    const parsed = parsePerfectCvMarkdown(result)
    const trimmedPhone =
      phone !== undefined ? String(phone).trim() || '[Phone number]' : parsed.contact.phone

    result = replaceHeaderAndContact(result, {
      email: parsed.contact.email,
      headlineRole: headlineRole !== undefined ? String(headlineRole).trim() : parsed.headlineRole,
      name: parsed.name,
      phone: trimmedPhone,
    })
  }

  if (skillsOverride !== undefined) {
    const skills = parseSkillsOverride(skillsOverride)
    const skillsMatch = result.match(SKILLS_SECTION_PATTERN)

    if (skillsMatch) {
      result = result.replace(SKILLS_SECTION_PATTERN, formatSkillsSection(skills))
    }
  }

  if (certifications !== undefined) {
    result = result.replace(CERTIFICATIONS_SECTION_PATTERN, formatCertificationsSection(certifications))
  }

  return result.trim()
}
