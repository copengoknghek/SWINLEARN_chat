import Navbar from '../../components/Navbar/Navbar'
import Footer from '../../components/Footer/Footer'
import { majorDatabase } from '../../data/majorDatabase'
import './CoursesPage.css'

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

function CoursesPage() {
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

        <nav className="major-jump-nav" aria-label="Major areas">
          {majorDatabase.map((major) => (
            <a key={major.id} className={`major-jump major-jump--${major.accent}`} href={`#${major.id}`}>
              {major.title}
            </a>
          ))}
        </nav>

        <div className="catalog-stack">
          {majorDatabase.map((major) => (
            <section
              key={major.id}
              id={major.id}
              className={`major-section major-section--${major.accent}`}
            >
              <header className="major-section-header">
                <span className="major-kicker">{major.title}</span>
                <h2>{major.title}</h2>
                <p>{major.summary}</p>
              </header>

              <div className="child-major-grid">
                {major.childMajors.map((childMajor) => (
                  <article key={childMajor.id} className="child-major-card">
                    <header className="child-major-header">
                      <span>{childMajor.title}</span>
                      <h3>{childMajor.tagline}</h3>
                    </header>

                    <p className="child-major-description">{childMajor.description}</p>

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

                    <section className="course-unit-list" aria-label={`${childMajor.title} course units`}>
                      <h4>Course units</h4>
                      {childMajor.courses.map((course) => (
                        <article key={course.code} className="course-unit">
                          <div className="course-unit-heading">
                            <span className="course-code">{course.code}</span>
                            <div>
                              <h5>{course.title}</h5>
                              <p>
                                {course.level} - {course.duration}
                              </p>
                            </div>
                          </div>

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
                      ))}
                    </section>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default CoursesPage
