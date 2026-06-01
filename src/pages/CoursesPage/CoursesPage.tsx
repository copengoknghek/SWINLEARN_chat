import { useState } from 'react'
import { majorDatabase, type MainMajor } from '../../data/majorDatabase'
import Navbar from '../../components/Navbar/Navbar'
import Footer from '../../components/Footer/Footer'
import './CoursesPage.css'

function CoursesPage() {
  const [activeMajorId, setActiveMajorId] = useState(majorDatabase[0].id)
  const [activeChildId, setActiveChildId] = useState(majorDatabase[0].childMajors[0].id)
  const [searchQuery, setSearchQuery] = useState('')

  const activeMajor = majorDatabase.find((major) => major.id === activeMajorId) ?? majorDatabase[0]
  const activeChild =
    activeMajor.childMajors.find((childMajor) => childMajor.id === activeChildId) ?? activeMajor.childMajors[0]

  const filteredChildMajors = (() => {
    const query = searchQuery.trim().toLowerCase()

    if (!query) {
      return activeMajor.childMajors
    }

    return activeMajor.childMajors.filter((childMajor) => {
      const searchableText = [
        childMajor.title,
        childMajor.tagline,
        childMajor.description,
        ...childMajor.topics,
        ...childMajor.pathways,
      ]
        .join(' ')
        .toLowerCase()

      return searchableText.includes(query)
    })
  })()

  const handleMajorChange = (major: MainMajor) => {
    setActiveMajorId(major.id)
    setActiveChildId(major.childMajors[0].id)
    setSearchQuery('')
  }

  return (
    <div className="page">
      <Navbar />
      <main className="main courses-main">
        <header className="courses-header">
          <div>
            <span className="courses-eyebrow">Guest course catalog</span>
            <h1 className="page-title">Courses</h1>
          </div>
          <p className="page-subtitle">
            Browse study areas by major and explore the pathways available before logging in.
          </p>
        </header>

        <section className="major-tabs" aria-label="Main majors">
          {majorDatabase.map((major) => (
            <button
              key={major.id}
              type="button"
              className={`major-tab major-tab--${major.accent} ${activeMajor.id === major.id ? 'active' : ''}`}
              onClick={() => handleMajorChange(major)}
            >
              <span className="major-tab-title">{major.title}</span>
              <span className="major-tab-count">{major.childMajors.length} majors</span>
            </button>
          ))}
        </section>

        <div className="course-browser">
          <section className="major-panel">
            <div className="major-panel-header">
              <div>
                <h2>{activeMajor.title}</h2>
                <p>{activeMajor.summary}</p>
              </div>
              <label className="major-search">
                <span>Search {activeMajor.title}</span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search child majors"
                />
              </label>
            </div>

            <div className="child-major-grid">
              {filteredChildMajors.map((childMajor) => (
                <button
                  key={childMajor.id}
                  type="button"
                  className={`child-major-card ${activeChild.id === childMajor.id ? 'active' : ''}`}
                  onClick={() => setActiveChildId(childMajor.id)}
                >
                  <span className="child-major-title">{childMajor.title}</span>
                  <span className="child-major-tagline">{childMajor.tagline}</span>
                </button>
              ))}
            </div>

            {filteredChildMajors.length === 0 && (
              <div className="major-empty-state">
                No child majors match "{searchQuery}" in {activeMajor.title}.
              </div>
            )}
          </section>

          <aside className={`major-detail major-detail--${activeMajor.accent}`} aria-label={`${activeChild.title} detail`}>
            <div className="major-detail-header">
              <span>{activeMajor.title}</span>
              <h2>{activeChild.title}</h2>
              <p>{activeChild.tagline}</p>
            </div>

            <p className="major-detail-description">{activeChild.description}</p>

            <div className="detail-section">
              <h3>Core Topics</h3>
              <div className="detail-chip-list">
                {activeChild.topics.map((topic) => (
                  <span key={topic} className="detail-chip">
                    {topic}
                  </span>
                ))}
              </div>
            </div>

            <div className="detail-section">
              <h3>Career Pathways</h3>
              <ul className="pathway-list">
                {activeChild.pathways.map((pathway) => (
                  <li key={pathway}>{pathway}</li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default CoursesPage
