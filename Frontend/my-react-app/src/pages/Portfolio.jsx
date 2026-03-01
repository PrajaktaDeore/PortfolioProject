import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
const PORTFOLIO_CACHE_KEY = 'portfolio_stocks_cache_v1'
const PORTFOLIO_CACHE_TTL_MS = 2 * 60 * 1000

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

function formatMarketCap(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-'
  return Number(value).toLocaleString('en-IN')
}

function Portfolio() {
  const navigate = useNavigate()
  const [stocks, setStocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedSector, setSelectedSector] = useState('')
  const [modalSector, setModalSector] = useState('')
  const sectorNames = [...new Set(stocks.map((stock) => stock.sector).filter(Boolean))]
  const stocksBySector = useMemo(() => {
    return stocks.reduce((acc, stock) => {
      if (!stock?.sector) return acc
      if (!acc[stock.sector]) acc[stock.sector] = []
      acc[stock.sector].push(stock)
      return acc
    }, {})
  }, [stocks])

  function normalizeStocks(result) {
    return (result?.data || []).map((item) => ({
      ...item,
      sector: item?.sector || result?.sector || null,
    }))
  }

  useEffect(() => {
    const controller = new AbortController()

    async function getPortfolioList() {
      const cachedRaw = sessionStorage.getItem(PORTFOLIO_CACHE_KEY)
      if (cachedRaw) {
        try {
          const cached = JSON.parse(cachedRaw)
          const isFresh = Date.now() - (cached?.ts || 0) < PORTFOLIO_CACHE_TTL_MS
          if (isFresh && Array.isArray(cached?.stocks) && cached.stocks.length > 0) {
            setStocks(cached.stocks)
            setLoading(false)
          }
        } catch {
          // Ignore invalid cache payload and continue with API fetch.
        }
      }

      setError('')

      try {
        const response = await fetch(`${API_BASE_URL}/all-sector-stocks/`, {
          method: 'GET',
          signal: controller.signal,
        })

        if (!response.ok) {
          let detail = `Request failed with status ${response.status}`
          try {
            const errData = await response.json()
            detail = errData?.error || errData?.detail || detail
          } catch {
            // Keep the default status-based message if response body is not JSON.
          }
          throw new Error(detail)
        }

        const result = await response.json()
        const normalizedStocks = normalizeStocks(result)
        if (normalizedStocks.length > 0) {
          setStocks(normalizedStocks)
          sessionStorage.setItem(
            PORTFOLIO_CACHE_KEY,
            JSON.stringify({ ts: Date.now(), stocks: normalizedStocks }),
          )
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Failed to fetch portfolio list')
        }
      } finally {
        setLoading(false)
      }
    }

    getPortfolioList()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!selectedSector && sectorNames.length > 0) {
      setSelectedSector(sectorNames[0])
    }
  }, [selectedSector, sectorNames])

  if (loading) {
    return (
      <div className="card shadow-sm border-0">
        <div className="card-body py-5 text-center">
          <div className="spinner-border text-primary mb-3" role="status" />
          <p className="mb-0 text-secondary">Loading portfolio list...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="alert alert-danger shadow-sm" role="alert">
        <h5 className="alert-heading mb-2">Unable to load portfolio</h5>
        <p className="mb-0">{error}</p>
      </div>
    )
  }

  return (
    <div className="row g-4">
      <div className="col-12">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="mb-0">Sectors</h5>
          <span className="badge text-bg-primary">{sectorNames.length}</span>
        </div>

        {sectorNames.length === 0 ? (
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <p className="text-secondary mb-0">No sector data available.</p>
            </div>
          </div>
        ) : (
          <div className="row row-cols-1 row-cols-md-2 row-cols-lg-3 row-cols-xxl-4 g-3">
            {sectorNames.map((sector) => (
              <div className="col" key={sector}>
                <button
                  type="button"
                  className={`card border-0 shadow-sm w-100 h-100 text-start ${
                    selectedSector === sector ? 'border border-primary' : ''
                  }`}
                  onClick={() => {
                    setSelectedSector(sector)
                    setModalSector(sector)
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-center">
                      <h6 className="mb-0 text-capitalize">{sector}</h6>
                      <span className="badge text-bg-secondary">
                        {(stocksBySector[sector] || []).length} stocks
                      </span>
                    </div>
                    <p className="small text-secondary mb-0 mt-2">
                      Click to view stocks in modal
                    </p>
                  </div>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalSector ? (
        <>
          <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-lg modal-dialog-scrollable">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title text-capitalize">Stocks in {modalSector}</h5>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Close"
                    onClick={() => setModalSector('')}
                  />
                </div>
                <div className="modal-body">
                  {(stocksBySector[modalSector] || []).length === 0 ? (
                    <p className="text-secondary mb-0">No stocks available for this sector.</p>
                  ) : (
                    <div className="list-group">
                      {stocksBySector[modalSector].map((stock) => (
                        <button
                          key={stock.symbol}
                          type="button"
                          className="list-group-item list-group-item-action"
                          onClick={() => navigate('/stocks', { state: { stock } })}
                        >
                          <div className="d-flex w-100 justify-content-between align-items-start">
                            <div className="me-3">
                              <h6 className="mb-1">{stock.name || stock.symbol}</h6>
                              <small className="text-secondary">{stock.symbol}</small>
                            </div>
                            <div className="text-end">
                              <div className="fw-semibold">{formatPrice(stock.price)}</div>
                              <small
                                className={
                                  Number(stock.change_percent) >= 0 ? 'text-success' : 'text-danger'
                                }
                              >
                                {formatPercent(stock.change_percent)}
                              </small>
                            </div>
                          </div>
                          <div className="mt-2 small text-secondary">
                            Market Cap: {formatMarketCap(stock.market_cap)}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setModalSector('')}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop show" onClick={() => setModalSector('')} />
        </>
      ) : null}
    </div>
  )
}

export default Portfolio
