function Hero() {
  return (
    <section className="hero">
      <p className="hero-eyebrow">Swinburne University</p>
      <h1 className="hero-title">
        Study smarter with <span className="hero-highlight">SWINLEARN</span>.
      </h1>
      <p className="hero-subtitle">
        Your courses, deadlines, classmates and an{' '}
        <span className="hero-link">AI tutor</span> - in one place. Built for
        Swinburne students.
      </p>
      <div className="hero-actions">
        <button className="btn btn-primary" type="button">
          Get started
        </button>
        <button className="btn btn-secondary" type="button">
          Try SWINLEARN
        </button>
      </div>
    </section>
  )
}

export default Hero
