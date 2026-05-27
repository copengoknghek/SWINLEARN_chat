const events = [
  {
    month: 'May',
    day: '30',
    title: 'Orientation Week Kickoff',
    description: 'Meet new classmates and get set up for the semester.',
    meta: 'Campus Atrium · 10:00 AM',
  },
  {
    month: 'Jun',
    day: '04',
    title: 'Study Sprint: AI Tutor Lab',
    description: 'Hands-on session to plan revision with SWINLEARN.',
    meta: 'Library Studio · 2:00 PM',
  },
  {
    month: 'Jun',
    day: '12',
    title: 'Career Ready Resume Clinic',
    description: 'Bring your draft and get feedback from industry mentors.',
    meta: 'Hawthorn Hall · 1:00 PM',
  },
]

function EventsSection() {
  return (
    <section className="events-section scroll-section" id="upcoming-events">
      <div className="section-header">
        <p className="section-eyebrow">Upcoming events</p>
        <h2 className="section-title">Stay connected to campus life.</h2>
        <p className="section-lead">
          From study sprints to mentoring sessions, your next event is always in
          view.
        </p>
      </div>
      <div className="events-grid">
        {events.map((event) => (
          <article className="event-card" key={event.title}>
            <div className="event-date">
              <span className="event-month">{event.month}</span>
              <span className="event-day">{event.day}</span>
            </div>
            <div className="event-body">
              <h3>{event.title}</h3>
              <p>{event.description}</p>
              <div className="event-meta">{event.meta}</div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export default EventsSection
