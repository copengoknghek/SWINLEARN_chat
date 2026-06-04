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

const NewsIcon = () => (
  <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
    <path
      d="M5 5h14v14H5z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    />
    <path
      d="M8 9h8M8 13h8M8 17h5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.7"
    />
  </svg>
)

const EventIcon = () => (
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
      d="M3 9h18M8 3v4m8-4v4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.7"
    />
  </svg>
)

const SupportIcon = () => (
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
      strokeLinecap="round"
      strokeWidth="1.7"
    />
  </svg>
)

const features = [
  {
    title: 'Courses',
    description: 'Browse study areas and pathways before logging in.',
    Icon: CourseIcon,
  },
  {
    title: 'News',
    description: 'Read platform updates and student service announcements.',
    Icon: NewsIcon,
  },
  {
    title: 'Events',
    description: 'Find upcoming orientation, study, and career activities.',
    Icon: EventIcon,
  },
  {
    title: 'Help',
    description: 'Contact the support team for access or platform questions.',
    Icon: SupportIcon,
  },
]

function FeatureGrid() {
  return (
    <section className="features" aria-label="Guest links">
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
