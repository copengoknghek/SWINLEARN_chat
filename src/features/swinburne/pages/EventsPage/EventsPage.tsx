import Navbar from '../../components/Navbar/Navbar'
import Footer from '../../components/Footer/Footer'
import { fanpageEvents } from '../../data/fanpageContent'
import './EventsPage.css'

function EventsPage() {
  return (
    <div className="page">
      <Navbar />
      <main className="main fanpage-list-main">
        <header className="fanpage-list-header">
          <span className="section-eyebrow">Campus event stories</span>
          <h1 className="fanpage-list-title">Events</h1>
          <p className="section-lead">
            Review the moments that bring learning, support, and campus life
            into one place.
          </p>
        </header>

        <section className="event-feature-list" aria-label="Event stories">
          {fanpageEvents.map((event, index) => (
            <article
              className={`event-feature ${
                index % 2 === 1 ? 'event-feature--reverse' : ''
              }`}
              key={event.title}
            >
              <div className="event-feature-media">
                <img
                  src={event.mediaSrc}
                  alt={event.mediaAlt}
                  loading={index === 0 ? 'eager' : 'lazy'}
                  decoding="async"
                />
                {event.mediaType === 'video' && (
                  <div className="event-video-control">
                    <span className="event-play-icon" aria-hidden="true" />
                    <span>Preview</span>
                  </div>
                )}
              </div>
              <div className="event-feature-content">
                <div className="event-feature-date">
                  <span className="event-feature-month">{event.month}</span>
                  <span className="event-feature-day">{event.day}</span>
                </div>
                <div className="event-feature-copy">
                  <p className="event-feature-meta">{event.meta}</p>
                  <h2>{event.title}</h2>
                  <p>{event.review}</p>
                  <a className="event-feature-link" href="/#contact">
                    {event.ctaLabel}
                  </a>
                </div>
              </div>
            </article>
          ))}
        </section>
      </main>
      <Footer />
    </div>
  )
}

export default EventsPage
