export const PHONE_PLACEHOLDER = '[Phone number]'
export const SKILLS_PLACEHOLDER = '[Add skills]'
export const CERT_PLACEHOLDER = '[Add certification]'
export const NATIVE_LANGUAGE = 'Vietnamese'
export const CONTACT_PURPLE = '#6B21A8'

export const campusLabels = {
  hanoi: 'Hanoi',
  danang: 'Da Nang',
  hcm: 'Ho Chi Minh City',
}

export function formatPhoneForCv(phone) {
  const value = String(phone ?? '').trim()

  return value || PHONE_PLACEHOLDER
}

export function buildEducationDescription({ institution, majorTitle }) {
  if (!majorTitle) {
    return `Student at ${institution}.`
  }

  return `Final-year ${majorTitle} student at ${institution}.`
}

export function buildContactBlock({ phone, email }) {
  return [
    '## Contact',
    '',
    `Phone: ${formatPhoneForCv(phone)}`,
    `Email : ${String(email ?? '').trim()}`,
    `Native language: ${NATIVE_LANGUAGE}`,
    'Foreign language:',
  ].join('\n')
}

export function buildEducationBlock(education = {}) {
  const institution = String(education.institution ?? 'Swinburne University of Technology').trim()
  const majorTitle = String(education.majorTitle ?? '').trim()
  const campusKey = education.campus
  const campusLabel = campusKey ? campusLabels[campusKey] ?? campusKey : null
  const lines = ['## Education', '', `**${institution.toUpperCase()}**`]

  if (majorTitle) {
    lines.push(majorTitle)
  }

  if (campusLabel) {
    lines.push(`Campus: ${campusLabel}`)
  }

  lines.push(buildEducationDescription({ institution, majorTitle }))

  return lines.join('\n')
}

export function buildSkillsBlock(skills = { tools: [] }) {
  const tools = Array.isArray(skills.tools) ? skills.tools.filter(Boolean) : []
  const value = tools.length > 0 ? tools.join(', ') : SKILLS_PLACEHOLDER

  return ['## Skills', '', `Technical Skills: ${value}`].join('\n')
}

export function buildPerfectCvHeaderBlock(user, cvProfile) {
  const name = String(user?.fullName ?? user?.displayName ?? 'Student').trim()
  const headlineRole = String(cvProfile?.headlineRole ?? cvProfile?.headline_role ?? '').trim()
  const lines = [`# ${name}`]

  if (headlineRole) {
    lines.push('', headlineRole)
  }

  return lines.join('\n')
}

export function buildPerfectCvTopSections(user, cvProfile, education) {
  const email = String(user?.email ?? '').trim()

  return [
    buildPerfectCvHeaderBlock(user, cvProfile),
    '',
    buildContactBlock({ email, phone: cvProfile?.phone }),
    '',
    buildEducationBlock(education),
  ].join('\n')
}

const SECTION_PATTERN =
  /^##\s+(Contact|Education|Skills|Professional Experience|Experience|Certifications)\s*$/gim

function splitSections(markdown) {
  const text = String(markdown ?? '').trim()
  const sections = new Map()
  const matches = [...text.matchAll(SECTION_PATTERN)]

  if (matches.length === 0) {
    return { preamble: text, sections }
  }

  const preambleEnd = matches[0].index ?? 0
  const preamble = text.slice(0, preambleEnd).trim()

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index]
    const title = match[1]
    const start = (match.index ?? 0) + match[0].length
    const end = index + 1 < matches.length ? matches[index + 1].index : text.length
    const body = text.slice(start, end).trim()
    const key = title.toLowerCase().replace(/\s+/g, '_')

    sections.set(key, body)
  }

  return { preamble, sections }
}

function parsePreamble(preamble) {
  const lines = String(preamble ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line, index, all) => line !== '' || (index > 0 && all[index - 1] !== ''))

  let name = ''
  let headlineRole = ''

  if (lines[0]?.startsWith('# ')) {
    name = lines[0].slice(2).trim()
  }

  const legacyContact = lines.find((line) => /\S+@\S+\s*\|/.test(line))

  if (legacyContact) {
    const [emailPart, phonePart] = legacyContact.split('|').map((part) => part.trim())

    return {
      contact: {
        email: emailPart ?? '',
        foreignLanguage: '',
        nativeLanguage: NATIVE_LANGUAGE,
        phone: phonePart || PHONE_PLACEHOLDER,
      },
      headlineRole: '',
      name,
    }
  }

  const nonTitleLines = lines.slice(1).filter((line) => !line.startsWith('#'))

  if (nonTitleLines[0] && !nonTitleLines[0].startsWith('##')) {
    headlineRole = nonTitleLines[0]
  }

  return { contact: null, headlineRole, name }
}

