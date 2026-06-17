import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../../../../lib/api/client'
import Navbar from '../../components/Navbar/Navbar'
import Footer from '../../components/Footer/Footer'
import type { CourseCatalogRow } from '../../../swinlearn/lib/workspace/types'
import './CoursesPage.css'

function normalizeSearch(value: string) {
  return value.trim().toLowerCase()
}

function includesQuery(values: string[], query: string) {
  return values.some((value) => value.toLowerCase().includes(query))
}

function pluralize(count: number, label: string) {
  return `${count} ${label}${count === 1 ? '' : 's'}`
}

function CourseUnitCard({ course }: { course: CourseCatalogRow }) {
  return (
    <article className="course-unit">
      <div className="course-unit-heading">
        <span className="course-code">{course.code}</span>
        <div>
          <h5>{course.title}</h5>
          <p>Database catalog course</p>
        </div>
      </div>

      <p className="course-overview">{course.description}</p>
    </article>
  )
}

function CoursesPage() {
  const [courses, setCourses] = useState<CourseCatalogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    let isActive = true

    apiRequest<CourseCatalogRow[]>('/api/workspace/catalog/courses')
      .then((nextCourses) => {
        if (isActive) {
          setCourses(nextCourses)
        }
      })
      .catch((loadError: unknown) => {
        if (isActive) {
          setError(loadError instanceof Error ? loadError.message : 'Course catalog could not be loaded.')
        }
      })
      .finally(() => {
        if (isActive) {
          setLoading(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [])

  const normalizedQuery = normalizeSearch(searchQuery)
  const visibleCourses = useMemo(() => {
    if (!normalizedQuery) {
      return courses
    }

    return courses.filter((course) =>
      includesQuery([course.code, course.title, course.description], normalizedQuery),
    )
  }, [courses, normalizedQuery])

  const catalogStatus = loading
    ? 'Loading course catalog'
    : normalizedQuery
      ? pluralize(visibleCourses.length, 'search result')
      : pluralize(courses.length, 'course')

  return (
    <div className="page">
      <Navbar />
      <main className="main courses-main">
        <header className="courses-hero">
          <span className="section-eyebrow">Study catalog</span>
          <h1>Swinburne courses</h1>
          <p>
            Explore database-backed course records managed from the SWINLEARN
            admin workspace.
          </p>

          <dl className="catalog-stats" aria-label="Course catalog summary">
            <div>
              <dt>{courses.length}</dt>
              <dd>Course records</dd>
            </div>
            <div>
              <dt>{visibleCourses.length}</dt>
              <dd>Visible now</dd>
            </div>
          </dl>
        </header>

        <section className="course-search-panel" aria-label="Catalog search">
          <label htmlFor="course-catalog-search">Search catalog</label>
          <div className="course-search-row">
            <input
              id="course-catalog-search"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search course code, title, or description"
            />
            {searchQuery ? (
              <button type="button" onClick={() => setSearchQuery('')}>
                Clear
              </button>
            ) : null}
          </div>
          <p className="course-search-status" aria-live="polite">
            {catalogStatus}
          </p>
        </section>

        {error ? <section className="search-empty">{error}</section> : null}

        {!error && (
          <section className="catalog-browser-section" aria-labelledby="course-catalog-heading">
            <header className="catalog-browser-header">
              <span className="section-eyebrow">Course units</span>
              <h2 id="course-catalog-heading">Database catalog</h2>
            </header>

            {loading ? (
              <section className="search-empty">Loading courses...</section>
            ) : visibleCourses.length > 0 ? (
              <div className="course-result-grid">
                {visibleCourses.map((course) => (
                  <CourseUnitCard course={course} key={course.id} />
                ))}
              </div>
            ) : (
              <section className="search-empty">No catalog matches.</section>
            )}
          </section>
        )}
      </main>
      <Footer />
    </div>
  )
}

export default CoursesPage
