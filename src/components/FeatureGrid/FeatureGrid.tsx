const CourseIcon = () => (
  <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
    <path
      d="M4 5.5h12a2 2 0 0 1 2 2v9.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    />
    <path
      d="M8 4.5v13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    />
  </svg>
)

const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
    <rect
      x="3"
      y="5"
      width="18"
      height="16"
      rx="2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    />
    <path
      d="M3 9h18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    />
    <path
      d="M8 3v4m8-4v4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    />
  </svg>
)

const InboxIcon = () => (
  <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
    <path
      d="M5 6.5h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-4 3v-3H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
    />
  </svg>
)

const HelpIcon = () => (
  <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
    <circle
      cx="12"
      cy="12"
      r="8"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    />
    <path
      d="M12 8v4l2.5 2.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    />
  </svg>
)

const features = [
  {
    title: 'Courses',
    description: 'All your enrolled units, in one tidy view.',
    Icon: CourseIcon,
  },
  {
    title: 'Calendar',
    description: 'Never miss an assignment deadline again.',
    Icon: CalendarIcon,
  },
  {
    title: 'Inbox',
    description: 'Chat with classmates and teachers.',
    Icon: InboxIcon,
  },
  {
    title: 'IT Help',
    description: 'Stuck on tech? Send a ticket to IT.',
    Icon: HelpIcon,
  },
]

function FeatureGrid() {
  return (
    <section className="features" aria-label="Student tools">
      {features.map(({ title, description, Icon }) => (
        <article className="feature-card" key={title}>
          <div className="feature-icon" aria-hidden="true">
            <Icon />
          </div>
          <h3>{title}</h3>
          <p>{description}</p>
        </article>
      ))}
    </section>
  )
}

export default FeatureGrid
