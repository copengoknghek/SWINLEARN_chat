import { Link } from 'react-router-dom'

const pageLinks = [
  { label: 'Courses', to: '/courses' },
  { label: 'News', to: '/news' },
  { label: 'Events', to: '/events' },
  { label: 'Help', to: '/#contact-us' },
]

function PageLinks() {
  return (
    <nav className="nav-links" aria-label="Primary">
      {pageLinks.map((link) =>
        link.to.includes('#') ? (
          <a key={link.label} className="nav-pill" href={link.to}>
            {link.label}
          </a>
        ) : (
          <Link key={link.label} className="nav-pill" to={link.to}>
            {link.label}
          </Link>
        ),
      )}
    </nav>
  )
}

export default PageLinks
