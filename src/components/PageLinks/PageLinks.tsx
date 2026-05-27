import { Link, useLocation } from 'react-router-dom'

const pageLinks = [
  { label: 'Courses', to: '/courses' },
  { label: 'Inbox', to: '#inbox' },
  { label: 'SWINLEARN', to: '/#swinlearn', accent: true, highlight: true },
  { label: 'Calendar', to: '#calendar' },
  { label: 'Help', to: '#help' },
]

function PageLinks() {
  const location = useLocation();

  return (
    <nav className="nav-links" aria-label="Primary">
      {pageLinks.map((link) => {
        // If we are on the homepage, make sure SWINLEARN highlight scrolls to '#swinlearn'
        // If we are not on the homepage, clicking SWINLEARN goes to '/'
        const actualTo = link.highlight && location.pathname === '/' ? '#swinlearn' : link.to;

        return (
          <Link
            key={link.label}
            className={`nav-pill${link.accent ? ' nav-pill--accent' : ''}${
              link.highlight ? ' nav-pill--swinlearn' : ''
            }`}
            to={actualTo}
          >
            {link.highlight ? (
            <span className="fly-text-container">
              {link.label.split('').map((char, index) => (
                <span
                  key={index}
                  className="fly-char"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  {char === ' ' ? '\u00A0' : char}
                </span>
              ))}
            </span>
          ) : (
            link.label
          )}
        </Link>
      )})}
    </nav>
  )
}

export default PageLinks
