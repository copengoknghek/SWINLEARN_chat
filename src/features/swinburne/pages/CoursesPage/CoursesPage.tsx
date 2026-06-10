import { useMemo, useState } from 'react'
import Navbar from '../../components/Navbar/Navbar'
import Footer from '../../components/Footer/Footer'
import {
  majorDatabase,
  type ChildMajor,
  type CourseUnit,
  type MainMajor,
} from '../../data/majorDatabase'
import './CoursesPage.css'

type ChildMajorResult = {
  major: MainMajor
  childMajor: ChildMajor
}

type CourseResult = ChildMajorResult & {
  course: CourseUnit
}

type SearchResults = {
  majors: MainMajor[]
  childMajors: ChildMajorResult[]
  courses: CourseResult[]
}

const catalogSummary = {
  majorCount: majorDatabase.length,
  childMajorCount: majorDatabase.reduce(
    (total, major) => total + major.childMajors.length,
    0,
  ),
  courseCount: majorDatabase.reduce(
    (total, major) =>
      total +
      major.childMajors.reduce((childTotal, childMajor) => childTotal + childMajor.courses.length, 0),
    0,
  ),
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase()
}

function includesQuery(values: string[], query: string) {
  return values.some((value) => value.toLowerCase().includes(query))
}

function matchesMajor(major: MainMajor, query: string) {
  return includesQuery([major.title, major.summary], query)
}

function matchesChildMajor(childMajor: ChildMajor, query: string) {
  return includesQuery(
    [
      childMajor.title,
      childMajor.tagline,
      childMajor.description,
      ...childMajor.topics,
      ...childMajor.pathways,
    ],
    query,
  )
}

function matchesCourse(course: CourseUnit, query: string) {
  return includesQuery(
    [
      course.code,
      course.title,
      course.level,
      course.duration,
      course.overview,
      course.review,
      ...course.details,
    ],
    query,
  )
}

function getSearchResults(query: string): SearchResults {
  if (!query) {
    return {
      majors: [],
      childMajors: [],
      courses: [],
    }
  }

  return majorDatabase.reduce<SearchResults>(
    (results, major) => {
      if (matchesMajor(major, query)) {
        results.majors.push(major)
      }

      major.childMajors.forEach((childMajor) => {
        if (matchesChildMajor(childMajor, query)) {
          results.childMajors.push({ major, childMajor })
        }

        childMajor.courses.forEach((course) => {
          if (matchesCourse(course, query)) {
            results.courses.push({ major, childMajor, course })
          }
        })
      })

      return results
    },
    {
      majors: [],
      childMajors: [],
      courses: [],
    },
  )
}

function getSearchResultCount(results: SearchResults) {
  return results.majors.length + results.childMajors.length + results.courses.length
}

function pluralize(count: number, label: string) {
  return `${count} ${label}${count === 1 ? '' : 's'}`
}

type MajorChoiceCardProps = {
  major: MainMajor
  isActive?: boolean
  onSelect: (majorId: string) => void
}

function MajorChoiceCard({ major, isActive = false, onSelect }: MajorChoiceCardProps) {
  return (
    <button
      type="button"
      className={`major-choice-card major-choice-card--${major.accent} ${isActive ? 'is-active' : ''}`}
      onClick={() => onSelect(major.id)}
      aria-pressed={isActive}
    >
      <span className="major-choice-kicker">Main major</span>
      <span className="major-choice-title">{major.title}</span>
      <span className="major-choice-summary">{major.summary}</span>
      <span className="major-choice-meta">{pluralize(major.childMajors.length, 'child major')}</span>
    </button>
  )
}

type ChildMajorChoiceCardProps = {
  major: MainMajor
  childMajor: ChildMajor
  isActive?: boolean
  onSelect: (majorId: string, childMajorId: string) => void
}

function ChildMajorChoiceCard({
  major,
  childMajor,
  isActive = false,
  onSelect,
}: ChildMajorChoiceCardProps) {
  return (
    <button
      type="button"
      className={`child-major-card child-major-card--${major.accent} ${isActive ? 'is-active' : ''}`}
      onClick={() => onSelect(major.id, childMajor.id)}
      aria-pressed={isActive}
    >
      <span className="child-major-label">{childMajor.title}</span>
      <span className="child-major-title">{childMajor.tagline}</span>
      <span className="child-major-description">{childMajor.description}</span>
      <span className="child-major-chip-row" aria-label={`${childMajor.title} focus areas`}>
        {childMajor.topics.map((topic) => (
          <span className="child-major-chip" key={topic}>
            {topic}
          </span>
        ))}
      </span>
      <span className="child-major-meta">{pluralize(childMajor.courses.length, 'course unit')}</span>
    </button>
  )
}

