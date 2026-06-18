import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuthContext } from '../../../../context/AuthContext'
import {
  checkRegistrationBasket,
  courseLabel,
  fetchRegistrationData,
  getErrorMessage,
  registerForOfferings,
} from '../../lib/workspace/api'
import type {
  CourseTerm,
  RegistrationBasketResult,
  RegistrationData,
  RegistrationEligibilityRow,
} from '../../lib/workspace/types'

const termLabels: Record<CourseTerm, string> = {
  semester_1: 'Semester 1',
  semester_2: 'Semester 2',
  summer: 'Summer',
}

const getRegistrationBlockedMessage = (
  result: RegistrationBasketResult,
  offerings: RegistrationData['offerings'],
) => {
  const offeringById = new Map(offerings.map((offering) => [offering.id, offering]))
  const failures = result.results.flatMap((eligibility) => {
    if (eligibility.eligible) {
      return []
    }

    const offering = offeringById.get(eligibility.offering_id)
    const label = offering ? courseLabel(offering) : 'Selected course'

    return eligibility.unmet_requirements.map((requirement) => `${label}: ${requirement.message}`)
  })

  if (failures.length === 0) {
    return 'You are not allowed to request approval for this course because prerequisite requirements are not met.'
  }

  return `You are not allowed to request approval for ${
    failures.length === 1 ? 'this course' : 'these courses'
  } because prerequisite requirements are not met. ${failures.join(' ')}`
}

