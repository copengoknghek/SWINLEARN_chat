function AboutSection() {
  return (
    <section className="about-section scroll-section" id="about-us">
      <div className="section-header">
        <p className="section-eyebrow">About us</p>
        <h2 className="section-title">A smarter campus experience, in one hub.</h2>
        <p className="section-lead">
          SwinLearn unifies courses, deadlines, support, and study tools so you
          can focus on learning, not searching.
        </p>
      </div>
      <div className="about-grid">
        <article className="about-card">
          <h3>What we do</h3>
          <p>
            We build a single space where students can track coursework, plan
            their weeks, and reach help fast.
          </p>
          <div className="about-metrics">
            <div className="metric">
              <span className="metric-value">24/7</span>
              <span className="metric-label">Support</span>
            </div>
            <div className="metric">
              <span className="metric-value">1 hub</span>
              <span className="metric-label">All services</span>
            </div>
            <div className="metric">
              <span className="metric-value">100%</span>
              <span className="metric-label">Student-first</span>
            </div>
          </div>
        </article>
        <article className="about-card">
          <h3>Designed for students</h3>
          <ul className="about-list">
            <li>Unified course timelines and smart reminders.</li>
            <li>Built-in chat with peers, tutors, and lecturers.</li>
            <li>Personalized AI study support that adapts to you.</li>
          </ul>
        </article>
      </div>
    </section>
  )
}

export default AboutSection
