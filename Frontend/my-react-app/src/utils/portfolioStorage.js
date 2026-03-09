export const DEFAULT_PORTFOLIO_KEY = 'user_portfolio_stocks_v1'

export function normalizePortfolioSymbol(value) {
  const symbol = String(value ?? '').trim().toUpperCase()
  return symbol || ''
}

export function normalizePortfolioRows(rows) {
  if (!Array.isArray(rows)) return []

  const seen = new Set()
  const normalized = []

  for (const item of rows) {
    const symbol = normalizePortfolioSymbol(typeof item === 'string' ? item : item?.symbol)
    if (!symbol || seen.has(symbol)) continue
    seen.add(symbol)

    if (item && typeof item === 'object' && !Array.isArray(item)) {
      normalized.push({ ...item, symbol })
    } else {
      normalized.push({ symbol })
    }
  }

  return normalized
}

export function readPortfolioRows(key = DEFAULT_PORTFOLIO_KEY) {
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    return normalizePortfolioRows(parsed)
  } catch {
    return []
  }
}

export function writePortfolioRows(rows, key = DEFAULT_PORTFOLIO_KEY) {
  try {
    localStorage.setItem(key, JSON.stringify(normalizePortfolioRows(rows)))
    return true
  } catch {
    return false
  }
}