type CourseUnitCardProps = {
  course: CourseUnit
  context?: string
}

function CourseUnitCard({ course, context }: CourseUnitCardProps) {
  return (
    <article className="course-unit">
      <div className="course-unit-heading">
        <span className="course-code">{course.code}</span>
        <div>
          <h5>{course.title}</h5>
          <p>
            {course.level} - {course.duration}
          </p>
        </div>
      </div>

      {context ? <p className="course-context">{context}</p> : null}

      <p className="course-overview">{course.overview}</p>

      <div className="course-review">
        <strong>Review</strong>
        <p>{course.review}</p>
      </div>

      <ul className="course-detail-list">
        {course.details.map((detail) => (
          <li key={detail}>{detail}</li>
        ))}
      </ul>
    </article>
  )
}

type SelectedChildMajorProps = {
  major: MainMajor
  childMajor: ChildMajor
}

function SelectedChildMajor({ major, childMajor }: SelectedChildMajorProps) {
  return (
    <section
      className={`selected-child-section major-section--${major.accent}`}
      aria-labelledby={`${childMajor.id}-courses-heading`}
    >
      <div className="selected-child-layout">
        <article className="selected-child-profile">
          <span className="major-kicker">{childMajor.title}</span>
          <h3 id={`${childMajor.id}-courses-heading`}>{childMajor.tagline}</h3>
          <p>{childMajor.description}</p>

          <div className="child-major-detail-grid">
            <section aria-label={`${childMajor.title} focus areas`}>
              <h4>Focus areas</h4>
              <ul>
                {childMajor.topics.map((topic) => (
                  <li key={topic}>{topic}</li>
                ))}
              </ul>
            </section>

            <section aria-label={`${childMajor.title} career pathways`}>
              <h4>Career pathways</h4>
              <ul>
                {childMajor.pathways.map((pathway) => (
                  <li key={pathway}>{pathway}</li>
                ))}
              </ul>
            </section>
          </div>
        </article>

        <section className="course-unit-list" aria-label={`${childMajor.title} course units`}>
          <h4>Course units</h4>
          {childMajor.courses.map((course) => (
            <CourseUnitCard course={course} key={course.code} />
          ))}
        </section>
      </div>
    </section>
  )
}

type SearchResultsViewProps = {
  results: SearchResults
  query: string
  selectedMajorId: string | null
  selectedChildMajorId: string | null
  onMajorSelect: (majorId: string) => void
  onChildMajorSelect: (majorId: string, childMajorId: string) => void
}

