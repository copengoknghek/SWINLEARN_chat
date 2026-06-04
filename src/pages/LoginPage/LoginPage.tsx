import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthContext } from '../../context/AuthContext'
import { workspaceHomePath } from '../../lib/workspace/navigation'
import './LoginPage.css'

function LoginPage() {
  const navigate = useNavigate()
  const { signIn, role, mustChangePassword, loading: authLoading } = useAuthContext()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [waitingForRole, setWaitingForRole] = useState(false)

  useEffect(() => {
    if (!waitingForRole || authLoading || role === null) {
      return
    }

    navigate(mustChangePassword ? '/change-password' : workspaceHomePath(role))
  }, [authLoading, mustChangePassword, navigate, role, waitingForRole])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    setWaitingForRole(false)

    const result = await signIn(email, password)

    if (result.error !== null) {
      setError(result.error)
      setLoading(false)
      return
    }

    setWaitingForRole(true)
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <img src="/swinburneLogo.png" alt="Swinburne Logo" className="login-logo" />
          <h1>Welcome back</h1>
          <p>Login to your SWINLEARN account</p>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              placeholder="studentID@student.swin.edu.au"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <a
              href="#"
              className="forgot-password"
              onClick={(event) => {
                event.preventDefault()
                setShowPassword((value) => !value)
              }}
            >
              {showPassword ? 'Hide password' : 'Show password'}
            </a>
          </div>
          <div className="form-options">
            <label className="remember-me">
              <input type="checkbox" /> Remember me
            </label>
            <a href="#" className="forgot-password" onClick={(event) => event.preventDefault()}>Forgot password?</a>
          </div>
          <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
            {loading ? 'Signing in...' : 'Login'}
          </button>
        </form>
        {error !== '' && <p className="login-footer">{error}</p>}
        <p className="login-footer">
          Don't have an account? <a href="#">Contact IT support</a>
        </p>
      </div>
    </div>
  )
}

export default LoginPage
