import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

function formatValue(value) {
  return value === null || value === undefined || value === '' ? '-' : value
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

    async function fetchStockFromAllSectorStocks() {
      setLoading(true)
      setError('')
      try {
        const response = await fetch(`${API_BASE_URL}/all-sector-stocks/`, {
          method: 'GET',
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`)
        }

        const result = await response.json()
        const list = result?.data || []
        const matchedStock = list.find((item) => item?.symbol === symbol)
        if (matchedStock) {
          setStock(matchedStock)
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

    fetchStockFromAllSectorStocks()
    return () => controller.abort()
  }, [symbol])

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
      </div>
    </div>
  )
}

export default Stocks
