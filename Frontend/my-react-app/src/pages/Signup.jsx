import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

function Signup() {
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  function handleClose() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate('/home')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage('')

    if (!fullName.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      setMessage('Full name, email, password and confirm password are required.')
      return
    }

    if (password !== confirmPassword) {
      setMessage('Password and confirm password do not match.')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/user/signup/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim(),
          password,
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result?.detail || 'Failed to create account')
      }

      setMessage('Account created successfully. Redirecting to login...')
      setTimeout(() => navigate('/login'), 900)
    } catch (err) {
      setMessage(err.message || 'Failed to create account')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="signup-shell animate-fade-in">
      <div className="card signup-card">
        <div className="card-body">
          <div className="d-flex justify-content-end">
            <button type="button" className="btn-close app-close-btn" aria-label="Close" onClick={handleClose} />
          </div>
          <h4 className="mb-1">Create Account</h4>
          <p className="text-secondary mb-3">Register to start tracking sectors and portfolio analytics.</p>
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                className="form-control"
                placeholder="Enter full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-control"
                placeholder="Enter email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-control"
                placeholder="Create password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Confirm Password</label>
              <input
                type="password"
                className="form-control"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-success" disabled={loading}>
              {loading ? 'Creating...' : 'Create Account'}
            </button>
            {message ? <p className="small mt-3 mb-0 text-secondary">{message}</p> : null}
          </form>
        </div>
      </div>
    </div>
  )
}

export default Signup