function RegisterCoursesPage() {
  const { user } = useAuthContext()
  const [data, setData] = useState<RegistrationData | null>(null)
  const [basketIds, setBasketIds] = useState<string[]>([])
  const [basketResult, setBasketResult] = useState<RegistrationBasketResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadData = useCallback(async () => {
    try {
      const nextData = await fetchRegistrationData()

      setData(nextData)
      setBasketIds((current) =>
        current.filter((offeringId) => nextData.offerings.some((offering) => offering.id === offeringId)),
      )
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Registration data could not be loaded'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadData(), 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadData])

  const baselineEligibilityByOffering = useMemo(() => {
    const map = new Map<string, RegistrationEligibilityRow>()

    for (const eligibility of data?.eligibility ?? []) {
      map.set(eligibility.offering_id, eligibility)
    }

    return map
  }, [data?.eligibility])

  const basketEligibilityByOffering = useMemo(() => {
    const map = new Map<string, RegistrationEligibilityRow>()

    for (const eligibility of basketResult?.results ?? []) {
      map.set(eligibility.offering_id, eligibility)
    }

    return map
  }, [basketResult?.results])

  const registrationRequestByOffering = useMemo(() => {
    const map = new Map<string, RegistrationData['registrationRequests'][number]>()

    for (const request of data?.registrationRequests ?? []) {
      if (request.user_id === user?.id) {
        map.set(request.offering_id, request)
      }
    }

    return map
  }, [data?.registrationRequests, user?.id])

  const enrolledOfferingIds = useMemo(() => {
    const ids = new Set<string>()

    for (const offering of data?.offerings ?? []) {
      if (offering.members.some((member) => member.role === 'student' && member.user_id === user?.id)) {
        ids.add(offering.id)
      }
    }

    return ids
  }, [data?.offerings, user?.id])

  const selectedOfferings = (data?.offerings ?? []).filter((offering) => basketIds.includes(offering.id))

  const toggleOffering = (offeringId: string) => {
    setBasketResult(null)
    setError('')
    setNotice('')
    setBasketIds((current) =>
      current.includes(offeringId)
        ? current.filter((currentOfferingId) => currentOfferingId !== offeringId)
        : [...current, offeringId],
    )
  }

  const handleCheckBasket = async () => {
    if (basketIds.length === 0) {
      setError('Choose at least one course offering.')
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    try {
      const result = await checkRegistrationBasket(basketIds)

      setBasketResult(result)
      if (result.eligible) {
        setNotice('Selected courses meet prerequisite requirements.')
      } else {
        setError(getRegistrationBlockedMessage(result, data?.offerings ?? []))
      }
    } catch (checkError) {
      setError(getErrorMessage(checkError, 'Selected courses could not be checked'))
    } finally {
      setSaving(false)
    }
  }

  const handleRegister = async () => {
    if (basketIds.length === 0) {
      setError('Choose at least one course offering.')
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    try {
      const result = await checkRegistrationBasket(basketIds)

      setBasketResult(result)
      if (!result.eligible) {
        setError(getRegistrationBlockedMessage(result, data?.offerings ?? []))
        return
      }

      await registerForOfferings(basketIds)
      setBasketIds([])
      setBasketResult(null)
      setNotice('Registration request sent for admin approval.')
      await loadData()
    } catch (registrationError) {
      setError(getErrorMessage(registrationError, 'Registration could not be saved'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="workspace-page">
      <header className="workspace-page-header">
        <span className="workspace-eyebrow">Registration</span>
        <h1 className="workspace-page-title">Register courses</h1>
        <p className="workspace-page-subtitle">
          Choose active course offerings and check prerequisite requirements before requesting approval.
        </p>
      </header>

      {error !== '' && <div className="workspace-alert workspace-alert--error">{error}</div>}
      {notice !== '' && <div className="workspace-alert workspace-alert--success">{notice}</div>}

      {loading ? (
        <section className="workspace-panel">Loading registration options...</section>
      ) : (
        <div className="workspace-grid workspace-grid--two">
          <section className="workspace-grid">
            {(data?.offerings ?? []).map((offering) => {
              const selected = basketIds.includes(offering.id)
              const enrolled = enrolledOfferingIds.has(offering.id)
              const registrationRequest = registrationRequestByOffering.get(offering.id)
              const pending = registrationRequest?.status === 'pending'
              const rejected = registrationRequest?.status === 'rejected'
              const eligibility =
                basketEligibilityByOffering.get(offering.id) ??
                baselineEligibilityByOffering.get(offering.id)
              const eligible = eligibility?.eligible ?? true
              const statusLabel = enrolled
                ? 'Enrolled'
                : pending
                  ? 'Pending approval'
                  : rejected
                    ? 'Rejected'
                    : eligible
                      ? 'Eligible'
                      : 'Requirements needed'

              return (
                <article className="workspace-card" key={offering.id}>
                  <div className="workspace-section-heading">
                    <div>
                      <span className="workspace-chip">{offering.code}</span>
                      <h2>{offering.title}</h2>
                      <p>{offering.description || 'No course description provided.'}</p>
                    </div>
                    <span className="workspace-chip">
                      {termLabels[offering.term]} {offering.academic_year}
                    </span>
                  </div>

                  <div className="workspace-meta-row">
                    <span className="workspace-chip">
                      {statusLabel}
                    </span>
                    {selected && <span className="workspace-chip">Selected</span>}
                  </div>

                  {(eligibility?.unmet_requirements ?? []).length > 0 && (
                    <ul className="workspace-list">
                      {eligibility?.unmet_requirements.map((requirement) => (
                        <li className="workspace-list-item" key={requirement.group_id}>
                          <span>{requirement.message}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <button
                    type="button"
                    className={selected ? 'workspace-secondary-action' : 'workspace-primary-action'}
                    onClick={() => toggleOffering(offering.id)}
                    disabled={saving || enrolled || pending}
                  >
                    {enrolled
                      ? 'Already enrolled'
                      : pending
                        ? 'Pending approval'
                        : selected
                          ? 'Remove from basket'
                          : rejected
                            ? 'Request again'
                            : 'Add to basket'}
                  </button>
                </article>
              )
            })}

            {(data?.offerings ?? []).length === 0 && (
              <section className="workspace-panel">No active offerings are open for registration.</section>
            )}
          </section>

          <aside className="workspace-panel">
            <h2>Registration basket</h2>
            <ul className="workspace-list">
              {selectedOfferings.map((offering) => (
                <li className="workspace-list-item" key={offering.id}>
                  <strong>{courseLabel(offering)}</strong>
                  <span>
                    {termLabels[offering.term]} {offering.academic_year}
                  </span>
                </li>
              ))}
            </ul>

            {selectedOfferings.length === 0 && <p>No courses selected.</p>}

            <div className="workspace-form">
              <button type="button" onClick={() => void handleCheckBasket()} disabled={saving || basketIds.length === 0}>
                Check prerequisites
              </button>
              <button type="button" onClick={() => void handleRegister()} disabled={saving || basketIds.length === 0}>
                Request approval
              </button>
            </div>
          </aside>
        </div>
      )}
    </section>
  )
}

export default RegisterCoursesPage
