import { useEffect, useMemo, useState } from 'react'

import { fetchSubmittedProjects, getErrorMessage } from '../../lib/workspace/api'
import type { SubmittedProjectCourseRow } from '../../lib/workspace/types'

type PerfectCvProjectPickerProps = {
  onClose: () => void
  onConfirm: (assignmentIds: string[]) => void
}

export function PerfectCvProjectPicker({ onClose, onConfirm }: PerfectCvProjectPickerProps) {
  const [courses, setCourses] = useState<SubmittedProjectCourseRow[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const loadProjects = async () => {
      setLoading(true)
      setError('')

      try {
        const data = await fetchSubmittedProjects()

        if (!cancelled) {
          setCourses(data.courses)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(getErrorMessage(loadError, 'Could not load submitted projects'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadProjects()

    return () => {
      cancelled = true
    }
  }, [])

  const totalAssignments = useMemo(
    () => courses.reduce((count, course) => count + course.assignments.length, 0),
    [courses],
  )

  const toggleAssignment = (assignmentId: string) => {
    setSelectedIds((current) =>
      current.includes(assignmentId)
        ? current.filter((id) => id !== assignmentId)
        : [...current, assignmentId],
    )
  }

  return (
    <div className="swinlearn-modal-backdrop" onClick={onClose}>
      <div
        className="swinlearn-modal swinlearn-perfect-cv-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby="perfect-cv-picker-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="swinlearn-modal-header">
          <h2 id="perfect-cv-picker-title">Choose projects for Perfect CV</h2>
        </header>

        {loading ? (
          <p className="swinlearn-perfect-cv-picker-status">Loading submitted projects...</p>
        ) : error ? (
          <p className="swinlearn-perfect-cv-picker-error">{error}</p>
        ) : totalAssignments === 0 ? (
          <p className="swinlearn-perfect-cv-picker-status">
            No submitted assignments yet. Submit course work first, then return here.
          </p>
        ) : (
          <div className="swinlearn-perfect-cv-picker-list">
            {courses.map((course) => (
              <section className="swinlearn-perfect-cv-picker-course" key={course.offering_id}>
                <h3>
                  {course.course_code} — {course.course_title}
                </h3>
                <ul>
                  {course.assignments.map((assignment) => (
                    <li key={assignment.assignment_id}>
                      <label>
                        <input
                          checked={selectedIds.includes(assignment.assignment_id)}
                          onChange={() => toggleAssignment(assignment.assignment_id)}
                          type="checkbox"
                        />
                        <span>{assignment.title}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        <div className="swinlearn-modal-actions">
          <button className="clear-btn" onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className="clear-btn"
            disabled={selectedIds.length === 0}
            onClick={() => onConfirm(selectedIds)}
            type="button"
          >
            Build Perfect CV ({selectedIds.length})
          </button>
        </div>
      </div>
    </div>
  )
}
