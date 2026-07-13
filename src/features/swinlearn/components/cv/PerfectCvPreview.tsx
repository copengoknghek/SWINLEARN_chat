import { useMemo } from 'react'

import { parsePerfectCvMarkdown } from '../../lib/perfectCvFormat.mjs'

type PerfectCvPreviewProps = {
  content: string
}

function ExperienceContent({ experience }: { experience: string }) {
  const lines = String(experience ?? '').split('\n')

  return (
    <div className="perfect-cv-preview-experience">
      {lines.map((line, index) => {
        const trimmed = line.trimEnd()

        if (!trimmed) {
          return null
        }

        if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
          return (
            <p className="perfect-cv-preview-project-title" key={`${index}-${trimmed}`}>
              {trimmed.slice(2, -2)}
            </p>
          )
        }

        if (trimmed.startsWith('## ')) {
          return null
        }

        return (
          <p className="perfect-cv-preview-bullet" key={`${index}-${trimmed}`}>
            {trimmed}
          </p>
        )
      })}
    </div>
  )
}

export function PerfectCvPreview({ content }: PerfectCvPreviewProps) {
  const parsed = useMemo(() => parsePerfectCvMarkdown(content), [content])

  return (
    <article className="perfect-cv-preview" aria-label="Perfect CV preview">
      <header className="perfect-cv-preview-header">
        <h3 className="perfect-cv-preview-name">{parsed.name}</h3>
        {parsed.headlineRole ? (
          <p className="perfect-cv-preview-role">{parsed.headlineRole}</p>
        ) : null}
      </header>

      <section className="perfect-cv-preview-section perfect-cv-preview-section--contact">
        <h4 className="perfect-cv-preview-label">Contact</h4>
        <div className="perfect-cv-preview-contact-grid">
          <div>
            <p>Phone: {parsed.contact.phone}</p>
            <p>Email : {parsed.contact.email}</p>
          </div>
          <div>
            <p>Native language: {parsed.contact.nativeLanguage}</p>
            <p>Foreign language: {parsed.contact.foreignLanguage}</p>
          </div>
        </div>
      </section>

      <section className="perfect-cv-preview-section">
        <h4 className="perfect-cv-preview-label">Education</h4>
        <div className="perfect-cv-preview-content">
          <p className="perfect-cv-preview-institution">{parsed.education.institution}</p>
          {parsed.education.majorTitle ? <p>{parsed.education.majorTitle}</p> : null}
          {parsed.education.campus ? <p>Campus: {parsed.education.campus}</p> : null}
          {parsed.education.description ? <p>{parsed.education.description}</p> : null}
        </div>
      </section>

      <section className="perfect-cv-preview-section">
        <h4 className="perfect-cv-preview-label">Skills</h4>
        <div className="perfect-cv-preview-content">
          <p>
            <strong>Technical Skills:</strong>{' '}
            {parsed.skills.technicalSkills || '[Add skills]'}
          </p>
        </div>
      </section>

      {parsed.experience ? (
        <section className="perfect-cv-preview-section">
          <h4 className="perfect-cv-preview-label">Professional Experience</h4>
          <div className="perfect-cv-preview-content">
            <ExperienceContent experience={parsed.experience} />
          </div>
        </section>
      ) : null}

      {parsed.certifications.length > 0 ? (
        <section className="perfect-cv-preview-section">
          <h4 className="perfect-cv-preview-label">Certifications</h4>
          <div className="perfect-cv-preview-content">
            <ul className="perfect-cv-preview-cert-list">
              {parsed.certifications.map((entry) => (
                <li key={entry}>{entry}</li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </article>
  )
}