function parseContactBody(body) {
  if (!body) {
    return {
      email: '',
      foreignLanguage: '',
      nativeLanguage: NATIVE_LANGUAGE,
      phone: PHONE_PLACEHOLDER,
    }
  }

  const phone = body.match(/^Phone:\s*(.+)$/im)?.[1]?.trim() || PHONE_PLACEHOLDER
  const email = body.match(/^Email\s*:\s*(.+)$/im)?.[1]?.trim() || ''
  const nativeLanguage = body.match(/^Native language:\s*(.+)$/im)?.[1]?.trim() || NATIVE_LANGUAGE
  const foreignLanguage = body.match(/^Foreign language:\s*(.*)$/im)?.[1]?.trim() || ''

  return { email, foreignLanguage, nativeLanguage, phone }
}

function parseEducationBody(body) {
  const lines = String(body ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const institution = (lines[0]?.replace(/^\*\*|\*\*$/g, '') ?? '').trim()
  const majorTitle = lines.find((line) => !line.startsWith('**') && !line.startsWith('Campus:') && !line.startsWith('Final-')) ?? ''
  const campus = lines.find((line) => line.startsWith('Campus:'))?.replace(/^Campus:\s*/, '') ?? ''
  const description = lines.find((line) => line.startsWith('Final-')) ?? ''

  return { campus, description, institution, lines, majorTitle }
}

function parseSkillsBody(body) {
  const text = String(body ?? '')
  const technicalSkills =
    text.match(/^Technical Skills:\s*(.+)$/im)?.[1]?.trim() ||
    text.match(/^\*\*Tools & Technologies:\*\*\s*(.+)$/im)?.[1]?.trim() ||
    ''

  return { technicalSkills }
}

function parseCertificationsBody(body) {
  return String(body ?? '')
    .split('\n')
    .map((line) => line.replace(/^[-•]\s*/, '').trim())
    .filter(Boolean)
}

export function parsePerfectCvMarkdown(markdown) {
  const { preamble, sections } = splitSections(markdown)
  const parsedPreamble = parsePreamble(preamble)
  const contact = parsedPreamble.contact ?? parseContactBody(sections.get('contact'))
  const education = parseEducationBody(sections.get('education'))
  const skills = parseSkillsBody(sections.get('skills'))
  const experience = sections.get('professional_experience') ?? sections.get('experience') ?? ''
  const certifications = parseCertificationsBody(sections.get('certifications'))

  return {
    certifications,
    contact,
    education,
    experience,
    headlineRole: parsedPreamble.headlineRole,
    name: parsedPreamble.name,
    skills,
  }
}

export function serializePerfectCvMarkdown(parsed) {
  const sections = [
    `# ${parsed.name}`,
    parsed.headlineRole ? `\n${parsed.headlineRole}` : '',
    '',
    buildContactBlock(parsed.contact),
    '',
    buildEducationBlock({
      campus: parsed.education.campus
        ? Object.entries(campusLabels).find(([, label]) => label === parsed.education.campus)?.[0] ??
          parsed.education.campus
        : null,
      institution: parsed.education.institution,
      majorTitle: parsed.education.majorTitle,
    }),
    '',
    buildSkillsBlock({ tools: parsed.skills.technicalSkills ? parsed.skills.technicalSkills.split(',').map((item) => item.trim()).filter(Boolean) : [] }),
  ]

  if (parsed.experience) {
    sections.push('', `## Professional Experience`, '', parsed.experience)
  }

  if (parsed.certifications.length > 0) {
    sections.push(
      '',
      '## Certifications',
      '',
      ...parsed.certifications.map((entry) => `- ${entry}`),
    )
  }

  return sections.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

const escapeHtml = (text) =>
  String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

function wordSectionRow(label, contentHtml, { purpleDivider = false } = {}) {
  const border = purpleDivider
    ? `border-bottom:3pt solid ${CONTACT_PURPLE};`
    : 'border-bottom:1pt solid #111111;'

  return `<tr>
    <td style="width:22%;vertical-align:top;padding:10pt 12pt 10pt 0;font-family:Calibri;font-size:10pt;font-weight:bold;text-transform:uppercase;">${escapeHtml(label)}</td>
    <td style="vertical-align:top;padding:10pt 0;${border}font-family:Calibri;font-size:11pt;">${contentHtml}</td>
  </tr>`
}

function wordExperienceHtml(experience) {
  const lines = String(experience ?? '').split('\n')
  const chunks = []

  for (const line of lines) {
    const trimmed = line.trimEnd()

    if (!trimmed) {
      continue
    }

    if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
      chunks.push(
        `<p style="font-family:Calibri;font-size:12pt;font-weight:bold;margin:10pt 0 4pt;">${escapeHtml(trimmed.slice(2, -2))}</p>`,
      )
      continue
    }

    if (/^[•-]\s/.test(trimmed)) {
      chunks.push(
        `<p style="font-family:Calibri;font-size:11pt;margin:0 0 4pt 14pt;">${escapeHtml(trimmed)}</p>`,
      )
      continue
    }

    chunks.push(`<p style="font-family:Calibri;font-size:11pt;margin:0 0 6pt;">${escapeHtml(trimmed)}</p>`)
  }

  return chunks.join('')
}

export function perfectCvMarkdownToWordHtml(parsed) {
  const header = `<table style="width:100%;border-collapse:collapse;margin-bottom:8pt;">
    <tr>
      <td style="font-family:Calibri;font-size:24pt;font-weight:bold;text-transform:uppercase;">${escapeHtml(parsed.name)}</td>
      <td style="font-family:Calibri;font-size:11pt;font-weight:bold;text-transform:uppercase;text-align:right;vertical-align:bottom;">${escapeHtml(parsed.headlineRole)}</td>
    </tr>
  </table>`

  const contactHtml = `<table style="width:100%;border-collapse:collapse;">
    <tr>
      <td style="width:50%;padding-right:12pt;vertical-align:top;">
        <p style="margin:0 0 4pt;">Phone: ${escapeHtml(parsed.contact.phone)}</p>
        <p style="margin:0;">Email : ${escapeHtml(parsed.contact.email)}</p>
      </td>
      <td style="width:50%;vertical-align:top;">
        <p style="margin:0 0 4pt;">Native language: ${escapeHtml(parsed.contact.nativeLanguage)}</p>
        <p style="margin:0;">Foreign language: ${escapeHtml(parsed.contact.foreignLanguage)}</p>
      </td>
    </tr>
  </table>`

  const educationHtml = [
    `<p style="font-weight:bold;text-transform:uppercase;margin:0 0 4pt;">${escapeHtml(parsed.education.institution)}</p>`,
    parsed.education.majorTitle
      ? `<p style="margin:0 0 4pt;">${escapeHtml(parsed.education.majorTitle)}</p>`
      : '',
    parsed.education.campus ? `<p style="margin:0 0 4pt;">Campus: ${escapeHtml(parsed.education.campus)}</p>` : '',
    parsed.education.description
      ? `<p style="margin:0;">${escapeHtml(parsed.education.description)}</p>`
      : '',
  ].join('')

  const skillsHtml = `<p style="margin:0;"><strong>Technical Skills:</strong> ${escapeHtml(parsed.skills.technicalSkills || SKILLS_PLACEHOLDER)}</p>`

  const bodyRows = [
    wordSectionRow('Contact', contactHtml, { purpleDivider: true }),
    wordSectionRow('Education', educationHtml),
    wordSectionRow('Skills', skillsHtml),
    wordSectionRow('Professional Experience', wordExperienceHtml(parsed.experience)),
  ]

  if (parsed.certifications.length > 0) {
    bodyRows.push(
      wordSectionRow(
        'Certifications',
        parsed.certifications
          .map(
            (entry) =>
              `<p style="margin:0 0 4pt;">${escapeHtml(`- ${entry}`)}</p>`,
          )
          .join(''),
      ),
    )
  }

  const sections = `<table style="width:100%;border-collapse:collapse;">${bodyRows.join('')}</table>`

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>SWINLEARN CV</title></head><body>${header}${sections}</body></html>`
}

export function perfectCvMarkdownToWordHtmlFromMarkdown(markdown) {
  return perfectCvMarkdownToWordHtml(parsePerfectCvMarkdown(markdown))
}
