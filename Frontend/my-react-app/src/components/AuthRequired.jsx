import { useLocation, useNavigate } from 'react-router-dom'

function AuthRequired({ title = 'Login Required', message = 'Please log in to continue.' }) {
  const navigate = useNavigate()
  const location = useLocation()

  function handleLogin() {
    navigate('/login', {
      state: {
        message,
        redirectTo: location.pathname + (location.search || ''),
      },
    })
  }

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-body py-5 text-center">
        <h4 className="mb-2">{title}</h4>
        <p className="text-secondary mb-4">{message}</p>
        <div className="d-flex justify-content-center gap-2 flex-wrap">
          <button type="button" className="btn btn-primary" onClick={handleLogin}>
            Login
          </button>
          <button type="button" className="btn btn-outline-primary" onClick={() => navigate('/sectors')}>
            Browse Sectors
          </button>
        </div>
      </div>
    </div>
  )
}

export default AuthRequired

