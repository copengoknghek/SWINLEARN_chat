import './LoginPage.css'

function LoginPage() {
  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <img src="/swinburneLogo.png" alt="Swinburne Logo" className="login-logo" />
          <h1>Welcome back</h1>
          <p>Login to your SWINLEARN account</p>
        </div>
        <form className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input type="email" id="email" placeholder="studentID@student.swin.edu.au" required />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input type="password" id="password" placeholder="Enter your password" required />
          </div>
          <div className="form-options">
            <label className="remember-me">
              <input type="checkbox" /> Remember me
            </label>
            <a href="#" className="forgot-password">Forgot password?</a>
          </div>
          <button type="submit" className="btn btn-primary login-btn">Login</button>
        </form>
        <p className="login-footer">
          Don't have an account? <a href="#">Contact IT support</a>
        </p>
      </div>
    </div>
  )
}

export default LoginPage
