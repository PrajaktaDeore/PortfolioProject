import { useEffect } from 'react'
import { createPortal } from 'react-dom'

function ChartModal({ open, title, type, svgHtml, imgSrc, onClose }) {
  useEffect(() => {
    if (!open) return undefined
    if (typeof document === 'undefined') return undefined

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  if (!open) return null
  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="app-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="app-modal card border-0 shadow-sm"
        role="dialog"
        aria-modal="true"
        aria-label={title ? `${title} chart` : 'Chart'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-header bg-white d-flex align-items-center justify-content-between gap-2">
          <h5 className="mb-0 text-truncate">{title || 'Chart'}</h5>
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={onClose} aria-label="Close modal">
            Close
          </button>
        </div>
        <div className="card-body app-modal-body">
          <div className="chart-modal-frame">
            {type === 'svg' && svgHtml ? (
              <div className="chart-modal-svg" dangerouslySetInnerHTML={{ __html: svgHtml }} />
            ) : null}
            {type === 'img' && imgSrc ? (
              <img src={imgSrc} alt={title || 'Chart'} className="img-fluid rounded border" />
            ) : null}
          </div>
        </div>
      </div>
    </div>
    ,
    document.body,
  )
}

export default ChartModal
