import PageLinks from '../PageLinks/PageLinks'

function Navbar() {
  return (
    <header className="site-header">
      <div className="nav-wrap">
        <a className="brand" href="#" aria-label="Swinburne University">
          Swinburne
        </a>
        <PageLinks />
        <div className="nav-actions">
          <button className="nav-pill nav-pill--outline" type="button">
            Login
          </button>
        </div>
      </div>
    </header>
  )
}

export default Navbar
