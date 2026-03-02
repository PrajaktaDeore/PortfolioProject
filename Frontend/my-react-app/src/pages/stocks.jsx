import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

function formatValue(value) {
  return value === null || value === undefined || value === '' ? '-' : value
}

function formatChartLabel(isoDate) {
  if (!isoDate) return ''
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function PeRatioChart({ history, symbol, currentPeRatio }) {
  if (!history.length) {
    return (
      <div className="alert alert-light border mb-0" role="status">
        P/E history is not available yet for {symbol || 'this stock'}.
      </div>
    )
  }

  if (history.length < 2) {
    return (
      <div className="alert alert-light border mb-0" role="status">
        Not enough history to draw a trend for {symbol || 'this stock'}. Current P/E: {formatValue(currentPeRatio)}
      </div>
    )
  }

  const width = 760
  const height = 260
  const padding = 36
  const min = Math.min(...history.map((point) => point.pe_ratio))
  const max = Math.max(...history.map((point) => point.pe_ratio))
  const span = max - min || 1

  const points = history
    .map((point, index) => {
      const x = padding + (index / Math.max(history.length - 1, 1)) * (width - padding * 2)
      const y = height - padding - ((point.pe_ratio - min) / span) * (height - padding * 2)
      return `${x},${y}`
    })
    .join(' ')

  const latest = history[history.length - 1]

  return (
    <div className="border rounded p-3">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h6 className="mb-0">P/E Ratio Trend</h6>
        <small className="text-secondary">
          Latest: <strong>{latest.pe_ratio}</strong>
        </small>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label="P/E ratio trend chart">
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#adb5bd" />
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="#adb5bd"
        />
        <polyline fill="none" stroke="#0d6efd" strokeWidth="3" points={points} />
        {history.map((point, index) => {
          const x = padding + (index / Math.max(history.length - 1, 1)) * (width - padding * 2)
          const y = height - padding - ((point.pe_ratio - min) / span) * (height - padding * 2)
          return <circle key={`${point.captured_at}-${index}`} cx={x} cy={y} r="3.5" fill="#0d6efd" />
        })}
      </svg>
      <div className="d-flex justify-content-between mt-2">
        <small className="text-secondary">{formatChartLabel(history[0]?.captured_at)}</small>
        <small className="text-secondary">{formatChartLabel(latest?.captured_at)}</small>
      </div>
    </div>
  )
}

function Stocks() {
  const location = useLocation()
  const navigate = useNavigate()
  const stateStock = location.state?.stock
  const [stock, setStock] = useState(stateStock || null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const symbol = useMemo(() => stateStock?.symbol || '', [stateStock?.symbol])

  useEffect(() => {
    if (!symbol) {
      setLoading(false)
      return
    }

    const controller = new AbortController()

    async function fetchStockDetail() {
      setLoading(true)
      setError('')
      try {
        const response = await fetch(`${API_BASE_URL}/all-sector-stocks/stock/${symbol}/`, {
          method: 'GET',
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`)
        }

        const result = await response.json()
        if (result?.symbol) {
          setStock(result)
        } else {
          setError(`Stock ${symbol} not found in API response.`)
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Failed to fetch stock data')
          setStock(stateStock || null)
        }
      } finally {
        setLoading(false)
      }
    }

    fetchStockDetail()
    return () => controller.abort()
  }, [symbol, stateStock])

  if (loading) {
    return (
      <div className="card border-0 shadow-sm">
        <div className="card-body text-center py-5">
          <div className="spinner-border text-primary mb-3" role="status" />
          <p className="mb-0 text-secondary">Loading stock details...</p>
        </div>
      </div>
    )
  }

  if (error && !stock) {
    return (
      <div className="alert alert-danger shadow-sm" role="alert">
        <h5 className="alert-heading mb-2">Unable to load stock details</h5>
        <p className="mb-3">{error}</p>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/portfolio')}>
          Back to Portfolio
        </button>
      </div>
    )
  }

  if (!stock) {
    return (
      <div className="card border-0 shadow-sm">
        <div className="card-body text-center py-5">
          <h3 className="mb-3">Stock Details</h3>
          <p className="text-secondary mb-4">
            No stock details found. Please select a stock from portfolio page.
          </p>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/portfolio')}>
            Back to Portfolio
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-header bg-white d-flex justify-content-between align-items-center">
        <h4 className="mb-0">Stock Details</h4>
        <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => navigate('/portfolio')}>
          Back to Portfolio
        </button>
      </div>
      <div className="card-body">
        {error ? (
          <div className="alert alert-warning py-2" role="alert">
            Showing last available data. {error}
          </div>
        ) : null}
        <div className="table-responsive">
          <table className="table table-striped align-middle mb-0">
            <tbody>
              <tr>
                <th style={{ width: '220px' }}>Name</th>
                <td>{formatValue(stock.name)}</td>
              </tr>
              <tr>
                <th>Symbol</th>
                <td className="fw-semibold">{formatValue(stock.symbol)}</td>
              </tr>
              <tr>
                <th>Sector</th>
                <td>
                  <span className="badge text-bg-info">{formatValue(stock.sector)}</span>
                </td>
              </tr>
              <tr>
                <th>Price</th>
                <td>{formatValue(stock.price)}</td>
              </tr>
              <tr>
                <th>Change %</th>
                <td>{formatValue(stock.change_percent)}</td>
              </tr>
              <tr>
                <th>Market Cap</th>
                <td>{formatValue(stock.market_cap)}</td>
              </tr>
              <tr>
                <th>P/E Ratio</th>
                <td>{formatValue(stock.pe_ratio)}</td>
              </tr>
              <tr>
                <th>Currency</th>
                <td>{formatValue(stock.currency)}</td>
              </tr>
              <tr>
                <th>Exchange</th>
                <td>{formatValue(stock.exchange)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-4">
          <PeRatioChart
            symbol={stock?.symbol}
            currentPeRatio={stock?.pe_ratio}
            history={(stock?.pe_history || [])
              .filter((point) => point && point.pe_ratio !== null && point.pe_ratio !== undefined)
              .map((point) => ({ ...point, pe_ratio: Number(point.pe_ratio) }))
              .filter((point) => !Number.isNaN(point.pe_ratio))}
          />
        </div>
      </div>
    </div>
  )
}

export default Stocks
