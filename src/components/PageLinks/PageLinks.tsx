const pageLinks = [
  { label: 'Courses', href: '#courses' },
  { label: 'Inbox', href: '#inbox' },
  { label: 'SWINLEARN', href: '#swinlearn', accent: true, highlight: true },
  { label: 'Calendar', href: '#calendar' },
  { label: 'Help', href: '#help' },
]

function PageLinks() {
  return (
    <nav className="nav-links" aria-label="Primary">
      {pageLinks.map((link) => (
        <a
          key={link.label}
          className={`nav-pill${link.accent ? ' nav-pill--accent' : ''}${
            link.highlight ? ' nav-pill--swinlearn' : ''
          }`}
          href={link.href}
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
        </a>
      ))}
    </nav>
  )
}

export default PageLinks
