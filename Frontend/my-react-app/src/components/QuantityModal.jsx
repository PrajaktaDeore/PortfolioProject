import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

function parsePositiveQuantity(value) {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) return { ok: false, value: null, message: 'Quantity is required.' }

  const parsed = Number.parseFloat(trimmed)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { ok: false, value: null, message: 'Quantity must be a positive number.' }
  }

  return { ok: true, value: parsed, message: '' }
}

function QuantityModal({ open, symbol, defaultQuantity = 1, onCancel, onConfirm }) {
  const [draft, setDraft] = useState(() => String(defaultQuantity ?? 1))
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return undefined
    if (typeof document === 'undefined') return undefined

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKeyDown(e) {
      if (!e) return
      if (e.key === 'Escape') onCancel?.()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onCancel])

  if (!open) return null
  if (typeof document === 'undefined') return null

  function handleSubmit(e) {
    e?.preventDefault?.()
    const parsed = parsePositiveQuantity(draft)
    if (!parsed.ok) {
      setError(parsed.message)
      return
    }
    onConfirm?.(parsed.value)
  }

  return createPortal(
    <div className="app-modal-overlay" role="presentation" onClick={onCancel}>
      <div
        className="app-modal card border-0 shadow-sm"
        role="dialog"
        aria-modal="true"
        aria-label={symbol ? `Enter quantity for ${symbol}` : 'Enter quantity'}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 560 }}
      >
        <div className="card-header bg-white d-flex align-items-center justify-content-between gap-2">
          <h5 className="mb-0 text-truncate">Add to Portfolio</h5>
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={onCancel} aria-label="Close modal">
            Close
          </button>
        </div>
        <div className="card-body app-modal-body">
          <form onSubmit={handleSubmit} className="d-flex flex-column gap-3">
            <div>
              <div className="fw-semibold mb-1">{symbol ? `Quantity for ${symbol}` : 'Quantity'}</div>
              <input
                autoFocus
                type="number"
                inputMode="decimal"
                className={`form-control ${error ? 'is-invalid' : ''}`}
                min="0"
                step="1"
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value)
                  if (error) setError('')
                }}
                placeholder="1"
                aria-label="Quantity"
              />
              {error ? <div className="invalid-feedback d-block">{error}</div> : null}
              <div className="form-text">Tip: use 1 for a single share.</div>
            </div>

            <div className="d-flex justify-content-end gap-2">
              <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Add
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default QuantityModal
