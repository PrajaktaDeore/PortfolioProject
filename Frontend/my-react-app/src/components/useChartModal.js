import { useCallback, useEffect, useState } from 'react'

export function useChartModal() {
  const [modal, setModal] = useState({
    open: false,
    title: '',
    type: '',
    svgHtml: '',
    imgSrc: '',
  })

  const close = useCallback(() => {
    setModal((prev) => ({ ...prev, open: false }))
  }, [])

  useEffect(() => {
    if (!modal.open) return undefined

    const onKeyDown = (e) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [close, modal.open])

  const openSvg = useCallback((e, title) => {
    const svg = e?.currentTarget
    const svgHtml = svg?.outerHTML || ''
    setModal({
      open: true,
      title: title || 'Chart',
      type: 'svg',
      svgHtml,
      imgSrc: '',
    })
  }, [])

  const openImg = useCallback((e, title, src) => {
    const img = e?.currentTarget
    const imgSrc = src || img?.currentSrc || img?.src || ''
    setModal({
      open: true,
      title: title || 'Chart',
      type: 'img',
      svgHtml: '',
      imgSrc,
    })
  }, [])

  return { modal, close, openSvg, openImg }
}

