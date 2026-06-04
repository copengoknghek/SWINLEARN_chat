const footerLinks = [
  {
    title: 'Use cases',
    items: [
      'UI design',
      'UX design',
      'Wireframing',
      'Diagramming',
      'Brainstorming',
      'Online whiteboard',
      'Team collaboration',
    ],
  },
  {
    title: 'Explore',
    items: [
      'Design',
      'Prototyping',
      'Development features',
      'Design systems',
      'Collaboration features',
      'Design process',
      'FigJam',
    ],
  },
  {
    title: 'Resources',
    items: [
      'Blog',
      'Best practices',
      'Colors',
      'Color wheel',
      'Support',
      'Developers',
      'Resource library',
    ],
  },
]

function Footer() {
  return (
    <footer className="site-footer" aria-label="Footer">
      <div className="footer-wrap">
        <div className="footer-brand">
          <div className="footer-logo">S</div>
          <div className="footer-social">
            <a className="social-icon" href="#" aria-label="X">
              X
            </a>
            <a className="social-icon" href="#" aria-label="Instagram">
              IG
            </a>
            <a className="social-icon" href="#" aria-label="YouTube">
              YT
            </a>
            <a className="social-icon" href="#" aria-label="LinkedIn">
              IN
            </a>
          </div>
        </div>
        <div className="footer-columns">
          {footerLinks.map((column) => (
            <div className="footer-column" key={column.title}>
              <h4>{column.title}</h4>
              <ul>
                {column.items.map((item) => (
                  <li key={item}>
                    <a href="#">{item}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </footer>
  )
}

export default Footer