function SearchResultsView({
  results,
  query,
  selectedMajorId,
  selectedChildMajorId,
  onMajorSelect,
  onChildMajorSelect,
}: SearchResultsViewProps) {
  const resultCount = getSearchResultCount(results)

  if (resultCount === 0) {
    return (
      <section className="search-empty" aria-live="polite">
        <h2>No catalog matches</h2>
        <p>No majors, child majors, or course units match "{query}".</p>
      </section>
    )
  }

  return (
    <section className="search-results" aria-label="Catalog search results">
      <header className="catalog-browser-header">
        <span className="section-eyebrow">Search results</span>
        <h2>{pluralize(resultCount, 'match')} for "{query}"</h2>
      </header>

      {results.majors.length > 0 ? (
        <div className="search-result-group">
          <h3>Majors</h3>
          <div className="major-choice-grid">
            {results.majors.map((major) => (
              <MajorChoiceCard
                major={major}
                isActive={major.id === selectedMajorId}
                onSelect={onMajorSelect}
                key={major.id}
              />
            ))}
          </div>
        </div>
      ) : null}

      {results.childMajors.length > 0 ? (
        <div className="search-result-group">
          <h3>Child majors</h3>
          <div className="child-major-grid">
            {results.childMajors.map(({ major, childMajor }) => (
              <ChildMajorChoiceCard
                major={major}
                childMajor={childMajor}
                isActive={major.id === selectedMajorId && childMajor.id === selectedChildMajorId}
                onSelect={onChildMajorSelect}
                key={`${major.id}-${childMajor.id}`}
              />
            ))}
          </div>
        </div>
      ) : null}

      {results.courses.length > 0 ? (
        <div className="search-result-group">
          <h3>Course units</h3>
          <div className="course-result-grid">
            {results.courses.map(({ major, childMajor, course }) => (
              <div className={`course-result major-section--${major.accent}`} key={course.code}>
                <p className="catalog-path">
                  {major.title} / {childMajor.title}
                </p>
                <CourseUnitCard course={course} />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}

function CoursesPage() {
  const [selectedMajorId, setSelectedMajorId] = useState<string | null>(null)
  const [selectedChildMajorId, setSelectedChildMajorId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const normalizedQuery = normalizeSearch(searchQuery)
  const searchResults = useMemo(() => getSearchResults(normalizedQuery), [normalizedQuery])
  const searchResultCount = getSearchResultCount(searchResults)
  const isSearching = normalizedQuery.length > 0

  const selectedMajor = selectedMajorId
    ? majorDatabase.find((major) => major.id === selectedMajorId)
    : undefined
  const selectedChildMajor =
    selectedMajor && selectedChildMajorId
      ? selectedMajor.childMajors.find((childMajor) => childMajor.id === selectedChildMajorId)
      : undefined

  const catalogStatus = isSearching
    ? pluralize(searchResultCount, 'search result')
    : selectedChildMajor
      ? `${pluralize(selectedChildMajor.courses.length, 'course unit')} in ${selectedChildMajor.title}`
      : selectedMajor
        ? `${pluralize(selectedMajor.childMajors.length, 'child major')} in ${selectedMajor.title}`
        : pluralize(majorDatabase.length, 'main major')

  function handleMajorSelect(majorId: string) {
    setSelectedMajorId(majorId)
    setSelectedChildMajorId(null)
    setSearchQuery('')
  }

  function handleChildMajorSelect(majorId: string, childMajorId: string) {
    setSelectedMajorId(majorId)
    setSelectedChildMajorId(childMajorId)
    setSearchQuery('')
  }

  function handleSearchClear() {
    setSearchQuery('')
  }

  return (
    <div className="page">
      <Navbar />
      <main className="main courses-main">
        <header className="courses-hero">
          <span className="section-eyebrow">Study catalog</span>
          <h1>Swinburne courses</h1>
          <p>
            Explore every major area, child major, and course unit in the public
            Swinburne catalog, with review notes and practical details for each
            course.
          </p>

          <dl className="catalog-stats" aria-label="Course catalog summary">
            <div>
              <dt>{catalogSummary.majorCount}</dt>
              <dd>Main majors</dd>
            </div>
            <div>
              <dt>{catalogSummary.childMajorCount}</dt>
              <dd>Child majors</dd>
            </div>
            <div>
              <dt>{catalogSummary.courseCount}</dt>
              <dd>Course units</dd>
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
              placeholder="Search majors, child majors, or courses"
            />
            {searchQuery ? (
              <button type="button" onClick={handleSearchClear}>
                Clear
              </button>
            ) : null}
          </div>
          <p className="course-search-status" aria-live="polite">
            {catalogStatus}
          </p>
        </section>

        {isSearching ? (
          <SearchResultsView
            results={searchResults}
            query={searchQuery.trim()}
            selectedMajorId={selectedMajorId}
            selectedChildMajorId={selectedChildMajorId}
            onMajorSelect={handleMajorSelect}
            onChildMajorSelect={handleChildMajorSelect}
          />
        ) : (
          <div className="catalog-stack">
            <section className="catalog-browser-section" aria-labelledby="main-majors-heading">
              <header className="catalog-browser-header">
                <span className="section-eyebrow">Main majors</span>
                <h2 id="main-majors-heading">Choose a major</h2>
              </header>

              <div className="major-choice-grid">
                {majorDatabase.map((major) => (
                  <MajorChoiceCard
                    major={major}
                    isActive={major.id === selectedMajorId}
                    onSelect={handleMajorSelect}
                    key={major.id}
                  />
                ))}
              </div>
            </section>

            {selectedMajor ? (
              <section
                className={`selected-major-section major-section--${selectedMajor.accent}`}
                aria-labelledby={`${selectedMajor.id}-child-majors-heading`}
              >
                <header className="major-section-header">
                  <span className="major-kicker">{selectedMajor.title}</span>
                  <h2 id={`${selectedMajor.id}-child-majors-heading`}>{selectedMajor.title}</h2>
                  <p>{selectedMajor.summary}</p>
                </header>

                <div className="child-major-grid">
                  {selectedMajor.childMajors.map((childMajor) => (
                    <ChildMajorChoiceCard
                      major={selectedMajor}
                      childMajor={childMajor}
                      isActive={childMajor.id === selectedChildMajorId}
                      onSelect={handleChildMajorSelect}
                      key={childMajor.id}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {selectedMajor && selectedChildMajor ? (
              <SelectedChildMajor major={selectedMajor} childMajor={selectedChildMajor} />
            ) : null}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}

export default CoursesPage
