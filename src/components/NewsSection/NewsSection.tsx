function NewsSection() {
  return (
    <section className="news-section scroll-section" id="news">
      <div className="section-header">
        <p className="section-eyebrow">News</p>
        <h2 className="section-title">SWINLEARN is here.</h2>
        <p className="section-lead">
          A new campus hub built to help Swinburne students study smarter, stay
          organized, and get support faster.
        </p>
      </div>
      <article className="news-card">
        <div className="news-meta">
          <span className="news-tag">Platform update</span>
          <span className="news-date">May 2026</span>
        </div>
        <h3>Introducing SWINLEARN</h3>
        <p>
          SWINLEARN brings courses, calendars, chat, and IT support into one
          streamlined experience. Start your week with a clear plan, learn with
          an AI tutor, and reach help in seconds.
        </p>
        <div className="news-highlights">
          <span>Unified dashboard</span>
          <span>Smart reminders</span>
          <span>AI study support</span>
        </div>
      </article>
    </section>
  )
}

export default NewsSection
