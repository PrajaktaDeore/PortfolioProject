import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { isLoggedIn } from '../utils/auth'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
const USER_PORTFOLIO_KEY = 'user_portfolio_stocks_v1'

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

function formatValue(value) {
  return value === null || value === undefined || value === '' ? '-' : value
}

function toNumber(value) {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function SectorStocks() {
  const navigate = useNavigate()
  const location = useLocation()
  const { sectorName } = useParams()
  const loggedIn = isLoggedIn()
  const [stocks, setStocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [crudLoading, setCrudLoading] = useState(false)
  const [crudMessage, setCrudMessage] = useState('')
  const [portfolioMessage, setPortfolioMessage] = useState('')
  const [showGoToPortfolio, setShowGoToPortfolio] = useState(false)
  const [showLoginToAdd, setShowLoginToAdd] = useState(false)
  const [portfolioAlertClass, setPortfolioAlertClass] = useState('alert-success')
  // Session-only UI state: resets when user navigates away and returns.
  const [sessionAddedSymbols, setSessionAddedSymbols] = useState(new Set())
  const [editingStockId, setEditingStockId] = useState(null)
  const [formSymbol, setFormSymbol] = useState('')
  const [formName, setFormName] = useState('')
  const [formPrice, setFormPrice] = useState('')
  const [selectedStock, setSelectedStock] = useState(null)
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState('mcap_desc')
  const normalizedSectorName = useMemo(
    () =>
      decodeURIComponent(sectorName || location.state?.sectorName || 'banking')
        .toLowerCase()
        .trim(),
    [sectorName, location.state?.sectorName],
  )
  const sectorTitle = useMemo(() => {
    const text = String(normalizedSectorName || '').trim()
    if (!text) return 'Sector'
    return text.charAt(0).toUpperCase() + text.slice(1)
  }, [normalizedSectorName])

  const stockStats = useMemo(() => {
    const total = stocks.length
    const changes = stocks.map((row) => toNumber(row?.change_percent)).filter((v) => v !== null)
    const avgChange = changes.length ? changes.reduce((sum, v) => sum + v, 0) / changes.length : null
    const gainers = stocks.filter((row) => (toNumber(row?.change_percent) ?? 0) > 0).length
    const losers = stocks.filter((row) => (toNumber(row?.change_percent) ?? 0) < 0).length
    const topGainer =
      [...stocks]
        .filter((row) => toNumber(row?.change_percent) !== null)
        .sort((a, b) => (toNumber(b.change_percent) ?? -Infinity) - (toNumber(a.change_percent) ?? -Infinity))[0] ||
      null
    const biggest =
      [...stocks]
        .filter((row) => toNumber(row?.market_cap) !== null)
        .sort((a, b) => (toNumber(b.market_cap) ?? -Infinity) - (toNumber(a.market_cap) ?? -Infinity))[0] || null

    return { total, avgChange, gainers, losers, topGainer, biggest }
  }, [stocks])

  const visibleStocks = useMemo(() => {
    const q = query.trim().toLowerCase()
    let rows = Array.isArray(stocks) ? stocks : []

    if (q) {
      rows = rows.filter((row) => {
        const symbol = String(row?.symbol || '').toLowerCase()
        const name = String(row?.name || '').toLowerCase()
        return symbol.includes(q) || name.includes(q)
      })
    }

    const sorted = [...rows]
    const sorters = {
      mcap_desc: (a, b) => (toNumber(b.market_cap) ?? -Infinity) - (toNumber(a.market_cap) ?? -Infinity),
      change_desc: (a, b) => (toNumber(b.change_percent) ?? -Infinity) - (toNumber(a.change_percent) ?? -Infinity),
      price_desc: (a, b) => (toNumber(b.price) ?? -Infinity) - (toNumber(a.price) ?? -Infinity),
      pe_asc: (a, b) => (toNumber(a.pe_ratio) ?? Infinity) - (toNumber(b.pe_ratio) ?? Infinity),
      symbol_asc: (a, b) => String(a?.symbol || '').localeCompare(String(b?.symbol || '')),
    }
    sorted.sort(sorters[sortBy] || sorters.mcap_desc)
    return sorted
  }, [stocks, query, sortBy])

  function resetForm() {
    setEditingStockId(null)
    setFormSymbol('')
    setFormName('')
    setFormPrice('')
  }

  function handleEditStock(item) {
    setEditingStockId(item.id)
    setFormSymbol(item.symbol || '')
    setFormName(item.name || '')
    setFormPrice(item.price ?? '')
  }

  function handleAddToPortfolio(item) {
    const symbolText = String(item?.symbol || '').trim().toUpperCase()
    if (!symbolText) {
      setCrudMessage('Cannot add stock without a valid symbol.')
      return
    }

    setPortfolioMessage('')
    setShowGoToPortfolio(false)
    setShowLoginToAdd(false)
    setPortfolioAlertClass('alert-success')

    if (!loggedIn) {
      setPortfolioAlertClass('alert-warning')
      setPortfolioMessage('Please log in to add stocks to your portfolio.')
      setShowLoginToAdd(true)
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } catch {
        // Ignore scroll failures.
      }
      return
    }

    let current = []
    try {
      const raw = localStorage.getItem(USER_PORTFOLIO_KEY)
      current = raw ? JSON.parse(raw) : []
      if (!Array.isArray(current)) current = []
    } catch {
      current = []
    }

    const existing = current.some(
      (row) => String(row?.symbol || '').trim().toUpperCase() === symbolText,
    )

    if (!existing) {
      const next = [
        {
          symbol: symbolText,
          name: item?.name || null,
          sector: item?.sector || normalizedSectorName,
          price: item?.price ?? null,
          pe_ratio: item?.pe_ratio ?? null,
          min_1y: item?.min_1y ?? null,
          max_1y: item?.max_1y ?? null,
          change_percent: item?.change_percent ?? null,
          market_cap: item?.market_cap ?? null,
          added_at: new Date().toISOString(),
        },
        ...current,
      ]
      try {
        localStorage.setItem(USER_PORTFOLIO_KEY, JSON.stringify(next))
        // Mark as added for this visit so button flips to "Added".
        setSessionAddedSymbols((prev) => {
          const updated = new Set(prev)
          updated.add(symbolText)
          return updated
        })
        setPortfolioAlertClass('alert-success')
        setPortfolioMessage(`${symbolText} added to portfolio.`)
        setShowGoToPortfolio(true)
        try {
          window.scrollTo({ top: 0, behavior: 'smooth' })
        } catch {
          // Ignore scroll failures (e.g., older browsers / restricted environments).
        }
      } catch {
        setPortfolioAlertClass('alert-danger')
        setPortfolioMessage('Unable to save to portfolio. Please check browser storage settings.')
        setShowGoToPortfolio(false)
      }
      return
    }

    setPortfolioAlertClass('alert-info')
    setPortfolioMessage(`${symbolText} is already in portfolio.`)
    setShowGoToPortfolio(true)
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      // Ignore scroll failures.
    }
  }

  function handleGoToPortfolio() {
    navigate('/portfolio', { state: { message: portfolioMessage || 'Opening portfolio.' } })
  }

  function handleLoginForPortfolio() {
    navigate('/login', { state: { message: 'Log in to add stocks to your portfolio.' } })
  }

  async function fetchMergedSectorStocks(signal) {
    const [crudResponse, sectorResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/all-sector-stocks/crud/stocks/`, {
        method: 'GET',
        signal,
      }),
      fetch(`${API_BASE_URL}/sector-stocks/sector-stocks/?sector=${encodeURIComponent(normalizedSectorName)}`, {
        method: 'GET',
        signal,
      }),
    ])

    if (!crudResponse.ok || !sectorResponse.ok) {
      throw new Error(
        `Request failed with status ${!crudResponse.ok ? crudResponse.status : sectorResponse.status}`,
      )
    }

    const crudResult = await crudResponse.json()
    const sectorResult = await sectorResponse.json()
    const crudStocks = Array.isArray(crudResult?.data) ? crudResult.data : []
    const sectorStocks = Array.isArray(sectorResult?.data) ? sectorResult.data : []
    const sectorBySymbol = new Map(sectorStocks.map((row) => [String(row?.symbol || '').toUpperCase(), row]))

    return crudStocks
      .filter((stock) => String(stock?.sector || '').toLowerCase() === normalizedSectorName)
      .map((stock) => {
        const sectorRow = sectorBySymbol.get(String(stock?.symbol || '').toUpperCase()) || {}
        return {
          ...stock,
          min_1y: sectorRow?.min_1y ?? stock?.min_1y ?? null,
          max_1y: sectorRow?.max_1y ?? stock?.max_1y ?? null,
        }
      })
  }

  useEffect(() => {
    const controller = new AbortController()

    async function fetchSectorStocks() {
      setLoading(true)
      setError('')
      setPortfolioMessage('')
      setShowGoToPortfolio(false)
      setShowLoginToAdd(false)
      setPortfolioAlertClass('alert-success')
      try {
        setSessionAddedSymbols(new Set())
        const mergedStocks = await fetchMergedSectorStocks(controller.signal)
        setStocks(mergedStocks)
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Failed to load sector stocks')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchSectorStocks()
    return () => controller.abort()
  }, [normalizedSectorName])

  async function fetchSectorStocksAgain() {
    setLoading(true)
    setError('')
    try {
      const mergedStocks = await fetchMergedSectorStocks()
      setStocks(mergedStocks)
    } catch (err) {
      setError(err.message || 'Failed to load sector stocks')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateOrUpdateStock() {
    if (!formSymbol.trim()) {
      setCrudMessage('Symbol is required.')
      return
    }

    setCrudLoading(true)
    setCrudMessage('')
    try {
      const payload = {
        symbol: formSymbol.trim().toUpperCase(),
        name: formName.trim() || null,
        sector: normalizedSectorName,
        price: formPrice === '' ? null : Number(formPrice),
      }
      const url = editingStockId
        ? `${API_BASE_URL}/all-sector-stocks/crud/stocks/${editingStockId}/`
        : `${API_BASE_URL}/all-sector-stocks/crud/stocks/`
      const method = editingStockId ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok && !editingStockId) {
        const detailText = String(result?.detail || '').toLowerCase()
        if (response.status === 400 && detailText.includes('already exists')) {
          const listResponse = await fetch(`${API_BASE_URL}/all-sector-stocks/crud/stocks/`, {
            method: 'GET',
          })
          const listResult = await listResponse.json().catch(() => ({}))
          if (!listResponse.ok) {
            throw new Error(listResult?.detail || `Request failed with status ${listResponse.status}`)
          }

          const existingRows = Array.isArray(listResult?.data) ? listResult.data : []
          const existingStock = existingRows.find(
            (item) => String(item?.symbol || '').toUpperCase() === payload.symbol,
          )
          if (!existingStock?.id) {
            throw new Error(result?.detail || 'Stock exists but could not resolve its record id.')
          }

          const patchResponse = await fetch(`${API_BASE_URL}/all-sector-stocks/crud/stocks/${existingStock.id}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
          const patchResult = await patchResponse.json().catch(() => ({}))
          if (!patchResponse.ok) {
            throw new Error(patchResult?.detail || `Request failed with status ${patchResponse.status}`)
          }

          setCrudMessage('Stock already existed, so it was updated successfully.')
          resetForm()
          await fetchSectorStocksAgain()
          return
        }
      }

      if (!response.ok) {
        throw new Error(result?.detail || `Request failed with status ${response.status}`)
      }

      setCrudMessage(editingStockId ? 'Stock updated successfully.' : 'Stock added successfully.')
      resetForm()
      await fetchSectorStocksAgain()
    } catch (err) {
      setCrudMessage(err.message || 'Failed to save stock')
    } finally {
      setCrudLoading(false)
    }
  }

  async function handleDeleteStock(stockId) {
    setCrudLoading(true)
    setCrudMessage('')
    try {
      const response = await fetch(`${API_BASE_URL}/all-sector-stocks/crud/stocks/${stockId}/`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error(`Delete failed with status ${response.status}`)
      }
      if (editingStockId === stockId) {
        resetForm()
      }
      setCrudMessage('Stock deleted successfully.')
      await fetchSectorStocksAgain()
    } catch (err) {
      setCrudMessage(err.message || 'Failed to delete stock')
    } finally {
      setCrudLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="card border-0 shadow-sm">
        <div className="card-body py-5 text-center">
          <div className="spinner-border text-primary mb-3" role="status" />
          <p className="mb-0 text-secondary">Loading sector stocks...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="alert alert-danger shadow-sm" role="alert">
        <h5 className="alert-heading mb-2">Unable to load sector stocks</h5>
        <p className="mb-3">{error}</p>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/sectors')}>
          Back to Sectors
        </button>
      </div>
    )
  }

  return (
    <div className="card border-0 shadow-sm animate-fade-in">
      <div className="card-header bg-white d-flex justify-content-between align-items-center">
        <div>
          <h4 className="mb-0">{sectorTitle} Stocks</h4>
          <small className="text-secondary">Analytics snapshot for the selected sector.</small>
        </div>
        <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => navigate('/sectors')}>
          Back to Sectors
        </button>
      </div>
      <div className="card-body">
        {loggedIn ? (
          <>
            <div className="row g-3 mb-3">
              <div className="col-12 col-md-4">
                <label className="form-label">Symbol</label>
                <input
                  type="text"
                  className="form-control"
                  value={formSymbol}
                  onChange={(e) => setFormSymbol(e.target.value)}
                  placeholder="e.g. HDFCBANK.NS"
                />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label">Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Company name"
                />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label">Price</label>
                <input
                  type="number"
                  className="form-control"
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="d-flex gap-2 mb-3">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCreateOrUpdateStock}
                disabled={crudLoading}
              >
                {editingStockId ? 'Edit Stock' : 'Add Stock'}
              </button>
              {editingStockId ? (
                <button type="button" className="btn btn-outline-secondary" onClick={resetForm}>
                  Cancel Edit
                </button>
              ) : null}
            </div>
            {crudMessage ? <div className="alert alert-info py-2">{crudMessage}</div> : null}
          </>
        ) : (
          <div className="alert alert-light border py-2" role="note">
            You can browse sector stocks without logging in. Log in to add stocks to your portfolio.
          </div>
        )}
	        {portfolioMessage ? (
	          <div className={`alert ${portfolioAlertClass} py-2 d-flex justify-content-between align-items-center flex-wrap gap-2`}>
	            <span>{portfolioMessage}</span>
            {showGoToPortfolio ? (
              <button type="button" className="btn btn-sm btn-outline-primary" onClick={handleGoToPortfolio}>
                Go to Portfolio
              </button>
            ) : null}
            {showLoginToAdd ? (
              <button type="button" className="btn btn-sm btn-outline-dark" onClick={handleLoginForPortfolio}>
                Login
              </button>
            ) : null}
          </div>
	        ) : null}

          <div className="app-kpi-grid mb-3">
            <div className="app-kpi-card">
              <div className="app-kpi-label">Stocks</div>
              <p className="app-kpi-value">{stockStats.total}</p>
              <p className="app-kpi-sub">
                {stockStats.gainers} gainers · {stockStats.losers} losers
              </p>
            </div>
            <div className="app-kpi-card">
              <div className="app-kpi-label">Avg Change</div>
              <p className={`app-kpi-value ${Number(stockStats.avgChange) >= 0 ? 'text-success' : 'text-danger'}`}>
                {formatPercent(stockStats.avgChange)}
              </p>
              <p className="app-kpi-sub">Across all stocks in sector</p>
            </div>
            <div className="app-kpi-card">
              <div className="app-kpi-label">Top Gainer</div>
              <p className="app-kpi-value">{stockStats.topGainer?.symbol || '-'}</p>
              <p className="app-kpi-sub">
                {stockStats.topGainer ? formatPercent(stockStats.topGainer.change_percent) : '-'}
              </p>
            </div>
            <div className="app-kpi-card">
              <div className="app-kpi-label">Largest</div>
              <p className="app-kpi-value">{stockStats.biggest?.symbol || '-'}</p>
              <p className="app-kpi-sub">
                MCap: {stockStats.biggest ? formatMarketCap(stockStats.biggest.market_cap) : '-'}
              </p>
            </div>
          </div>

          <div className="row g-2 align-items-end mb-3">
            <div className="col-12 col-md-7">
              <label className="form-label mb-1">Search</label>
              <input
                type="text"
                className="form-control"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by symbol or company name..."
              />
            </div>
            <div className="col-12 col-md-5">
              <label className="form-label mb-1">Sort</label>
              <select className="form-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="mcap_desc">Market cap (high → low)</option>
                <option value="change_desc">Change % (high → low)</option>
                <option value="price_desc">Price (high → low)</option>
                <option value="pe_asc">P/E (low → high)</option>
                <option value="symbol_asc">Symbol (A → Z)</option>
              </select>
            </div>
          </div>

	        {stocks.length === 0 ? (
	          <p className="text-secondary mb-0">No stocks found for this sector.</p>
	        ) : (
            visibleStocks.length === 0 ? (
              <p className="text-secondary mb-0">No results match your search.</p>
            ) : (
	            <div className="table-responsive">
	              <table className="table table-striped table-hover align-middle mb-0">
	              <thead>
	                <tr>
	                  <th>Symbol</th>
	                  <th>Name</th>
	                  <th>Price</th>
                  <th>Min</th>
                  <th>Max</th>
                  <th>Change</th>
                  <th>Market Cap</th>
                  <th>Actions</th>
                </tr>
	              </thead>
	              <tbody>
	                {visibleStocks.map((stock) => (
	                  <tr key={stock.id || stock.symbol}>
	                    <td>{stock.symbol}</td>
	                    <td>{stock.name || '-'}</td>
	                    <td>{formatPrice(stock.price)}</td>
	                    <td>{formatPrice(stock.min_1y)}</td>
                    <td>{formatPrice(stock.max_1y)}</td>
                    <td className={Number(stock.change_percent) >= 0 ? 'text-success' : 'text-danger'}>
                      {formatPercent(stock.change_percent)}
                    </td>
                    <td>{formatMarketCap(stock.market_cap)}</td>
                    <td className="d-flex gap-2 align-items-center flex-nowrap app-action-cell">
                      {(() => {
                        const symbolKey = String(stock?.symbol || '').trim().toUpperCase()
                        const inPortfolio = loggedIn && symbolKey ? sessionAddedSymbols.has(symbolKey) : false
                        return (
                          <>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary app-action-btn text-nowrap"
                              onClick={() => setSelectedStock(stock)}
                            >
                              View
                            </button>
                            <button
                              type="button"
                              className={`btn btn-sm ${inPortfolio ? 'btn-success' : 'btn-primary'} app-action-btn app-portfolio-btn text-nowrap`}
                              onClick={() => handleAddToPortfolio(stock)}
                              disabled={inPortfolio}
                            >
                              {inPortfolio ? 'Added' : 'Add To Portfolio'}
                            </button>
                            {loggedIn ? (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-secondary app-action-btn text-nowrap"
                                  onClick={() => handleEditStock(stock)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger app-action-btn text-nowrap"
                                  onClick={() => handleDeleteStock(stock.id)}
                                  disabled={crudLoading || !stock.id}
                                >
                                  Delete
                                </button>
                              </>
                            ) : null}
                          </>
                        )
                      })()}
	                    </td>
	                  </tr>
	                ))}
	              </tbody>
	            </table>
	          </div>
            )
	        )}
      </div>

      {selectedStock ? (
        <>
          <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-lg modal-dialog-scrollable">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Stock Information</h5>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Close"
                    onClick={() => setSelectedStock(null)}
                  />
                </div>
                <div className="modal-body">
                  <div className="table-responsive">
                    <table className="table table-striped align-middle mb-0">
                      <tbody>
                        <tr>
                          <th style={{ width: '220px' }}>Name</th>
                          <td>{formatValue(selectedStock.name)}</td>
                        </tr>
                        <tr>
                          <th>Symbol</th>
                          <td>{formatValue(selectedStock.symbol)}</td>
                        </tr>
                        <tr>
                          <th>Sector</th>
                          <td>{formatValue(selectedStock.sector)}</td>
                        </tr>
                        <tr>
                          <th>Price</th>
                          <td>{formatPrice(selectedStock.price)}</td>
                        </tr>
                        <tr>
                          <th>Min (1Y)</th>
                          <td>{formatPrice(selectedStock.min_1y)}</td>
                        </tr>
                        <tr>
                          <th>Max (1Y)</th>
                          <td>{formatPrice(selectedStock.max_1y)}</td>
                        </tr>
                        <tr>
                          <th>Change %</th>
                          <td>{formatPercent(selectedStock.change_percent)}</td>
                        </tr>
                        <tr>
                          <th>Market Cap</th>
                          <td>{formatMarketCap(selectedStock.market_cap)}</td>
                        </tr>
                        <tr>
                          <th>P/E Ratio</th>
                          <td>{formatValue(selectedStock.pe_ratio)}</td>
                        </tr>
                        <tr>
                          <th>Currency</th>
                          <td>{formatValue(selectedStock.currency)}</td>
                        </tr>
                        <tr>
                          <th>Exchange</th>
                          <td>{formatValue(selectedStock.exchange)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setSelectedStock(null)}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop show" onClick={() => setSelectedStock(null)} />
        </>
      ) : null}
    </div>
  )
}

export default SectorStocks
