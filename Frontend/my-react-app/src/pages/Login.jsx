import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const infoMessage = location.state?.message || ''
  const redirectTo = location.state?.redirectTo || '/sectors'

  function handleClose() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate('/home')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const em = email.trim()
    if (!em || !password) {
      setError('Email or username and password are required.')
      return
    }

    setLoading(true)
    try {
      const identifierKey = em.includes('@') ? 'email' : 'username'
      const payload = { [identifierKey]: em, email: em, username: em, password }

      async function tryEndpoint(path) {
        const res = await fetch(`${API_BASE_URL}${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json().catch(() => ({}))
        return { ok: res.ok, status: res.status, data }
      }

      const candidates = ['/user/login/', '/user/signin/', '/auth/login/', '/login/', '/api/login/']
      let success = null
      for (const path of candidates) {
        const attempt = await tryEndpoint(path)
        if (attempt.ok) {
          success = { path, data: attempt.data }
          break
        }
        // If endpoint exists but rejects with 400/401, break and show its message.
        if (attempt.status === 400 || attempt.status === 401) {
          throw new Error(attempt.data?.detail || 'Invalid credentials')
        }
        // For 404, continue to next candidate.
      }

      if (!success) {
        throw new Error('Login service not found at API base URL. Please verify backend routes.')
      }

      const userPayload = {
        email: em,
        id: success.data?.id ?? null,
        token: success.data?.token ?? null,
        name: success.data?.full_name ?? success.data?.name ?? null,
        logged_in_at: new Date().toISOString(),
      }
      try {
        localStorage.setItem('current_user', JSON.stringify(userPayload))
      } catch {
        // If storage fails, still allow navigation but user state won't persist.
      }
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-shell animate-fade-in">
      <div className="card login-card">
        <div className="card-body">
          <div className="d-flex justify-content-end">
            <button type="button" className="btn-close app-close-btn" aria-label="Close" onClick={handleClose} />
          </div>
          <p className="text-secondary mb-3">Login here to continue to your dashboard.</p>
          {infoMessage ? (
            <div className="alert alert-info" role="status">
              {infoMessage}
            </div>
          ) : null}
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label">Email or Username</label>
              <input
                type="text"
                className="form-control"
                placeholder="Enter email or username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-control"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="d-flex gap-2 align-items-center">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Logging in...' : 'Login'}
              </button>
              <Link to="/signup" className="btn btn-outline-primary">
                Sign Up
              </Link>
            </div>
            {error ? (
              <div className="alert alert-danger mt-3 mb-0" role="alert">
                {error}
              </div>
            ) : null}
            <p className="text-secondary small mt-3 mb-0">
              New user? Click Sign Up to fill the registration form.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Login
