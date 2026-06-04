import { Link } from 'react-router-dom'
import PageLinks from '../PageLinks/PageLinks'

function Navbar() {
  return (
    <header className="site-header">
      <div className="nav-wrap">
        <Link className="brand" to="/" aria-label="Swinburne University">
          <img src="/swinburneLogo.png" alt="Swinburne" className="brand-logo" />
        </Link>
        <PageLinks />
        <div className="nav-actions">
          <Link className="nav-pill nav-pill--outline" to="/login">
            Login
          </Link>
        </div>
      </div>
    </header>
  )
}

export default Navbar
