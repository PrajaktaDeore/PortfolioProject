import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import './Home.css'
import ChartModal from '../components/ChartModal'
import { useChartModal } from '../components/useChartModal'
import { isLoggedIn as checkLoggedIn } from '../utils/auth'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
 

function formatPrice(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-'
  return Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-'
  return `${Number(value).toFixed(2)}%`
}

 

function buildChartData(historyRows) {
  const points = (Array.isArray(historyRows) ? historyRows : [])
    .map((row) => ({
      date: row?.date || '',
      close: Number(row?.close),
    }))
    .filter((row) => Number.isFinite(row.close))

  if (points.length < 2) return null

  const width = 980
  const height = 320
  const left = 54
  const right = 18
  const top = 18
  const bottom = 38
  const chartWidth = width - left - right
  const chartHeight = height - top - bottom

  const minY = Math.min(...points.map((row) => row.close))
  const maxY = Math.max(...points.map((row) => row.close))
  const spanY = maxY - minY || 1

  const toX = (idx) => left + (idx / Math.max(points.length - 1, 1)) * chartWidth
  const toY = (value) => top + (1 - (value - minY) / spanY) * chartHeight
  const baseY = top + chartHeight

  const polyline = points
    .map((row, idx) => `${toX(idx).toFixed(2)},${toY(row.close).toFixed(2)}`)
    .join(' ')

  const firstX = toX(0)
  const lastX = toX(points.length - 1)
  const areaPoints = `${polyline} ${lastX.toFixed(2)},${baseY.toFixed(2)} ${firstX.toFixed(2)},${baseY.toFixed(2)}`

  return {
    width,
    height,
    left,
    top,
    chartWidth,
    chartHeight,
    minY,
    maxY,
    firstDate: points[0]?.date || '',
    lastDate: points[points.length - 1]?.date || '',
    polyline,
    areaPoints,
    baseY,
    gradientId: `chart-gradient-${Math.random().toString(36).substr(2, 9)}`,
  }
}

