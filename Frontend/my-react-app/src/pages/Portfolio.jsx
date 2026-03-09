import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Sectors.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
const SECTOR_DESCRIPTIONS = {
  banking: 'Banks, NBFCs, and financial service providers.',
  finance: 'Financial services, lending, and related companies.',
  it: 'Technology and software services companies.',
  technology: 'Technology and software services companies.',
  pharma: 'Pharmaceuticals and healthcare-related companies.',
  healthcare: 'Pharmaceuticals and healthcare-related companies.',
  energy: 'Oil, gas, utilities, and energy infrastructure.',
  metals: 'Metal producers and mining-related companies.',
  automobile: 'Automakers and auto ancillary companies.',
  auto: 'Automakers and auto ancillary companies.',
  fmcg: 'Fast-moving consumer goods and daily essentials.',
  consumer: 'Consumer products and discretionary spending.',
  telecom: 'Telecom and connectivity providers.',
  realty: 'Real estate and related businesses.',
  infrastructure: 'Construction, infrastructure, and capital goods.',
}
const SECTOR_INSIGHTS = {
  energy: {
    title: 'Energy',
    description: 'Energy earnings track crude prices, refining spreads, demand cycles, and policy decisions.',
    keyDrivers: ['Crude and gas prices', 'Refining / marketing margins', 'Power demand and tariffs', 'Capex and capacity additions'],
    trackMetrics: ['GRMs (refiners)', 'Realizations and lifting costs', 'Net debt / EBITDA', 'Capacity utilization'],
  },
  banking: {
    title: 'Banking',
    description: 'Banks are driven by credit growth, deposit franchise strength, asset quality, and rate cycles.',
    keyDrivers: ['Loan growth and mix', 'NIMs and CASA ratio', 'Asset quality (GNPA/NNPA)', 'Credit costs and recoveries'],
    trackMetrics: ['NIM', 'GNPA / NNPA', 'ROA / ROE', 'Capital adequacy (CAR)'],
  },
  pharma: {
    title: 'Pharma',
    description: 'Pharma performance depends on approvals, pricing, product mix, and regulatory outcomes.',
    keyDrivers: ['USFDA approvals and observations', 'Price erosion vs launches', 'API input costs', 'Currency movement'],
    trackMetrics: ['R&D spend', 'Gross margin', 'ANDAs / pipeline', 'Receivables days'],
  },
  auto: {
    title: 'Auto',
    description: 'Auto demand tracks macro cycles, fuel prices, and product refresh, while margins depend on commodity costs.',
    keyDrivers: ['Volume growth', 'Model launches', 'Commodity costs', 'Export demand'],
    trackMetrics: ['EBITDA margin', 'Inventory days', 'Market share', 'Net cash / debt'],
  },
  fmcg: {
    title: 'FMCG',
    description: 'FMCG businesses are shaped by rural/urban demand, pricing power, and input cost inflation.',
    keyDrivers: ['Volume growth', 'Pricing and mix', 'Raw material inflation', 'Distribution strength'],
    trackMetrics: ['Operating margin', 'Ad spend', 'Working capital', 'Premiumization mix'],
  },
  it: {
    title: 'IT',
    description: 'IT services depend on global tech budgets, deal wins, utilization, and currency movement.',
    keyDrivers: ['Deal wins and pipeline', 'Utilization and attrition', 'Pricing and mix', 'USD/INR movement'],
    trackMetrics: ['Revenue growth', 'Operating margin', 'Attrition', 'Order book / TCV'],
  },
  metals: {
    title: 'Metals',
    description: 'Metals are cyclical and tied to global commodity prices, capacity, and demand from infra and autos.',
    keyDrivers: ['Global prices', 'Input costs (coal/power)', 'Capacity and utilization', 'Export demand'],
    trackMetrics: ['Realizations', 'EBITDA/ton', 'Net debt', 'Inventory'],
  },
}
const SECTOR_ORDER = ['pharma', 'banking', 'auto', 'energy', 'fmcg', 'it', 'metals']

