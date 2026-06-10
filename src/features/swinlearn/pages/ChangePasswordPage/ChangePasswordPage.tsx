import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuthContext } from '../../../../context/AuthContext'
import { changePassword, getErrorMessage } from '../../lib/workspace/api'
import { workspaceHomePath } from '../../lib/workspace/navigation'
import '../LoginPage/LoginPage.css'

function ChangePasswordPage() {
  const navigate = useNavigate()
  const { user, role, loading, mustChangePassword, refreshProfile, signOut } = useAuthContext()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  if (loading) {
    return (
      <div className="login-page">
        <div className="login-container">Loading account...</div>
      </div>
    )
  }

  if (user === null) {
    return <Navigate to="/login" replace />
  }

  if (!mustChangePassword && role !== null) {
    return <Navigate to={workspaceHomePath(role)} replace />
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSaving(true)

    try {
      await changePassword(password)
      await refreshProfile()

      if (role !== null) {
        navigate(workspaceHomePath(role), { replace: true })
      }
    } catch (changeError) {
      setError(getErrorMessage(changeError, 'Password could not be changed'))
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <img src="/swinburneLogo.png" alt="Swinburne Logo" className="login-logo" />
          <h1>Change password</h1>
          <p>Your temporary password must be replaced before opening the workspace.</p>
        </div>

        <form className="login-form" onSubmit={(event) => void handleSubmit(event)}>
          <div className="form-group">
            <label htmlFor="new-password">New password</label>
            <input
              type="password"
              id="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="confirm-password">Confirm password</label>
            <input
              type="password"
              id="confirm-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={8}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary login-btn" disabled={saving}>
            {saving ? 'Saving...' : 'Save password'}
          </button>
          <button type="button" className="login-secondary-btn" onClick={() => void handleSignOut()}>
            Sign out
          </button>
        </form>

        {error !== '' && <p className="login-footer">{error}</p>}
      </div>
    </div>
  )
}

export default ChangePasswordPage
