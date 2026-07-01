import { useRef, useState, useEffect } from 'react'
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react'
import { Download, Copy, Check, MapPin } from 'lucide-react'
import AppLayout from '../components/layout/AppLayout'
import { useBusiness } from '../contexts/BusinessContext'
import { useLocations } from '../contexts/LocationContext'

const QR_DISPLAY  = 240
const QR_DOWNLOAD = 1024

export default function QRCodePage() {
  const { activeBusiness } = useBusiness()
  const { locations = [], activeLocation, setActiveLocation } = useLocations() || {}
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (activeBusiness) localStorage.setItem(`qr_visited_${activeBusiness.id}`, '1')
  }, [activeBusiness?.id])

  const displayRef  = useRef(null) // div wrapping the display QRCodeCanvas
  const downloadRef = useRef(null) // div wrapping the hidden 1024px QRCodeCanvas (no logo — safe for toDataURL)
  const svgRef      = useRef(null) // div wrapping the hidden QRCodeSVG

  if (!activeBusiness || !activeLocation) {
    return (
      <AppLayout title="QR Code">
        <div className="flex items-center gap-2 text-text-secondary text-sm">
          <MapPin size={15} />
          Sélectionnez une localisation pour générer son QR code.
        </div>
      </AppLayout>
    )
  }

  const baseUrl    = import.meta.env.VITE_APP_URL || window.location.origin
  const collectUrl = `${baseUrl}/avis/${activeBusiness.slug}/${activeLocation.slug}`
  const logoUrl    = activeBusiness.feedback_page_config?.branding?.logo_url || null

  const imageSettings = logoUrl ? {
    src:      logoUrl,
    height:   Math.round(QR_DISPLAY * 0.22),
    width:    Math.round(QR_DISPLAY * 0.22),
    excavate: true,
  } : undefined

  async function downloadPng() {
    // Essaie d'abord le canvas d'affichage (avec logo). Si tainted (CORS), utilise le canvas propre.
    const displayCanvas  = displayRef.current?.querySelector('canvas')
    const fallbackCanvas = downloadRef.current?.querySelector('canvas')
    let dataUrl
    try {
      dataUrl = displayCanvas?.toDataURL('image/png')
    } catch {
      dataUrl = fallbackCanvas?.toDataURL('image/png')
    }
    if (!dataUrl) return
    trigger(dataUrl, `qrcode-${activeLocation.slug}.png`)
  }

  function downloadSvg() {
    const svgEl = svgRef.current?.querySelector('svg')
    if (!svgEl) return
    const svg = new XMLSerializer().serializeToString(svgEl)
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url  = URL.createObjectURL(blob)
    trigger(url, `qrcode-${activeLocation.slug}.svg`)
    URL.revokeObjectURL(url)
  }

  function trigger(href, filename) {
    const a = document.createElement('a')
    a.href = href; a.download = filename; a.click()
  }

  async function copyUrl() {
    await navigator.clipboard.writeText(collectUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <AppLayout title="QR Code">
      <div className="max-w-sm space-y-6">

        {/* Sélecteur de localisation (si plusieurs) */}
        {locations.length > 1 && (
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Localisation</label>
            <select
              value={activeLocation.id}
              onChange={e => {
                const loc = locations.find(l => l.id === e.target.value)
                if (loc) setActiveLocation(loc)
              }}
              className="w-full h-10 px-3 rounded-xl border border-border text-sm text-text-primary bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            >
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name}{loc.address ? ` — ${loc.address}` : ''}</option>
              ))}
            </select>
          </div>
        )}

        {/* Carte QR */}
        <div className="bg-white border border-border rounded-2xl p-8 flex flex-col items-center gap-6">

          {/* QR affiché (avec logo si configuré) */}
          <div ref={displayRef} className="p-3 rounded-xl border border-border shadow-sm">
            <QRCodeCanvas
              value={collectUrl}
              size={QR_DISPLAY}
              level="H"
              marginSize={1}
              imageSettings={imageSettings}
            />
          </div>

          {/* Identité */}
          <div className="text-center">
            <p className="text-sm font-semibold text-text-primary">{activeLocation.name}</p>
            <p className="text-xs text-text-tertiary mt-0.5">{activeBusiness.name}</p>
          </div>

          {/* URL + copier */}
          <div className="w-full flex items-center gap-2 px-3 py-2 bg-bg-page border border-border rounded-xl">
            <span className="flex-1 text-xs font-mono text-text-secondary truncate">{collectUrl}</span>
            <button
              type="button"
              onClick={copyUrl}
              className="shrink-0 text-text-tertiary hover:text-accent transition-colors"
              title="Copier le lien"
            >
              {copied
                ? <Check size={14} className="text-success" />
                : <Copy size={14} />
              }
            </button>
          </div>

          {/* Téléchargements */}
          <div className="flex gap-3 w-full">
            <button
              type="button"
              onClick={downloadPng}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-accent text-white text-sm font-medium py-2.5 rounded-xl hover:bg-violet-700 transition-colors"
            >
              <Download size={15} /> PNG
            </button>
            <button
              type="button"
              onClick={downloadSvg}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-white border border-border text-text-primary text-sm font-medium py-2.5 rounded-xl hover:bg-bg-page transition-colors"
            >
              <Download size={15} /> SVG
            </button>
          </div>
        </div>

        <p className="text-xs text-text-tertiary leading-relaxed">
          Le slug <span className="font-mono text-text-secondary">/{activeLocation.slug}</span> est permanent.
          Vous pouvez imprimer et distribuer ce QR code en toute sécurité — même si vous modifiez
          le mode ou le branding de la page, l'URL ne change pas.
        </p>
      </div>

      {/* Canvas haute résolution (1024 px, sans logo) — pour le téléchargement PNG fiable */}
      <div ref={downloadRef} style={{ position: 'absolute', left: -9999, top: -9999, opacity: 0, pointerEvents: 'none' }}>
        <QRCodeCanvas value={collectUrl} size={QR_DOWNLOAD} level="H" marginSize={2} />
      </div>

      {/* SVG haute résolution — pour le téléchargement SVG */}
      <div ref={svgRef} style={{ position: 'absolute', left: -9999, top: -9999, opacity: 0, pointerEvents: 'none' }}>
        <QRCodeSVG value={collectUrl} size={QR_DOWNLOAD} level="H" marginSize={2} />
      </div>
    </AppLayout>
  )
}
