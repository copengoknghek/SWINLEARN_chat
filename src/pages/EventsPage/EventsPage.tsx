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
          <span className="section-eyebrow">Campus events</span>
          <h1 className="fanpage-list-title">Events</h1>
          <p className="section-lead">
            Plan around orientation sessions, study workshops, career events,
            and campus activities.
          </p>
        </header>

        <section className="events-grid" aria-label="Upcoming events">
          {fanpageEvents.map((event) => (
            <article className="event-card event-page-card" key={event.title}>
              <div className="event-date">
                <span className="event-month">{event.month}</span>
                <span className="event-day">{event.day}</span>
              </div>
              <div className="event-body">
                <h2>{event.title}</h2>
                <p>{event.description}</p>
                <div className="event-meta">{event.meta}</div>
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
