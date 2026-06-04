import { Link } from 'react-router-dom'

function Hero() {
  return (
    <section className="hero">
      <p className="hero-eyebrow">Swinburne University</p>
      <h1 className="hero-title">
        Connect with <span className="hero-highlight">Swinburne</span>.
      </h1>
      <p className="hero-subtitle">
        Explore courses, campus news, upcoming events, and support information
        before entering your SWINLEARN workspace.
      </p>
      <div className="hero-actions">
        <Link className="btn btn-primary" to="/courses">
          Explore courses
        </Link>
        <Link className="btn btn-secondary" to="/events">
          View events
        </Link>
      </div>
    </section>
  )
}

export default Hero
