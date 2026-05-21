const pageLinks = [
  { label: 'Courses', href: '#courses' },
  { label: 'Calendar', href: '#calendar' },
  { label: 'SWINLEARN', href: '#swinlearn', accent: true },
  { label: 'Inbox', href: '#inbox' },
  { label: 'Help', href: '#help' },
]

function PageLinks() {
  return (
    <nav className="nav-links" aria-label="Primary">
      {pageLinks.map((link) => (
        <a
          key={link.label}
          className={`nav-pill${link.accent ? ' nav-pill--accent' : ''}`}
          href={link.href}
        >
          {link.label}
        </a>
      ))}
    </nav>
  )
}

export default PageLinks
