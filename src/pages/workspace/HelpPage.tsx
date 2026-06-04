const helpTopics = [
  {
    title: 'Course access',
    description: 'Get help when a unit, assessment, or learning resource is missing.',
  },
  {
    title: 'Technical support',
    description: 'Report login, browser, file upload, or platform errors.',
  },
  {
    title: 'Study support',
    description: 'Find workshops, tutoring, and student service guidance.',
  },
]

function HelpPage() {
  return (
    <section className="workspace-page">
      <header className="workspace-page-header">
        <span className="workspace-eyebrow">Workspace</span>
        <h1 className="workspace-page-title">Help</h1>
        <p className="workspace-page-subtitle">
          Start a support request or find the right team for coursework,
          platform, and account questions.
        </p>
      </header>

      <div className="workspace-grid workspace-grid--three">
        {helpTopics.map((topic) => (
          <article className="workspace-card" key={topic.title}>
            <h2>{topic.title}</h2>
            <p>{topic.description}</p>
          </article>
        ))}
      </div>

      <section className="workspace-panel">
        <h2>Submit a help request</h2>
        <form className="workspace-form">
          <label>
            <span>Topic</span>
            <select defaultValue="course-access">
              <option value="course-access">Course access</option>
              <option value="technical-support">Technical support</option>
              <option value="study-support">Study support</option>
            </select>
          </label>
          <label>
            <span>Details</span>
            <textarea placeholder="Tell us what happened and what you need." />
          </label>
          <button type="button">Create request</button>
        </form>
      </section>
    </section>
  )
}

export default HelpPage