function Home() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [niftyHistory, setNiftyHistory] = useState([])
  const [niftyError, setNiftyError] = useState('')
  const { modal, close, openSvg } = useChartModal()
  const loggedIn = checkLoggedIn()
  const trackPerformancePath = loggedIn ? '/portfolio' : '/login'
  

  useEffect(() => {
    const controller = new AbortController()

    async function loadOverview() {
      setLoading(true)
      setError('')
      setNiftyError('')
      try {
        try {
          const niftyRes = await fetch(
            `${API_BASE_URL}/all-sector-stocks/timeseries/bitcoin/?period=3mo&interval=1d&symbol=${encodeURIComponent('^NSEI')}`,
            { signal: controller.signal },
          )
          if (!niftyRes.ok) {
            throw new Error(`Nifty history request failed with status ${niftyRes.status}`)
          }
          const niftyResult = await niftyRes.json()
          const history = Array.isArray(niftyResult?.data?.history) ? niftyResult.data.history : []
          setNiftyHistory(history)
        } catch (niftyErr) {
          if (niftyErr.name !== 'AbortError') {
            setNiftyHistory([])
            setNiftyError(niftyErr.message || 'Failed to load Nifty graph')
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Failed to load home overview')
        }
      } finally {
        setLoading(false)
      }
    }

    loadOverview()
    return () => controller.abort()
  }, [])

  if (loading) {
    return (
      <div className="card border-0 shadow-sm">
        <div className="card-body py-5 text-center">
          <div className="spinner-border text-primary mb-3" role="status" />
          <p className="mb-0 text-secondary">Loading home overview...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="alert alert-danger shadow-sm" role="alert">
        <h5 className="alert-heading mb-2">Unable to load home page data</h5>
        <p className="mb-0">{error}</p>
      </div>
    )
  }

  return (
    <div className="home-page d-flex flex-column gap-4 p-3 p-md-4 rounded animate-fade-in">
      <ChartModal {...modal} onClose={close} />
      <div className="card border-0 shadow-sm home-surface home-hero">
        <div className="card-body d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
          <div>
            <h3 className="mb-1">Welcome to Stock Analysis</h3>
            {!loggedIn && (
              <p className="mb-0 text-secondary">Login or create account to track your portfolio.</p>
            )}
          </div>
        </div>
      </div>

		      <div className="portfolio-guide-section py-4">
		        <h4 className="mb-4 text-center">Start Your Portfolio in 4 Simple Steps</h4>
		        <div className="row g-4">
          <div className="col-md-3">
            <Link to="/login" className="text-decoration-none h-100 d-block">
              <div className="card h-100 home-surface border-0 shadow-sm p-4 text-center clickable-guide-card">
                <div className="guide-icon-box mb-3 text-primary">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="8.5" cy="7" r="4"></circle>
                    <line x1="20" y1="8" x2="20" y2="14"></line>
                    <line x1="23" y1="11" x2="17" y2="11"></line>
                  </svg>
                </div>
                <h5 className="h6 mb-2">1. Register</h5>
                <p className="small text-secondary mb-0">Create your account to secure your financial data and start tracking.</p>
              </div>
            </Link>
          </div>
          <div className="col-md-3">
            <Link to="/stock" className="text-decoration-none h-100 d-block">
              <div className="card h-100 home-surface border-0 shadow-sm p-4 text-center clickable-guide-card">
                <div className="guide-icon-box mb-3 text-success">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12h14"></path>
                  </svg>
                </div>
                <h5 className="h6 mb-2">2. Add Stocks</h5>
                <p className="small text-secondary mb-0">Input your stock holdings, purchase prices, and quantities easily.</p>
              </div>
            </Link>
          </div>
          <div className="col-md-3">
            <Link to={trackPerformancePath} className="text-decoration-none h-100 d-block">
              <div className="card h-100 home-surface border-0 shadow-sm p-4 text-center clickable-guide-card">
                <div className="guide-icon-box mb-3 text-info">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="20" x2="12" y2="10"></line>
                    <line x1="18" y1="20" x2="18" y2="4"></line>
                    <line x1="6" y1="20" x2="6" y2="16"></line>
                  </svg>
                </div>
                <h5 className="h6 mb-2">3. Track Performance</h5>
                <p className="small text-secondary mb-0">Monitor your portfolio's daily performance with real-time updates.</p>
              </div>
            </Link>
          </div>
          <div className="col-md-3">
            <Link to="/timeseries" className="text-decoration-none h-100 d-block">
              <div className="card h-100 home-surface border-0 shadow-sm p-4 text-center clickable-guide-card">
                <div className="guide-icon-box mb-3 text-warning">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect>
                    <rect x="9" y="9" width="6" height="6"></rect>
                    <line x1="9" y1="1" x2="9" y2="4"></line>
                    <line x1="15" y1="1" x2="15" y2="4"></line>
                    <line x1="9" y1="20" x2="9" y2="23"></line>
                    <line x1="15" y1="20" x2="15" y2="23"></line>
                    <line x1="20" y1="9" x2="23" y2="9"></line>
                    <line x1="20" y1="15" x2="23" y2="15"></line>
                    <line x1="1" y1="9" x2="4" y2="9"></line>
                    <line x1="1" y1="15" x2="4" y2="15"></line>
                  </svg>
                </div>
                <h5 className="h6 mb-2">4. AI Insights</h5>
                <p className="small text-secondary mb-0">Leverage our machine learning models for forecasting and sector analysis.</p>
              </div>
            </Link>
          </div>
	        </div>
	      </div>

        <div className="card border-0 shadow-sm home-surface">
          <div className="card-header bg-transparent d-flex justify-content-between align-items-center">
            <h5 className="mb-0">NIFTY 50 Graph</h5>
            <span className="badge text-bg-primary">Last 3 Months</span>
          </div>
          <div className="card-body">
            {(() => {
              const chart = buildChartData(niftyHistory)
              if (!chart) {
                return <p className="text-secondary mb-0">{niftyError || 'No NIFTY graph data available.'}</p>
              }
              return (
                <svg
                  className="chart-svg"
                  viewBox={`0 0 ${chart.width} ${chart.height}`}
                  role="img"
                  aria-label="NIFTY 50 line graph"
                  onClick={(e) => openSvg(e, 'NIFTY 50 Graph')}
                  style={{ cursor: 'pointer' }}
                >
                  <defs>
                    <linearGradient id="homeNiftyArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-line-1)" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="var(--chart-line-1)" stopOpacity="0" />
                    </linearGradient>
                    <filter id="homeNiftyGlow" x="-30%" y="-30%" width="160%" height="160%">
                      <feGaussianBlur stdDeviation="2.6" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <line
                    x1={chart.left}
                    y1={chart.top}
                    x2={chart.left}
                    y2={chart.top + chart.chartHeight}
                    className="chart-axis"
                  />
                  <line
                    x1={chart.left}
                    y1={chart.top + chart.chartHeight}
                    x2={chart.left + chart.chartWidth}
                    y2={chart.top + chart.chartHeight}
                    className="chart-axis"
                  />
                  <polyline fill="url(#homeNiftyArea)" stroke="none" points={chart.areaPoints} />
                  <polyline
                    fill="none"
                    stroke="var(--chart-line-1)"
                    strokeWidth="2.8"
                    filter="url(#homeNiftyGlow)"
                    points={chart.polyline}
                  />
                  <text x={chart.left} y={chart.top - 6} fontSize="11" className="chart-text">
                    Close
                  </text>
                  <text
                    x={chart.left + chart.chartWidth - 46}
                    y={chart.top + chart.chartHeight + 24}
                    fontSize="11"
                    className="chart-text"
                  >
                    Date
                  </text>
                  <text x={chart.left} y={chart.top + 12} fontSize="10" className="chart-text-muted">
                    Max: {formatPrice(chart.maxY)}
                  </text>
                  <text
                    x={chart.left}
                    y={chart.top + chart.chartHeight - 8}
                    fontSize="10"
                    className="chart-text-muted"
                  >
                    Min: {formatPrice(chart.minY)}
                  </text>
                  <text x={chart.left} y={chart.top + chart.chartHeight + 24} fontSize="10" className="chart-text-muted">
                    {chart.firstDate}
                  </text>
                  <text
                    x={chart.left + chart.chartWidth - 60}
                    y={chart.top + chart.chartHeight + 24}
                    fontSize="10"
                    className="chart-text-muted"
                  >
                    {chart.lastDate}
                  </text>
                </svg>
              )
            })()}
          </div>
        </div>

	      
	    </div>
	  )
}

export default Home
