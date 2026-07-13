import { useMemo, useState } from 'react'

import { PerfectCvPreview } from './PerfectCvPreview'
import { mergePerfectCvMarkdown } from '../../lib/perfectCvMerge.mjs'
import { getErrorMessage, updateCvProfile } from '../../lib/workspace/api'
import type { CvSkillsSnapshot, SwinlearnMessageRow } from '../../lib/workspace/types'

type PerfectCvEditPanelProps = {
  message: SwinlearnMessageRow
  onClose: () => void
  onDownloadMarkdown: (content: string) => void
  onDownloadWord: (content: string) => void
}

const defaultSkillsText = (skills?: CvSkillsSnapshot) =>
  skills?.tools?.length ? skills.tools.join(', ') : ''

export function PerfectCvEditPanel({
  message,
  onClose,
  onDownloadMarkdown,
  onDownloadWord,
}: PerfectCvEditPanelProps) {
  const metadata = message.metadata
  const [phone, setPhone] = useState(metadata?.cvProfile?.phone ?? '')
  const [headlineRole, setHeadlineRole] = useState(metadata?.cvProfile?.headline_role ?? '')
  const [certifications, setCertifications] = useState(metadata?.cvProfile?.certifications ?? '')
  const [skillsOverride, setSkillsOverride] = useState(defaultSkillsText(metadata?.skills))
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const mergedMarkdown = useMemo(
    () =>
      mergePerfectCvMarkdown(message.content, {
        certifications,
        headlineRole,
        phone,
        skillsOverride,
      }),
    [certifications, headlineRole, message.content, phone, skillsOverride],
  )

  const roleChips = metadata?.skills?.roles ?? []

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setNotice('')

    try {
      await updateCvProfile({
        certifications: certifications.trim() || null,
        headline_role: headlineRole.trim() || null,
        phone: phone.trim() || null,
      })
      setNotice('CV profile saved.')
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'Could not save CV profile'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <aside
      className="chat-sidebar export-sidebar swinlearn-perfect-cv-panel"
      aria-label="Perfect CV editor"
    >
      <header className="swinlearn-perfect-cv-panel-header">
        <h2>Perfect CV</h2>
        <button className="panel-btn" onClick={onClose} type="button" aria-label="Close panel">
          ×
        </button>
      </header>

      <div className="swinlearn-perfect-cv-panel-body">
        {notice && <p className="swinlearn-perfect-cv-panel-notice">{notice}</p>}
        {error && <p className="swinlearn-perfect-cv-panel-error">{error}</p>}

        <label className="swinlearn-modal-field">
          <span>Headline role</span>
          <input
            onChange={(event) => setHeadlineRole(event.target.value)}
            placeholder="AI Engineer Intern"
            type="text"
            value={headlineRole}
          />
        </label>

        <label className="swinlearn-modal-field">
          <span>Phone</span>
          <input
            onChange={(event) => setPhone(event.target.value)}
            placeholder="[Phone number]"
            type="text"
            value={phone}
          />
        </label>

        <label className="swinlearn-modal-field">
          <span>Certifications (one per line)</span>
          <textarea
            onChange={(event) => setCertifications(event.target.value)}
            placeholder="AWS Cloud Practitioner"
            rows={4}
            value={certifications}
          />
        </label>

        <label className="swinlearn-modal-field">
          <span>Skills (comma-separated tools)</span>
          <textarea
            onChange={(event) => setSkillsOverride(event.target.value)}
            rows={3}
            value={skillsOverride}
          />
        </label>

        {roleChips.length > 0 && (
          <div className="swinlearn-perfect-cv-role-chips">
            {roleChips.map((role) => (
              <span className="workspace-chip" key={role}>
                {role}
              </span>
            ))}
          </div>
        )}

        <div className="swinlearn-perfect-cv-panel-preview">
          <PerfectCvPreview content={mergedMarkdown} />
        </div>
      </div>

      <div className="swinlearn-perfect-cv-panel-actions">
        <button className="clear-btn" disabled={saving} onClick={() => void handleSave()} type="button">
          {saving ? 'Saving...' : 'Save profile'}
        </button>
        <button className="clear-btn" onClick={() => onDownloadMarkdown(mergedMarkdown)} type="button">
          Download Markdown
        </button>
        <button className="clear-btn" onClick={() => onDownloadWord(mergedMarkdown)} type="button">
          Download Word
        </button>
      </div>
    </aside>
  )
}
