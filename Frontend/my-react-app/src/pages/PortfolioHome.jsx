import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import ChartModal from '../components/ChartModal'
import { useChartModal } from '../components/useChartModal'
import { normalizePortfolioSymbol, readPortfolioRows, writePortfolioRows } from '../utils/portfolioStorage'

const USER_PORTFOLIO_KEY = 'user_portfolio_stocks_v1'
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

function formatMarketCap(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-'
  return Number(value).toLocaleString('en-IN')
}

function toNumber(value) {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function calculateCorrelation(xs, ys) {
  if (!Array.isArray(xs) || !Array.isArray(ys) || xs.length !== ys.length || xs.length < 2) return null
  const n = xs.length
  const meanX = xs.reduce((sum, value) => sum + value, 0) / n
  const meanY = ys.reduce((sum, value) => sum + value, 0) / n

  let numerator = 0
  let varX = 0
  let varY = 0

  for (let i = 0; i < n; i += 1) {
    const dx = xs[i] - meanX
    const dy = ys[i] - meanY
    numerator += dx * dy
    varX += dx * dx
    varY += dy * dy
  }

  const denominator = Math.sqrt(varX * varY)
  if (!denominator) return null
  return numerator / denominator
}

function buildGoldSilverChartSvg(rows, correlation) {
  const width = 1000
  const height = 520
  const padLeft = 70
  const padRight = 80
  const padTop = 52
  const padBottom = 70
  const chartWidth = width - padLeft - padRight
  const chartHeight = height - padTop - padBottom

  const goldValues = rows.map((row) => row.gold_close)
  const silverValues = rows.map((row) => row.silver_close)
  const goldMin = Math.min(...goldValues)
  const goldMax = Math.max(...goldValues)
  const silverMin = Math.min(...silverValues)
  const silverMax = Math.max(...silverValues)
  const goldSpan = goldMax - goldMin || 1
  const silverSpan = silverMax - silverMin || 1
  const lastIndex = Math.max(rows.length - 1, 1)

  const toX = (index) => padLeft + (index / lastIndex) * chartWidth
  const toGoldY = (value) => padTop + (1 - (value - goldMin) / goldSpan) * chartHeight
  const toSilverY = (value) => padTop + (1 - (value - silverMin) / silverSpan) * chartHeight

  const goldPoints = rows.map((row, index) => `${toX(index).toFixed(2)},${toGoldY(row.gold_close).toFixed(2)}`).join(' ')
  const silverPoints = rows.map((row, index) => `${toX(index).toFixed(2)},${toSilverY(row.silver_close).toFixed(2)}`).join(' ')

  const startDate = rows[0]?.date || ''
  const endDate = rows[rows.length - 1]?.date || ''
  const corrText = correlation === null ? 'N/A' : correlation.toFixed(4)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>
  <text x="${padLeft}" y="24" font-family="Arial" font-size="20" fill="#111827">Gold vs Silver Price (5Y)</text>
  <text x="${padLeft}" y="44" font-family="Arial" font-size="13" fill="#374151">Pearson correlation: ${corrText}</text>
  <text x="${padLeft + chartWidth / 2}" y="${height - 6}" text-anchor="middle" font-family="Arial" font-size="12" fill="#374151">Date (Time)</text>
  <text x="20" y="${padTop + chartHeight / 2}" transform="rotate(-90 20 ${padTop + chartHeight / 2})" text-anchor="middle" font-family="Arial" font-size="12" fill="#92400e">Gold Price (USD)</text>
  <text x="${width - 14}" y="${padTop + chartHeight / 2}" transform="rotate(-90 ${width - 14} ${padTop + chartHeight / 2})" text-anchor="middle" font-family="Arial" font-size="12" fill="#334155">Silver Price (USD)</text>
  <line x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${padTop + chartHeight}" stroke="#9ca3af"/>
  <line x1="${padLeft + chartWidth}" y1="${padTop}" x2="${padLeft + chartWidth}" y2="${padTop + chartHeight}" stroke="#9ca3af"/>
  <line x1="${padLeft}" y1="${padTop + chartHeight}" x2="${padLeft + chartWidth}" y2="${padTop + chartHeight}" stroke="#9ca3af"/>
  <polyline fill="none" stroke="#d97706" stroke-width="2.5" points="${goldPoints}"/>
  <polyline fill="none" stroke="#475569" stroke-width="2.5" points="${silverPoints}"/>
  <text x="${padLeft - 8}" y="${padTop - 8}" text-anchor="end" font-family="Arial" font-size="11" fill="#92400e">Gold max ${goldMax.toFixed(2)}</text>
  <text x="${padLeft - 8}" y="${padTop + chartHeight + 14}" text-anchor="end" font-family="Arial" font-size="11" fill="#92400e">Gold min ${goldMin.toFixed(2)}</text>
  <text x="${padLeft + chartWidth + 8}" y="${padTop - 8}" font-family="Arial" font-size="11" fill="#334155">Silver max ${silverMax.toFixed(2)}</text>
  <text x="${padLeft + chartWidth + 8}" y="${padTop + chartHeight + 14}" font-family="Arial" font-size="11" fill="#334155">Silver min ${silverMin.toFixed(2)}</text>
  <text x="${padLeft}" y="${height - 18}" font-family="Arial" font-size="12" fill="#4b5563">${startDate}</text>
  <text x="${padLeft + chartWidth - 85}" y="${height - 18}" font-family="Arial" font-size="12" fill="#4b5563">${endDate}</text>
  <rect x="${padLeft}" y="${height - 46}" width="12" height="12" fill="#d97706"/>
  <text x="${padLeft + 18}" y="${height - 36}" font-family="Arial" font-size="12" fill="#111827">Gold (left axis)</text>
  <rect x="${padLeft + 150}" y="${height - 46}" width="12" height="12" fill="#475569"/>
  <text x="${padLeft + 168}" y="${height - 36}" font-family="Arial" font-size="12" fill="#111827">Silver (right axis)</text>
</svg>`
}

function buildRegression(rows) {
  const points = rows
    .map((row) => ({
      symbol: row.symbol,
      x: toNumber(row.min_1y),
      y: toNumber(row.price),
    }))
    .filter((row) => row.x !== null && row.y !== null)

  if (points.length < 2) {
    return null
  }

  const n = points.length
  const meanX = points.reduce((sum, p) => sum + p.x, 0) / n
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / n

  let numerator = 0
  let denominator = 0
  for (const p of points) {
    numerator += (p.x - meanX) * (p.y - meanY)
    denominator += (p.x - meanX) ** 2
  }

  if (!denominator) {
    return null
  }

  const slope = numerator / denominator
  const intercept = meanY - slope * meanX

  const withPrediction = points.map((p) => {
    const predictedY = intercept + slope * p.x
    return {
      ...p,
      predictedY,
      residual: p.y - predictedY,
    }
  })

  const ssRes = withPrediction.reduce((sum, p) => sum + p.residual ** 2, 0)
  const ssTot = withPrediction.reduce((sum, p) => sum + (p.y - meanY) ** 2, 0)
  const r2 = ssTot ? 1 - ssRes / ssTot : 0

  return {
    points: withPrediction,
    slope,
    intercept,
    r2,
  }
}

function buildDiscountRows(rows) {
  return rows
    .map((row) => {
      const max1y = toNumber(row.max_1y)
      const price = toNumber(row.price)
      if (max1y === null || price === null || max1y <= 0) return null

      const discountPercent = ((max1y - price) / max1y) * 100
      return {
        symbol: row.symbol,
        name: row.name,
        sector: row.sector,
        price,
        max1y,
        discountPercent,
      }
    })
    .filter(Boolean)
}

function buildPriceComparisonRows(rows) {
  return rows
    .map((row) => {
      const min1y = toNumber(row.min_1y)
      const current = toNumber(row.price)
      const max1y = toNumber(row.max_1y)
      if (min1y === null || current === null || max1y === null) return null
      return {
        symbol: row.symbol,
        name: row.name,
        sector: row.sector,
        min1y,
        current,
        max1y,
      }
    })
    .filter(Boolean)
}

function buildOpportunityRows(rows) {
  return rows
    .map((row) => {
      const min1y = toNumber(row.min_1y)
      const current = toNumber(row.price)
      const max1y = toNumber(row.max_1y)
      if (min1y === null || current === null || max1y === null) return null
      if (max1y <= min1y) return null

      const rawScore = ((max1y - current) / (max1y - min1y)) * 100
      const score = Math.max(0, Math.min(100, rawScore))
      return {
        symbol: row.symbol,
        name: row.name,
        sector: row.sector,
        min1y,
        current,
        max1y,
        score,
      }
    })
    .filter(Boolean)
}

function buildPeRatioRows(rows) {
  return rows
    .map((row) => {
      const peRatio = toNumber(row.pe_ratio)
      if (peRatio === null) return null
      return {
        symbol: row.symbol,
        name: row.name,
        sector: row.sector,
        peRatio,
      }
    })
    .filter(Boolean)
}

function buildPeDiscountRows(rows) {
  return rows
    .map((row) => {
      const pe = toNumber(row.pe_ratio)
      const max1y = toNumber(row.max_1y)
      const price = toNumber(row.price)
      if (pe === null || max1y === null || price === null || max1y <= 0) return null
      const discount = ((max1y - price) / max1y) * 100
      return {
        symbol: row.symbol,
        x: pe,
        y: discount,
      }
    })
    .filter(Boolean)
}

function buildPeOpportunityRows(rows) {
  return rows
    .map((row) => {
      const pe = toNumber(row.pe_ratio)
      const min1y = toNumber(row.min_1y)
      const current = toNumber(row.price)
      const max1y = toNumber(row.max_1y)
      if (pe === null || min1y === null || current === null || max1y === null) return null
      if (max1y <= min1y) return null
      const rawScore = ((max1y - current) / (max1y - min1y)) * 100
      const score = Math.max(0, Math.min(100, rawScore))
      return {
        symbol: row.symbol,
        x: pe,
        y: score,
      }
    })
    .filter(Boolean)
}

function runKMeans(points, requestedK = 3, iterations = 20) {
  if (!points.length) return null
  const k = Math.max(1, Math.min(requestedK, points.length))

  // Deterministic init from sorted points keeps clusters stable across renders.
  const sorted = [...points].sort((a, b) => String(a.symbol).localeCompare(String(b.symbol)))
  let centroids = sorted.slice(0, k).map((p) => ({ x: p.x, y: p.y }))
  let assignment = new Array(points.length).fill(0)

  for (let iter = 0; iter < iterations; iter += 1) {
    // Assign points to nearest centroid.
    assignment = points.map((p) => {
      let bestIndex = 0
      let bestDist = Number.POSITIVE_INFINITY
      centroids.forEach((c, idx) => {
        const dist = (p.x - c.x) ** 2 + (p.y - c.y) ** 2
        if (dist < bestDist) {
          bestDist = dist
          bestIndex = idx
        }
      })
      return bestIndex
    })

    // Recompute centroids.
    const next = centroids.map((_, idx) => {
      const members = points.filter((_, pointIdx) => assignment[pointIdx] === idx)
      if (!members.length) return centroids[idx]
      const cx = members.reduce((sum, p) => sum + p.x, 0) / members.length
      const cy = members.reduce((sum, p) => sum + p.y, 0) / members.length
      return { x: cx, y: cy }
    })
    centroids = next
  }

  return {
    k,
    centroids,
    assignment,
    points: points.map((p, idx) => ({ ...p, cluster: assignment[idx] })),
  }
}

function dot(a, b) {
  return a.reduce((sum, value, idx) => sum + value * b[idx], 0)
}

function norm(v) {
  return Math.sqrt(dot(v, v))
}

function normalize(v) {
  const n = norm(v)
  if (!n) return v.map(() => 0)
  return v.map((x) => x / n)
}

function matVecMul(mat, vec) {
  return mat.map((row) => dot(row, vec))
}

function powerIteration(matrix, iterations = 40) {
  const n = matrix.length
  let vec = normalize(Array.from({ length: n }, (_, idx) => (idx === 0 ? 1 : 0.5)))
  for (let i = 0; i < iterations; i += 1) {
    const mv = matVecMul(matrix, vec)
    vec = normalize(mv)
  }
  const mv = matVecMul(matrix, vec)
  const eigenvalue = dot(vec, mv)
  return { eigenvalue, eigenvector: vec }
}

function deflateMatrix(matrix, eigenvalue, eigenvector) {
  return matrix.map((row, i) =>
    row.map((value, j) => value - eigenvalue * eigenvector[i] * eigenvector[j]),
  )
}

function buildPcaProjection(rows) {
  const enriched = rows
    .map((row) => {
      const price = toNumber(row.price)
      const min1y = toNumber(row.min_1y)
      const max1y = toNumber(row.max_1y)
      if (price === null || min1y === null || max1y === null) return null
      return {
        symbol: row.symbol,
        features: [price, min1y, max1y],
      }
    })
    .filter(Boolean)

  if (enriched.length < 2) return null

  const featureCount = enriched[0].features.length
  const means = Array.from({ length: featureCount }, (_, col) =>
    enriched.reduce((sum, row) => sum + row.features[col], 0) / enriched.length,
  )

  const stds = Array.from({ length: featureCount }, (_, col) => {
    const variance =
      enriched.reduce((sum, row) => {
        const d = row.features[col] - means[col]
        return sum + d * d
      }, 0) / Math.max(enriched.length - 1, 1)
    const s = Math.sqrt(variance)
    return s || 1
  })

  const zRows = enriched.map((row) => row.features.map((value, col) => (value - means[col]) / stds[col]))
  const cov = Array.from({ length: featureCount }, (_, i) =>
    Array.from({ length: featureCount }, (_, j) => {
      const sum = zRows.reduce((acc, r) => acc + r[i] * r[j], 0)
      return sum / Math.max(zRows.length - 1, 1)
    }),
  )

  const { eigenvalue: ev1, eigenvector: pc1Vec } = powerIteration(cov)
  const deflated = deflateMatrix(cov, ev1, pc1Vec)
  const { eigenvalue: ev2, eigenvector: pc2Vec } = powerIteration(deflated)

  const totalVar = cov.reduce((sum, row, i) => sum + row[i], 0) || 1

  const points = zRows.map((z, idx) => ({
    symbol: enriched[idx].symbol,
    pc1: dot(z, pc1Vec),
    pc2: dot(z, pc2Vec),
  }))

  return {
    points,
    explainedVariancePc1: (ev1 / totalVar) * 100,
    explainedVariancePc2: (ev2 / totalVar) * 100,
  }
}

function toRegressionCsv(regression) {
  if (!regression) return ''

  const lines = [
    'symbol,min_1y,current_price,predicted_price,residual',
    ...regression.points.map(
      (p) => `${p.symbol},${p.x},${p.y},${p.predictedY},${p.residual}`,
    ),
    '',
    `slope,${regression.slope}`,
    `intercept,${regression.intercept}`,
    `r_squared,${regression.r2}`,
  ]

  return lines.join('\n')
}

function toDiscountCsv(rows) {
  if (!rows.length) return ''

  const lines = [
    'symbol,name,sector,current_price,max_1y,discount_percent',
    ...rows.map(
      (row) =>
        `${row.symbol || ''},${row.name || ''},${row.sector || ''},${row.price},${row.max1y},${row.discountPercent}`,
    ),
  ]

  return lines.join('\n')
}

function toPriceComparisonCsv(rows) {
  if (!rows.length) return ''

  const lines = [
    'symbol,name,sector,min_1y,current_price,max_1y',
    ...rows.map(
      (row) =>
        `${row.symbol || ''},${row.name || ''},${row.sector || ''},${row.min1y},${row.current},${row.max1y}`,
    ),
  ]

  return lines.join('\n')
}

function toOpportunityCsv(rows) {
  if (!rows.length) return ''

  const lines = [
    'symbol,name,sector,min_1y,current_price,max_1y,opportunity_score',
    ...rows.map(
      (row) =>
        `${row.symbol || ''},${row.name || ''},${row.sector || ''},${row.min1y},${row.current},${row.max1y},${row.score}`,
    ),
  ]

  return lines.join('\n')
}

function toPeRatioCsv(rows) {
  if (!rows.length) return ''

  const lines = [
    'symbol,name,sector,pe_ratio',
    ...rows.map((row) => `${row.symbol || ''},${row.name || ''},${row.sector || ''},${row.peRatio}`),
  ]

  return lines.join('\n')
}

function toClusterCsv(clusterResult, xHeader, yHeader) {
  if (!clusterResult || !Array.isArray(clusterResult.points) || clusterResult.points.length === 0) return ''
  const safeX = xHeader || 'x'
  const safeY = yHeader || 'y'

  const lines = [
    `symbol,${safeX},${safeY},cluster`,
    ...clusterResult.points.map((p) => `${p.symbol || ''},${p.x},${p.y},${p.cluster}`),
    '',
    `k,${clusterResult.k}`,
  ]

  return lines.join('\n')
}

function toPcaCsv(pcaProjection) {
  if (!pcaProjection || !Array.isArray(pcaProjection.points) || pcaProjection.points.length === 0) return ''

  const lines = [
    'symbol,pc1,pc2',
    ...pcaProjection.points.map((p) => `${p.symbol || ''},${p.pc1},${p.pc2}`),
    '',
    `explained_variance_pc1_percent,${pcaProjection.explainedVariancePc1}`,
    `explained_variance_pc2_percent,${pcaProjection.explainedVariancePc2}`,
  ]

  return lines.join('\n')
}

function downloadTextFile(content, fileName, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function PortfolioHome() {
  const location = useLocation()
  const [stocks, setStocks] = useState([])
  const [goldSilverLoading, setGoldSilverLoading] = useState(false)
  const [goldSilverMessage, setGoldSilverMessage] = useState('')
  const [goldSilverGraphDataUrl, setGoldSilverGraphDataUrl] = useState('')
  const [goldSilverCorrelation, setGoldSilverCorrelation] = useState(null)
  const [goldSilverPoints, setGoldSilverPoints] = useState(0)
  const { modal, close, openSvg, openImg } = useChartModal()

  const flashMessage = useMemo(() => location.state?.message || '', [location.state?.message])
  const regression = useMemo(() => buildRegression(stocks), [stocks])
  const discountRows = useMemo(() => buildDiscountRows(stocks), [stocks])
  const priceComparisonRows = useMemo(() => buildPriceComparisonRows(stocks), [stocks])
  const opportunityRows = useMemo(() => buildOpportunityRows(stocks), [stocks])
  const peRatioRows = useMemo(() => buildPeRatioRows(stocks), [stocks])
  const peDiscountRows = useMemo(() => buildPeDiscountRows(stocks), [stocks])
  const peOpportunityRows = useMemo(() => buildPeOpportunityRows(stocks), [stocks])
  const pcaProjection = useMemo(() => buildPcaProjection(stocks), [stocks])
  const peDiscountClusters = useMemo(() => runKMeans(peDiscountRows, 3), [peDiscountRows])
  const peOpportunityClusters = useMemo(() => runKMeans(peOpportunityRows, 3), [peOpportunityRows])

  function handleDownloadCsv() {
    if (!regression) return
    const csvContent = toRegressionCsv(regression)
    downloadTextFile(csvContent, 'portfolio_linear_regression.csv', 'text/csv;charset=utf-8')
  }

  function handleDiscountCsvDownload() {
    if (!discountRows.length) return
    const csvContent = toDiscountCsv(discountRows)
    downloadTextFile(csvContent, 'portfolio_discount_analysis.csv', 'text/csv;charset=utf-8')
  }

  function handlePriceComparisonCsvDownload() {
    if (!priceComparisonRows.length) return
    const csvContent = toPriceComparisonCsv(priceComparisonRows)
    downloadTextFile(csvContent, 'portfolio_1y_price_comparison.csv', 'text/csv;charset=utf-8')
  }

  function handleOpportunityCsvDownload() {
    if (!opportunityRows.length) return
    const csvContent = toOpportunityCsv(opportunityRows)
    downloadTextFile(csvContent, 'portfolio_opportunity_score.csv', 'text/csv;charset=utf-8')
  }

  function handlePeRatioCsvDownload() {
    if (!peRatioRows.length) return
    const csvContent = toPeRatioCsv(peRatioRows)
    downloadTextFile(csvContent, 'portfolio_pe_ratio_analysis.csv', 'text/csv;charset=utf-8')
  }

  function handlePeDiscountClustersCsvDownload() {
    if (!peDiscountClusters || !peDiscountClusters.points.length) return
    const csvContent = toClusterCsv(peDiscountClusters, 'pe_ratio', 'discount_percent')
    downloadTextFile(csvContent, 'portfolio_clusters_pe_discount.csv', 'text/csv;charset=utf-8')
  }

  function handlePeOpportunityClustersCsvDownload() {
    if (!peOpportunityClusters || !peOpportunityClusters.points.length) return
    const csvContent = toClusterCsv(peOpportunityClusters, 'pe_ratio', 'opportunity_score')
    downloadTextFile(csvContent, 'portfolio_clusters_pe_opportunity.csv', 'text/csv;charset=utf-8')
  }

  function handlePcaCsvDownload() {
    if (!pcaProjection || !pcaProjection.points.length) return
    const csvContent = toPcaCsv(pcaProjection)
    downloadTextFile(csvContent, 'portfolio_pca_projection.csv', 'text/csv;charset=utf-8')
  }

  async function handleGoldSilverCorrelationDownload() {
    setGoldSilverLoading(true)
    setGoldSilverMessage('')
    try {
      const response = await fetch(`${API_BASE_URL}/all-sector-stocks/gold-silver/?period=5y&interval=1d`, {
        method: 'GET',
      })

      if (!response.ok) {
        throw new Error(`Gold/Silver request failed with status ${response.status}`)
      }

      const result = await response.json()
      const assets = Array.isArray(result?.data) ? result.data : []
      const gold = assets.find((item) => item?.asset === 'gold')
      const silver = assets.find((item) => item?.asset === 'silver')

      const goldMap = new Map((gold?.history || []).map((row) => [row?.date, Number(row?.close)]))
      const silverMap = new Map((silver?.history || []).map((row) => [row?.date, Number(row?.close)]))

      const alignedRows = [...goldMap.keys()]
        .filter((date) => silverMap.has(date))
        .map((date) => ({
          date,
          gold_close: goldMap.get(date),
          silver_close: silverMap.get(date),
        }))
        .filter(
          (row) =>
            !Number.isNaN(row.gold_close) &&
            !Number.isNaN(row.silver_close) &&
            row.gold_close !== null &&
            row.silver_close !== null,
        )
        .sort((a, b) => String(a.date).localeCompare(String(b.date)))

      if (alignedRows.length < 2) {
        throw new Error('Not enough aligned gold/silver history to calculate correlation.')
      }

      const correlation = calculateCorrelation(
        alignedRows.map((row) => row.gold_close),
        alignedRows.map((row) => row.silver_close),
      )
      setGoldSilverCorrelation(correlation)
      setGoldSilverPoints(alignedRows.length)

      const csvHeader = 'date,gold_close,silver_close'
      const csvBody = alignedRows.map((row) => `${row.date},${row.gold_close},${row.silver_close}`).join('\n')
      const corrLine = `\ncorrelation,,${correlation === null ? '' : correlation}`
      const csvContent = `${csvHeader}\n${csvBody}${corrLine}`
      downloadTextFile(csvContent, 'gold_silver_5y_prices_with_correlation.csv', 'text/csv;charset=utf-8')

      const svg = buildGoldSilverChartSvg(alignedRows, correlation)
      setGoldSilverGraphDataUrl(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)

      setGoldSilverMessage(
        `CSV downloaded. Graph rendered on page. Correlation (5Y prices): ${
          correlation === null ? 'N/A' : correlation.toFixed(4)
        }`,
      )
    } catch (err) {
      setGoldSilverCorrelation(null)
      setGoldSilverPoints(0)
      setGoldSilverGraphDataUrl('')
      setGoldSilverMessage(err.message || 'Failed to fetch gold/silver data')
    } finally {
      setGoldSilverLoading(false)
    }
  }

  function handleRemoveFromPortfolio(symbol) {
    const symbolText = normalizePortfolioSymbol(symbol)
    if (!symbolText) return

    const ok = typeof window === 'undefined' ? true : window.confirm(`Remove ${symbolText} from your portfolio?`)
    if (!ok) return

    setStocks((prev) => {
      const next = (Array.isArray(prev) ? prev : []).filter(
        (row) => normalizePortfolioSymbol(typeof row === 'string' ? row : row?.symbol) !== symbolText,
      )
      writePortfolioRows(next, USER_PORTFOLIO_KEY)
      return next
    })
  }

  useEffect(() => {
    async function loadPortfolioStocks() {
      const localRows = readPortfolioRows(USER_PORTFOLIO_KEY).map((row) => ({
        ...row,
        quantity: row?.quantity ?? 1,
      }))

      if (!localRows.length) {
        setStocks([])
        return
      }

      try {
        const response = await fetch(`${API_BASE_URL}/all-sector-stocks/crud/stocks/`, { method: 'GET' })
        const result = await response.json().catch(() => ({}))
        const apiRows = response.ok && Array.isArray(result?.data) ? result.data : []
        const bySymbol = new Map(apiRows.map((row) => [normalizePortfolioSymbol(row?.symbol), row]))

        const merged = localRows.map((row) => {
          const symbol = normalizePortfolioSymbol(row?.symbol)
          const apiMatch = bySymbol.get(symbol) || {}
          return {
            ...apiMatch,
            ...row,
            pe_ratio: row?.pe_ratio ?? apiMatch?.pe_ratio ?? null,
            min_1y: row?.min_1y ?? apiMatch?.min_1y ?? null,
            max_1y: row?.max_1y ?? apiMatch?.max_1y ?? null,
            price: row?.price ?? apiMatch?.price ?? null,
            quantity: row?.quantity ?? apiMatch?.quantity ?? 1,
            symbol: symbol || normalizePortfolioSymbol(apiMatch?.symbol),
          }
        })

        setStocks(merged)
        writePortfolioRows(merged, USER_PORTFOLIO_KEY)
      } catch {
        // Fall back to locally saved portfolio data if API merge fails.
        setStocks(localRows)
      }
    }

    loadPortfolioStocks()
    window.addEventListener('storage', loadPortfolioStocks)
    return () => window.removeEventListener('storage', loadPortfolioStocks)
  }, [])

  function getRegressionChartData() {
    if (!regression) return null

    const width = 900
    const height = 420
    const left = 70
    const right = 30
    const top = 30
    const bottom = 60

    const chartWidth = width - left - right
    const chartHeight = height - top - bottom
    const xs = regression.points.map((p) => p.x)
    const ys = regression.points.map((p) => p.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const spanX = maxX - minX || 1
    const spanY = maxY - minY || 1

    const toPxX = (x) => left + ((x - minX) / spanX) * chartWidth
    const toPxY = (y) => top + (1 - (y - minY) / spanY) * chartHeight

    const x1 = minX
    const y1 = regression.intercept + regression.slope * x1
    const x2 = maxX
    const y2 = regression.intercept + regression.slope * x2

    return {
      width,
      height,
      left,
      top,
      chartWidth,
      chartHeight,
      minX,
      maxX,
      minY,
      maxY,
      toPxX,
      toPxY,
      line: {
        x1: toPxX(x1),
        y1: toPxY(y1),
        x2: toPxX(x2),
        y2: toPxY(y2),
      },
    }
  }

  const chart = getRegressionChartData()

  function getDiscountChartData() {
    if (!discountRows.length) return null

    const width = 900
    const height = 420
    const left = 60
    const right = 20
    const top = 30
    const bottom = 120
    const chartWidth = width - left - right
    const chartHeight = height - top - bottom
    const maxDiscount = Math.max(...discountRows.map((row) => Math.max(0, row.discountPercent)), 0)
    const yMax = maxDiscount > 0 ? maxDiscount : 1
    const barWidth = Math.max(14, chartWidth / Math.max(discountRows.length * 1.8, 1))

    function toPxY(val) {
      return top + (1 - val / yMax) * chartHeight
    }

    return {
      width,
      height,
      left,
      right,
      top,
      bottom,
      chartWidth,
      chartHeight,
      yMax,
      barWidth,
      toPxY,
    }
  }

  const discountChart = getDiscountChartData()

  function getPriceComparisonChartData() {
    if (!priceComparisonRows.length) return null

    const width = 980
    const height = 440
    const left = 60
    const right = 20
    const top = 30
    const bottom = 120
    const chartWidth = width - left - right
    const chartHeight = height - top - bottom
    const allValues = priceComparisonRows.flatMap((row) => [row.min1y, row.current, row.max1y])
    const maxValue = Math.max(...allValues, 0)
    const yMax = maxValue > 0 ? maxValue : 1

    function toPxY(val) {
      return top + (1 - val / yMax) * chartHeight
    }

    return {
      width,
      height,
      left,
      top,
      chartWidth,
      chartHeight,
      yMax,
      toPxY,
    }
  }

  const priceChart = getPriceComparisonChartData()

  function getOpportunityChartData() {
    if (!opportunityRows.length) return null

    const width = 900
    const height = 420
    const left = 60
    const right = 20
    const top = 30
    const bottom = 120
    const chartWidth = width - left - right
    const chartHeight = height - top - bottom
    const barWidth = Math.max(14, chartWidth / Math.max(opportunityRows.length * 1.8, 1))

    function toPxY(val) {
      return top + (1 - val / 100) * chartHeight
    }

    return {
      width,
      height,
      left,
      top,
      chartWidth,
      chartHeight,
      barWidth,
      toPxY,
    }
  }

  const opportunityChart = getOpportunityChartData()

  function getPeRatioChartData() {
    if (!peRatioRows.length) return null

    const width = 900
    const height = 420
    const left = 60
    const right = 20
    const top = 30
    const bottom = 120
    const chartWidth = width - left - right
    const chartHeight = height - top - bottom
    const yMax = Math.max(...peRatioRows.map((row) => row.peRatio), 1)
    const barWidth = Math.max(14, chartWidth / Math.max(peRatioRows.length * 1.8, 1))

    function toPxY(val) {
      return top + (1 - val / yMax) * chartHeight
    }

    return {
      width,
      height,
      left,
      top,
      chartWidth,
      chartHeight,
      yMax,
      barWidth,
      toPxY,
    }
  }

  const peChart = getPeRatioChartData()

  function getClusterScatterChartData(clusterResult) {
    if (!clusterResult || !clusterResult.points.length) return null

    const width = 900
    const height = 420
    const left = 60
    const right = 20
    const top = 30
    const bottom = 60
    const chartWidth = width - left - right
    const chartHeight = height - top - bottom

    const xs = clusterResult.points.map((p) => p.x)
    const ys = clusterResult.points.map((p) => p.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const spanX = maxX - minX || 1
    const spanY = maxY - minY || 1

    const toPxX = (x) => left + ((x - minX) / spanX) * chartWidth
    const toPxY = (y) => top + (1 - (y - minY) / spanY) * chartHeight

    return {
      width,
      height,
      left,
      top,
      chartWidth,
      chartHeight,
      minX,
      maxX,
      minY,
      maxY,
      toPxX,
      toPxY,
    }
  }

  const clusterColors = ['#2563eb', '#dc2626', '#16a34a', '#7c3aed', '#ea580c']
  const peDiscountChart = getClusterScatterChartData(peDiscountClusters)
  const peOpportunityChart = getClusterScatterChartData(peOpportunityClusters)
  const pcaChart = getClusterScatterChartData(
    pcaProjection
      ? { points: pcaProjection.points.map((point) => ({ ...point, x: point.pc1, y: point.pc2 })) }
      : null,
  )

  return (
    <div className="row g-4 animate-fade-in">
      <div className="col-12">
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-white">
            <h4 className="mb-0">Portfolio Stocks</h4>
          </div>
          <div className="card-body">
            <ChartModal {...modal} onClose={close} />
            {flashMessage ? <div className="alert alert-info py-2">{flashMessage}</div> : null}

            {stocks.length === 0 ? (
              <p className="text-secondary mb-0">No stocks added to portfolio yet.</p>
            ) : (
              <div className="d-flex flex-column gap-4">
                <div className="table-responsive">
                  <table className="table table-striped align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Symbol</th>
                        <th>Name</th>
                        <th>Sector</th>
                        <th>Qty</th>
                        <th>Price</th>
                        <th>Min (1Y)</th>
                        <th>Max (1Y)</th>
                        <th>Change</th>
                        <th>Market Cap</th>
                        <th>P/E Ratio</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stocks.map((stock, index) => (
                        <tr key={`${stock.symbol}-${index}`}>
                          <td>{stock.symbol || '-'}</td>
                          <td>{stock.name || '-'}</td>
                          <td>{stock.sector || '-'}</td>
                          <td>{toNumber(stock.quantity) === null ? '-' : stock.quantity}</td>
                          <td>{formatPrice(stock.price)}</td>
                          <td>{formatPrice(stock.min_1y)}</td>
                          <td>{formatPrice(stock.max_1y)}</td>
                          <td>{formatPercent(stock.change_percent)}</td>
                          <td>{formatMarketCap(stock.market_cap)}</td>
                          <td>{toNumber(stock.pe_ratio) === null ? '-' : Number(stock.pe_ratio).toFixed(2)}</td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => handleRemoveFromPortfolio(stock?.symbol)}
                              disabled={!stock?.symbol}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="row g-3">
                  <div className="col-12 col-xl-6">
                    <div className="chart-panel p-3 h-100">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <h6 className="mb-0">Linear Regression Analysis</h6>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      onClick={handleDownloadCsv}
                      disabled={!regression}
                    >
                      Download CSV
                    </button>
                      </div>

                  {regression ? (
                    <>
                      <p className="text-secondary mb-3">
                        Model: <strong>price = {regression.intercept.toFixed(2)} + {regression.slope.toFixed(4)} * min_1y</strong>
                        {' '}| R2: <strong>{regression.r2.toFixed(4)}</strong>
                      </p>

                      {chart ? (
                        <svg
                          viewBox={`0 0 ${chart.width} ${chart.height}`}
                          width="100%"
                          role="img"
                          aria-label="Linear regression chart for portfolio stocks"
                          onClick={(e) => openSvg(e, 'Linear Regression Analysis')}
                          style={{ cursor: 'pointer' }}
                        >
                          <line
                            x1={chart.left}
                            y1={chart.top}
                            x2={chart.left}
                            y2={chart.top + chart.chartHeight}
                            stroke="#9ca3af"
                          />
                          <line
                            x1={chart.left}
                            y1={chart.top + chart.chartHeight}
                            x2={chart.left + chart.chartWidth}
                            y2={chart.top + chart.chartHeight}
                            stroke="#9ca3af"
                          />

                          <line
                            x1={chart.line.x1}
                            y1={chart.line.y1}
                            x2={chart.line.x2}
                            y2={chart.line.y2}
                            stroke="#2563eb"
                            strokeWidth="2.5"
                          />

                          {regression.points.map((p) => (
                            <g key={p.symbol}>
                              <circle cx={chart.toPxX(p.x)} cy={chart.toPxY(p.y)} r="4" fill="#dc2626" />
                              <text x={chart.toPxX(p.x) + 6} y={chart.toPxY(p.y) - 6} fontSize="10" fill="#374151">
                                {p.symbol}
                              </text>
                            </g>
                          ))}

                          <text x={chart.left} y={chart.top - 8} fontSize="11" fill="#374151">
                            Price (Y)
                          </text>
                          <text x={chart.left + chart.chartWidth - 180} y={chart.top + chart.chartHeight + 36} fontSize="11" fill="#374151">
                            1Y Min Price (X)
                          </text>
                          <text x={chart.left} y={chart.top + chart.chartHeight + 18} fontSize="10" fill="#6b7280">
                            Min X: {chart.minX.toFixed(2)} | Max X: {chart.maxX.toFixed(2)}
                          </text>
                          <text x={chart.left + 250} y={chart.top + chart.chartHeight + 18} fontSize="10" fill="#6b7280">
                            Min Y: {chart.minY.toFixed(2)} | Max Y: {chart.maxY.toFixed(2)}
                          </text>
                        </svg>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-secondary mb-0">
                      Add at least 2 stocks with valid <code>min_1y</code> and <code>price</code> to run regression.
                    </p>
                  )}
                    </div>
                  </div>
                  <div className="col-12 col-xl-6">
                    <div className="chart-panel p-3 h-100">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <h6 className="mb-0">Discount % Analysis (vs 1Y Max)</h6>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      onClick={handleDiscountCsvDownload}
                      disabled={!discountRows.length}
                    >
                      Download Discount CSV
                    </button>
                      </div>

                  {discountRows.length === 0 ? (
                    <p className="text-secondary mb-0">
                      Add stocks with valid <code>price</code> and <code>max_1y</code> values to view discount analysis.
                    </p>
                  ) : (
                    <>
                      <p className="text-secondary mb-3">
                        Discount % = <strong>((max_1y - current_price) / max_1y) * 100</strong>
                      </p>

                      {discountChart ? (
                        <svg
                          viewBox={`0 0 ${discountChart.width} ${discountChart.height}`}
                          width="100%"
                          role="img"
                          aria-label="Discount percentage chart for portfolio stocks"
                          onClick={(e) => openSvg(e, 'Discount % Analysis')}
                          style={{ cursor: 'pointer' }}
                        >
                          <line
                            x1={discountChart.left}
                            y1={discountChart.top}
                            x2={discountChart.left}
                            y2={discountChart.top + discountChart.chartHeight}
                            stroke="#9ca3af"
                          />
                          <line
                            x1={discountChart.left}
                            y1={discountChart.top + discountChart.chartHeight}
                            x2={discountChart.left + discountChart.chartWidth}
                            y2={discountChart.top + discountChart.chartHeight}
                            stroke="#9ca3af"
                          />

                          {discountRows.map((row, idx) => {
                            const step = discountChart.chartWidth / Math.max(discountRows.length, 1)
                            const x = discountChart.left + idx * step + (step - discountChart.barWidth) / 2
                            const clamped = Math.max(0, row.discountPercent)
                            const y = discountChart.toPxY(clamped)
                            const h = discountChart.top + discountChart.chartHeight - y
                            return (
                              <g key={row.symbol || idx}>
                                <rect x={x} y={y} width={discountChart.barWidth} height={h} fill="#16a34a" />
                                <text x={x + discountChart.barWidth / 2} y={y - 6} textAnchor="middle" fontSize="10" fill="#374151">
                                  {row.discountPercent.toFixed(2)}%
                                </text>
                                <text
                                  x={x + discountChart.barWidth / 2}
                                  y={discountChart.top + discountChart.chartHeight + 16}
                                  textAnchor="middle"
                                  fontSize="10"
                                  fill="#374151"
                                >
                                  {row.symbol}
                                </text>
                              </g>
                            )
                          })}

                          <text x={discountChart.left} y={discountChart.top - 8} fontSize="11" fill="#374151">
                            Discount % (Y)
                          </text>
                          <text x={discountChart.left + discountChart.chartWidth - 120} y={discountChart.top + discountChart.chartHeight + 38} fontSize="11" fill="#374151">
                            Stocks (X)
                          </text>
                          <text x={discountChart.left} y={discountChart.top + 12} fontSize="10" fill="#6b7280">
                            Max scale: {discountChart.yMax.toFixed(2)}%
                          </text>
                        </svg>
                      ) : null}
                    </>
                  )}
                </div>
                  </div>
                  <div className="col-12 col-xl-6">
                    <div className="chart-panel p-3 h-100">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <h6 className="mb-0">1-Year Price Comparison (Min vs Current vs Max)</h6>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      onClick={handlePriceComparisonCsvDownload}
                      disabled={!priceComparisonRows.length}
                    >
                      Download 1Y Price CSV
                    </button>
                      </div>

                  {priceComparisonRows.length === 0 ? (
                    <p className="text-secondary mb-0">
                      Add stocks with valid <code>min_1y</code>, <code>price</code>, and <code>max_1y</code> values.
                    </p>
                  ) : (
                    <>
                      <p className="text-secondary mb-3">
                        Comparing each stock&apos;s 1Y min, current price, and 1Y max.
                      </p>
                      {priceChart ? (
                        <svg
                          viewBox={`0 0 ${priceChart.width} ${priceChart.height}`}
                          width="100%"
                          role="img"
                          aria-label="1-year price comparison chart for portfolio stocks"
                          onClick={(e) => openSvg(e, '1-Year Price Comparison')}
                          style={{ cursor: 'pointer' }}
                        >
                          <line
                            x1={priceChart.left}
                            y1={priceChart.top}
                            x2={priceChart.left}
                            y2={priceChart.top + priceChart.chartHeight}
                            stroke="#9ca3af"
                          />
                          <line
                            x1={priceChart.left}
                            y1={priceChart.top + priceChart.chartHeight}
                            x2={priceChart.left + priceChart.chartWidth}
                            y2={priceChart.top + priceChart.chartHeight}
                            stroke="#9ca3af"
                          />

                          {priceComparisonRows.map((row, idx) => {
                            const groupWidth = priceChart.chartWidth / Math.max(priceComparisonRows.length, 1)
                            const barWidth = Math.max(8, Math.min(20, groupWidth / 5))
                            const groupStart = priceChart.left + idx * groupWidth + groupWidth * 0.2
                            const bars = [
                              { label: 'Min', value: row.min1y, color: '#2563eb', offset: 0 },
                              { label: 'Current', value: row.current, color: '#16a34a', offset: 1 },
                              { label: 'Max', value: row.max1y, color: '#dc2626', offset: 2 },
                            ]

                            return (
                              <g key={row.symbol || idx}>
                                {bars.map((bar) => {
                                  const x = groupStart + bar.offset * (barWidth + 4)
                                  const y = priceChart.toPxY(bar.value)
                                  const h = priceChart.top + priceChart.chartHeight - y
                                  return (
                                    <rect
                                      key={`${row.symbol}-${bar.label}`}
                                      x={x}
                                      y={y}
                                      width={barWidth}
                                      height={h}
                                      fill={bar.color}
                                    />
                                  )
                                })}

                                <text
                                  x={groupStart + barWidth + 4}
                                  y={priceChart.top + priceChart.chartHeight + 16}
                                  textAnchor="middle"
                                  fontSize="10"
                                  fill="#374151"
                                >
                                  {row.symbol}
                                </text>
                              </g>
                            )
                          })}

                          <rect x={priceChart.left} y={priceChart.top + priceChart.chartHeight + 34} width="10" height="10" fill="#2563eb" />
                          <text x={priceChart.left + 14} y={priceChart.top + priceChart.chartHeight + 43} fontSize="10" fill="#374151">Min</text>
                          <rect x={priceChart.left + 60} y={priceChart.top + priceChart.chartHeight + 34} width="10" height="10" fill="#16a34a" />
                          <text x={priceChart.left + 74} y={priceChart.top + priceChart.chartHeight + 43} fontSize="10" fill="#374151">Current</text>
                          <rect x={priceChart.left + 140} y={priceChart.top + priceChart.chartHeight + 34} width="10" height="10" fill="#dc2626" />
                          <text x={priceChart.left + 154} y={priceChart.top + priceChart.chartHeight + 43} fontSize="10" fill="#374151">Max</text>

                          <text x={priceChart.left} y={priceChart.top - 8} fontSize="11" fill="#374151">
                            Price (Y)
                          </text>
                          <text x={priceChart.left} y={priceChart.top + 12} fontSize="10" fill="#6b7280">
                            Max scale: {priceChart.yMax.toFixed(2)}
                          </text>
                        </svg>
                      ) : null}
                    </>
                  )}
                </div>
                  </div>
                  <div className="col-12 col-xl-6">
                    <div className="chart-panel p-3 h-100">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <h6 className="mb-0">Opportunity Score (1Y)</h6>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      onClick={handleOpportunityCsvDownload}
                      disabled={!opportunityRows.length}
                    >
                      Download Opportunity CSV
                    </button>
                      </div>

                  {opportunityRows.length === 0 ? (
                    <p className="text-secondary mb-0">
                      Add stocks with valid <code>min_1y</code>, <code>price</code>, and <code>max_1y</code> values to compute score.
                    </p>
                  ) : (
                    <>
                      <p className="text-secondary mb-3">
                        Opportunity Score formula: <strong>((max_1y - current_price) / (max_1y - min_1y)) * 100</strong> (clamped 0-100).
                      </p>
                      {opportunityChart ? (
                        <svg
                          viewBox={`0 0 ${opportunityChart.width} ${opportunityChart.height}`}
                          width="100%"
                          role="img"
                          aria-label="Opportunity score chart for portfolio stocks"
                          onClick={(e) => openSvg(e, 'Opportunity Score (1Y)')}
                          style={{ cursor: 'pointer' }}
                        >
                          <line
                            x1={opportunityChart.left}
                            y1={opportunityChart.top}
                            x2={opportunityChart.left}
                            y2={opportunityChart.top + opportunityChart.chartHeight}
                            stroke="#9ca3af"
                          />
                          <line
                            x1={opportunityChart.left}
                            y1={opportunityChart.top + opportunityChart.chartHeight}
                            x2={opportunityChart.left + opportunityChart.chartWidth}
                            y2={opportunityChart.top + opportunityChart.chartHeight}
                            stroke="#9ca3af"
                          />

                          {opportunityRows.map((row, idx) => {
                            const step = opportunityChart.chartWidth / Math.max(opportunityRows.length, 1)
                            const x = opportunityChart.left + idx * step + (step - opportunityChart.barWidth) / 2
                            const y = opportunityChart.toPxY(row.score)
                            const h = opportunityChart.top + opportunityChart.chartHeight - y
                            return (
                              <g key={row.symbol || idx}>
                                <rect x={x} y={y} width={opportunityChart.barWidth} height={h} fill="#7c3aed" />
                                <text x={x + opportunityChart.barWidth / 2} y={y - 6} textAnchor="middle" fontSize="10" fill="#374151">
                                  {row.score.toFixed(1)}
                                </text>
                                <text
                                  x={x + opportunityChart.barWidth / 2}
                                  y={opportunityChart.top + opportunityChart.chartHeight + 16}
                                  textAnchor="middle"
                                  fontSize="10"
                                  fill="#374151"
                                >
                                  {row.symbol}
                                </text>
                              </g>
                            )
                          })}

                          <text x={opportunityChart.left} y={opportunityChart.top - 8} fontSize="11" fill="#374151">
                            Score (0-100)
                          </text>
                          <text x={opportunityChart.left} y={opportunityChart.top + 12} fontSize="10" fill="#6b7280">
                            Scale max: 100
                          </text>
                        </svg>
                      ) : null}
                    </>
                  )}
                </div>
                  </div>
                  <div className="col-12 col-xl-6">
                    <div className="chart-panel p-3 h-100">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <h6 className="mb-0">P/E Ratio Comparison</h6>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      onClick={handlePeRatioCsvDownload}
                      disabled={!peRatioRows.length}
                    >
                      Download P/E CSV
                    </button>
                      </div>

                  {peRatioRows.length === 0 ? (
                    <p className="text-secondary mb-0">
                      Add stocks with valid <code>pe_ratio</code> values to view this analysis.
                    </p>
                  ) : (
                    <>
                      <p className="text-secondary mb-3">
                        Comparing P/E ratio across selected portfolio stocks.
                      </p>
                      {peChart ? (
                        <svg
                          viewBox={`0 0 ${peChart.width} ${peChart.height}`}
                          width="100%"
                          role="img"
                          aria-label="PE ratio chart for portfolio stocks"
                          onClick={(e) => openSvg(e, 'P/E Ratio Comparison')}
                          style={{ cursor: 'pointer' }}
                        >
                          <line
                            x1={peChart.left}
                            y1={peChart.top}
                            x2={peChart.left}
                            y2={peChart.top + peChart.chartHeight}
                            stroke="#9ca3af"
                          />
                          <line
                            x1={peChart.left}
                            y1={peChart.top + peChart.chartHeight}
                            x2={peChart.left + peChart.chartWidth}
                            y2={peChart.top + peChart.chartHeight}
                            stroke="#9ca3af"
                          />

                          {peRatioRows.map((row, idx) => {
                            const step = peChart.chartWidth / Math.max(peRatioRows.length, 1)
                            const x = peChart.left + idx * step + (step - peChart.barWidth) / 2
                            const y = peChart.toPxY(row.peRatio)
                            const h = peChart.top + peChart.chartHeight - y
                            return (
                              <g key={row.symbol || idx}>
                                <rect x={x} y={y} width={peChart.barWidth} height={h} fill="#0ea5e9" />
                                <text x={x + peChart.barWidth / 2} y={y - 6} textAnchor="middle" fontSize="10" fill="#374151">
                                  {row.peRatio.toFixed(2)}
                                </text>
                                <text
                                  x={x + peChart.barWidth / 2}
                                  y={peChart.top + peChart.chartHeight + 16}
                                  textAnchor="middle"
                                  fontSize="10"
                                  fill="#374151"
                                >
                                  {row.symbol}
                                </text>
                              </g>
                            )
                          })}

                          <text x={peChart.left} y={peChart.top - 8} fontSize="11" fill="#374151">
                            P/E Ratio (Y)
                          </text>
                          <text x={peChart.left} y={peChart.top + 12} fontSize="10" fill="#6b7280">
                            Max scale: {peChart.yMax.toFixed(2)}
                          </text>
                        </svg>
                      ) : null}
                    </>
                  )}
                </div>
                  </div>
	                  <div className="col-12 col-xl-6">
	                    <div className="chart-panel p-3 h-100">
	                      <div className="d-flex justify-content-between align-items-center gap-2 mb-3 flex-wrap">
	                        <h6 className="mb-0">Cluster Analysis</h6>
	                        <div className="d-flex gap-2 flex-wrap">
	                          <button
	                            type="button"
	                            className="btn btn-sm btn-outline-primary"
	                            onClick={handlePeDiscountClustersCsvDownload}
	                            disabled={!peDiscountClusters || peDiscountClusters.points.length < 2}
	                          >
	                            Download Discount CSV
	                          </button>
	                          <button
	                            type="button"
	                            className="btn btn-sm btn-outline-primary"
	                            onClick={handlePeOpportunityClustersCsvDownload}
	                            disabled={!peOpportunityClusters || peOpportunityClusters.points.length < 2}
	                          >
	                            Download Opportunity CSV
	                          </button>
	                        </div>
	                      </div>

                      <div className="row g-3">
                        <div className="col-12 col-lg-6">
                          <div className="h-100">
                            <h6 className="mb-2">P/E vs Discount % Clusters</h6>
                    {!peDiscountClusters || !peDiscountChart || peDiscountClusters.points.length < 2 ? (
                      <p className="text-secondary mb-0">
                        Need at least 2 stocks with valid <code>pe_ratio</code>, <code>price</code>, and <code>max_1y</code>.
                      </p>
                    ) : (
                      <>
                        <svg
                          viewBox={`0 0 ${peDiscountChart.width} ${peDiscountChart.height}`}
                          width="100%"
                          role="img"
                          aria-label="PE vs Discount percent cluster chart"
                          onClick={(e) => openSvg(e, 'P/E vs Discount % Clusters')}
                          style={{ cursor: 'pointer' }}
                        >
                          <line
                            x1={peDiscountChart.left}
                            y1={peDiscountChart.top}
                            x2={peDiscountChart.left}
                            y2={peDiscountChart.top + peDiscountChart.chartHeight}
                            stroke="#9ca3af"
                          />
                          <line
                            x1={peDiscountChart.left}
                            y1={peDiscountChart.top + peDiscountChart.chartHeight}
                            x2={peDiscountChart.left + peDiscountChart.chartWidth}
                            y2={peDiscountChart.top + peDiscountChart.chartHeight}
                            stroke="#9ca3af"
                          />

                          {peDiscountClusters.points.map((p) => (
                            <g key={`ped-${p.symbol}`}>
                              <circle
                                cx={peDiscountChart.toPxX(p.x)}
                                cy={peDiscountChart.toPxY(p.y)}
                                r="5"
                                fill={clusterColors[p.cluster % clusterColors.length]}
                              />
                              <text
                                x={peDiscountChart.toPxX(p.x) + 6}
                                y={peDiscountChart.toPxY(p.y) - 6}
                                fontSize="10"
                                fill="#374151"
                              >
                                {p.symbol}
                              </text>
                            </g>
                          ))}

                          <text x={peDiscountChart.left} y={peDiscountChart.top - 8} fontSize="11" fill="#374151">
                            Discount % (Y)
                          </text>
                          <text x={peDiscountChart.left + peDiscountChart.chartWidth - 120} y={peDiscountChart.top + peDiscountChart.chartHeight + 36} fontSize="11" fill="#374151">
                            P/E Ratio (X)
                          </text>
                        </svg>
                        <div className="d-flex flex-wrap gap-3 mt-2">
                          {Array.from({ length: peDiscountClusters.k }).map((_, idx) => (
                            <span key={`ped-legend-${idx}`} className="small text-secondary">
                              <span
                                style={{
                                  display: 'inline-block',
                                  width: '10px',
                                  height: '10px',
                                  backgroundColor: clusterColors[idx % clusterColors.length],
                                  marginRight: '6px',
                                }}
                              />
                              Cluster {idx + 1}
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                          </div>
                        </div>

                        <div className="col-12 col-lg-6">
                          <div className="h-100">
                            <h6 className="mb-2">P/E vs Opportunity Score Clusters</h6>
                    {!peOpportunityClusters || !peOpportunityChart || peOpportunityClusters.points.length < 2 ? (
                      <p className="text-secondary mb-0">
                        Need at least 2 stocks with valid <code>pe_ratio</code>, <code>min_1y</code>, <code>price</code>, and <code>max_1y</code>.
                      </p>
                    ) : (
                      <>
                        <svg
                          viewBox={`0 0 ${peOpportunityChart.width} ${peOpportunityChart.height}`}
                          width="100%"
                          role="img"
                          aria-label="PE vs Opportunity score cluster chart"
                          onClick={(e) => openSvg(e, 'P/E vs Opportunity Score Clusters')}
                          style={{ cursor: 'pointer' }}
                        >
                          <line
                            x1={peOpportunityChart.left}
                            y1={peOpportunityChart.top}
                            x2={peOpportunityChart.left}
                            y2={peOpportunityChart.top + peOpportunityChart.chartHeight}
                            stroke="#9ca3af"
                          />
                          <line
                            x1={peOpportunityChart.left}
                            y1={peOpportunityChart.top + peOpportunityChart.chartHeight}
                            x2={peOpportunityChart.left + peOpportunityChart.chartWidth}
                            y2={peOpportunityChart.top + peOpportunityChart.chartHeight}
                            stroke="#9ca3af"
                          />

                          {peOpportunityClusters.points.map((p) => (
                            <g key={`peo-${p.symbol}`}>
                              <circle
                                cx={peOpportunityChart.toPxX(p.x)}
                                cy={peOpportunityChart.toPxY(p.y)}
                                r="5"
                                fill={clusterColors[p.cluster % clusterColors.length]}
                              />
                              <text
                                x={peOpportunityChart.toPxX(p.x) + 6}
                                y={peOpportunityChart.toPxY(p.y) - 6}
                                fontSize="10"
                                fill="#374151"
                              >
                                {p.symbol}
                              </text>
                            </g>
                          ))}

                          <text x={peOpportunityChart.left} y={peOpportunityChart.top - 8} fontSize="11" fill="#374151">
                            Opportunity Score (Y)
                          </text>
                          <text x={peOpportunityChart.left + peOpportunityChart.chartWidth - 120} y={peOpportunityChart.top + peOpportunityChart.chartHeight + 36} fontSize="11" fill="#374151">
                            P/E Ratio (X)
                          </text>
                        </svg>
                        <div className="d-flex flex-wrap gap-3 mt-2">
                          {Array.from({ length: peOpportunityClusters.k }).map((_, idx) => (
                            <span key={`peo-legend-${idx}`} className="small text-secondary">
                              <span
                                style={{
                                  display: 'inline-block',
                                  width: '10px',
                                  height: '10px',
                                  backgroundColor: clusterColors[idx % clusterColors.length],
                                  marginRight: '6px',
                                }}
                              />
                              Cluster {idx + 1}
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                          </div>
                        </div>
                      </div>
                </div>
                  </div>
	                  <div className="col-12 col-xl-6">
	                    <div className="chart-panel p-3 h-100">
	                      <div className="d-flex justify-content-between align-items-center gap-2 mb-2 flex-wrap">
	                        <h6 className="mb-0">PCA Projection (Stocks)</h6>
	                        <button
	                          type="button"
	                          className="btn btn-sm btn-outline-primary"
	                          onClick={handlePcaCsvDownload}
	                          disabled={!pcaProjection || pcaProjection.points.length < 2}
	                        >
	                          Download CSV
	                        </button>
	                      </div>
                  {!pcaProjection || !pcaChart || pcaProjection.points.length < 2 ? (
                    <p className="text-secondary mb-0">
                      Need at least 2 stocks with valid <code>price</code>, <code>min_1y</code>, and <code>max_1y</code>.
                    </p>
                  ) : (
                    <>
                      <p className="text-secondary mb-3">
                        PC1 variance: <strong>{pcaProjection.explainedVariancePc1.toFixed(2)}%</strong> | PC2 variance:{' '}
                        <strong>{pcaProjection.explainedVariancePc2.toFixed(2)}%</strong>
                      </p>
                      <svg
                        viewBox={`0 0 ${pcaChart.width} ${pcaChart.height}`}
                        width="100%"
                        role="img"
                        aria-label="PCA projection chart for portfolio stocks"
                        onClick={(e) => openSvg(e, 'PCA Projection')}
                        style={{ cursor: 'pointer' }}
                      >
                        <line
                          x1={pcaChart.left}
                          y1={pcaChart.top}
                          x2={pcaChart.left}
                          y2={pcaChart.top + pcaChart.chartHeight}
                          stroke="#9ca3af"
                        />
                        <line
                          x1={pcaChart.left}
                          y1={pcaChart.top + pcaChart.chartHeight}
                          x2={pcaChart.left + pcaChart.chartWidth}
                          y2={pcaChart.top + pcaChart.chartHeight}
                          stroke="#9ca3af"
                        />

                        {pcaProjection.points.map((p) => (
                          <g key={`pca-${p.symbol}`}>
                            <circle cx={pcaChart.toPxX(p.pc1)} cy={pcaChart.toPxY(p.pc2)} r="5" fill="#0284c7" />
                            <text
                              x={pcaChart.toPxX(p.pc1) + 6}
                              y={pcaChart.toPxY(p.pc2) - 6}
                              fontSize="10"
                              fill="#374151"
                            >
                              {p.symbol}
                            </text>
                          </g>
                        ))}

                        <text x={pcaChart.left} y={pcaChart.top - 8} fontSize="11" fill="#374151">
                          PC2 (Y)
                        </text>
                        <text x={pcaChart.left + pcaChart.chartWidth - 80} y={pcaChart.top + pcaChart.chartHeight + 36} fontSize="11" fill="#374151">
                          PC1 (X)
                        </text>
                      </svg>
                    </>
                  )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="card border-0 shadow-sm mt-4">
              <div className="card-body d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                <div>
                  <h6 className="mb-1">Gold Silver Correlation (5 Years)</h6>
                  <p className="mb-0 text-secondary small">
                    Fetch prices from yfinance, calculate correlation, and download CSV + graph.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-outline-primary"
                  onClick={handleGoldSilverCorrelationDownload}
                  disabled={goldSilverLoading}
                >
                  {goldSilverLoading ? 'Generating...' : 'Generate Gold/Silver Graph + Download CSV'}
                </button>
              </div>
              {goldSilverMessage ? (
                <div className="card-footer bg-white border-0 pt-0">
                  <small className="text-secondary">{goldSilverMessage}</small>
                </div>
              ) : null}
            </div>

            {goldSilverGraphDataUrl ? (
              <div className="card border-0 shadow-sm mt-4">
                <div className="card-header bg-white">
                  <h6 className="mb-0">
                    Gold vs Silver Correlation Graph (5Y)
                    {goldSilverCorrelation !== null ? ` - ${goldSilverCorrelation.toFixed(4)}` : ''}
                  </h6>
                  <small className="text-secondary">Data points: {goldSilverPoints}</small>
                </div>
                <div className="card-body">
                  <img
                    src={goldSilverGraphDataUrl}
                    alt="Gold and Silver 5 year correlation graph"
                    className="img-fluid rounded border"
                    onClick={(e) => openImg(e, 'Gold vs Silver (5Y)')}
                    style={{ cursor: 'pointer' }}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export default PortfolioHome