function Portfolio() {
  const navigate = useNavigate()
  const [sectors, setSectors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedSector, setSelectedSector] = useState('')
  const sectorNames = useMemo(() => {
    return [...new Set(sectors.filter(Boolean))]
  }, [sectors])
  const sortedSectorNames = useMemo(() => {
    const rank = (value) => {
      const normalized = String(value || '').toLowerCase().trim()
      const idx = SECTOR_ORDER.indexOf(normalized)
      return idx === -1 ? 999 : idx
    }

    const sorted = [...sectorNames].sort((a, b) => {
      const ra = rank(a)
      const rb = rank(b)
      if (ra !== rb) return ra - rb
      return String(a).localeCompare(String(b))
    })

    const normalizedPresent = new Set(sorted.map((s) => String(s).toLowerCase().trim()))
    const missingDefaults = SECTOR_ORDER.filter((key) => !normalizedPresent.has(key))
    return [...sorted, ...missingDefaults]
  }, [sectorNames])
  const normalizedSelectedSector = useMemo(() => String(selectedSector || '').toLowerCase().trim(), [selectedSector])
  const selectedInsights = useMemo(() => {
    return SECTOR_INSIGHTS[normalizedSelectedSector] || null
  }, [normalizedSelectedSector])
  const sectorRouteName = normalizedSelectedSector || 'banking'

  function extractSectorNames(result) {
    const rows = Array.isArray(result?.data) ? result.data : []
    const sectorSet = new Set()

    for (const item of rows) {
      const value = String(item?.sector || '').trim()
      if (value) sectorSet.add(value)
    }

    return [...sectorSet]
  }

  useEffect(() => {
    const controller = new AbortController()

    async function loadSectors() {
      setLoading(true)
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
        const sectorList = extractSectorNames(result)
        setSectors(sectorList)
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Failed to fetch sectors')
        }
      } finally {
        setLoading(false)
      }
    }

    loadSectors()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!selectedSector && sortedSectorNames.length > 0) {
      setSelectedSector(sortedSectorNames[0])
    }
  }, [selectedSector, sortedSectorNames])

  if (loading) {
    return (
      <div className="card shadow-sm border-0">
        <div className="card-body py-5 text-center">
          <div className="spinner-border text-primary mb-3" role="status" />
          <p className="mb-0 text-secondary">Loading sectors overview...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="alert alert-danger shadow-sm" role="alert">
        <h5 className="alert-heading mb-2">Unable to load sectors</h5>
        <p className="mb-0">{error}</p>
      </div>
    )
  }

  return (
    <div className="sectors-page">
      <div className="sectors-hero mb-4">
        <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap">
          <div>
            <h3 className="mb-1">Sectors Overview</h3>
            <p className="mb-0 text-secondary">
              Select a sector to view insights and what to track.
            </p>
          </div>
        </div>

        <div className="sectors-pills mt-3">
          {sortedSectorNames.map((sector) => {
            const normalized = String(sector).toLowerCase().trim()
            const label = SECTOR_INSIGHTS[normalized]?.title || String(sector).toUpperCase()
            const active = sector === selectedSector
            return (
              <button
                key={`pill-${sector}`}
                type="button"
                className={`sectors-pill ${active ? 'active' : ''}`}
                onClick={() => setSelectedSector(sector)}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {sortedSectorNames.length === 0 ? (
        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <p className="text-secondary mb-0">No sector data available.</p>
          </div>
        </div>
      ) : (
        <div className="row g-4">
          <div className="col-12">
            <div
              className="card border-0 shadow-sm sectors-card sectors-card-clickable"
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/stock/${encodeURIComponent(sectorRouteName)}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  navigate(`/stock/${encodeURIComponent(sectorRouteName)}`)
                }
              }}
              aria-label={`Open stocks page for ${sectorRouteName}`}
            >
              <div className="card-body">
                <h5 className="mb-1">{(selectedInsights?.title || selectedSector || '').toString()} Insights</h5>
                <p className="small text-secondary mb-0">
                  {selectedInsights?.description ||
                    SECTOR_DESCRIPTIONS[normalizedSelectedSector] ||
                    'Sector overview and key factors to watch.'}
                </p>

                <div className="sectors-insights-grid mt-4">
                  <div>
                    <h6 className="text-uppercase text-secondary small mb-2">Key drivers</h6>
                    <ul className="sectors-list mb-0">
                      {(selectedInsights?.keyDrivers || []).length ? (
                        selectedInsights.keyDrivers.map((item) => <li key={`driver-${item}`}>{item}</li>)
                      ) : (
                        <li>Demand trends and pricing</li>
                      )}
                    </ul>
                  </div>

                  <div>
                    <h6 className="text-uppercase text-secondary small mb-2">Track metrics</h6>
                    <ul className="sectors-list mb-0">
                      {(selectedInsights?.trackMetrics || []).length ? (
                        selectedInsights.trackMetrics.map((item) => <li key={`metric-${item}`}>{item}</li>)
                      ) : (
                        <li>Revenue growth and margins</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Portfolio
