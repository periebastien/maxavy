import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Copy, Check, Loader2, ChevronDown } from 'lucide-react'
import AppLayout from '../components/layout/AppLayout'
import { useBusiness } from '../contexts/BusinessContext'
import { useLocations } from '../contexts/LocationContext'
import api from '../lib/api'
import { WIDGET_TYPES, DEFAULT_STYLE, SECTIONS, defaultConfig, fieldsFor } from '../lib/widget-schema'

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative w-9 h-5 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-gray-200'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${checked ? 'translate-x-4' : ''}`} />
    </button>
  )
}

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs px-2 py-1 rounded border transition-colors ${active ? 'border-accent text-accent bg-accent-light' : 'border-border text-text-secondary hover:bg-gray-50'}`}
    >
      {children}
    </button>
  )
}

function Accordion({ id, title, openSet, toggle, children }) {
  const isOpen = openSet.has(id)
  return (
    <div className="border border-border rounded-xl overflow-hidden bg-white">
      <button
        type="button"
        onClick={() => toggle(id)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="text-xs font-semibold text-text-primary tracking-wide">{title}</span>
        <ChevronDown size={15} className={`text-text-tertiary transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && <div className="px-3 pb-3 pt-3 border-t border-border">{children}</div>}
    </div>
  )
}

function ColorField({ value, onChange, allowAuto, allowTransparent, allowOpacity, transparentLabel }) {
  const m = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/.exec(value || '')
  const rgb = m ? '#' + m[1] : '#ffffff'
  const alpha = m && m[2] ? Math.round((parseInt(m[2], 16) / 255) * 100) : 100
  const combine = (hex6, pct) => pct >= 100 ? hex6 : hex6 + Math.round((pct / 100) * 255).toString(16).padStart(2, '0')
  const [hexInput, setHexInput] = useState(m ? rgb : '')
  useEffect(() => { setHexInput(m ? rgb : '') }, [rgb, m ? 1 : 0])
  const handleHexChange = e => {
    const v = e.target.value
    setHexInput(v)
    if (/^#?[0-9a-fA-F]{6}$/.test(v)) {
      const hex6 = ('#' + v.replace('#', '')).toLowerCase()
      onChange(combine(hex6, alpha))
    }
  }
  const handleHexBlur = () => setHexInput(m ? rgb : '')
  return (
    <div className="flex items-center gap-1.5">
      {allowAuto && <Chip active={value === 'auto'} onClick={() => onChange('auto')}>Auto</Chip>}
      {allowTransparent && <Chip active={value === 'transparent'} onClick={() => onChange('transparent')}>{transparentLabel || 'Transp.'}</Chip>}
      <input
        type="color"
        value={rgb}
        onChange={e => onChange(combine(e.target.value, alpha))}
        className="w-7 h-7 rounded border border-border cursor-pointer p-0 bg-white shrink-0"
        title="Couleur personnalisée"
      />
      <input
        type="text"
        value={hexInput}
        onChange={handleHexChange}
        onBlur={handleHexBlur}
        placeholder="#RRGGBB"
        className="w-20 h-7 px-1.5 rounded border border-border text-xs font-mono text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
      {allowOpacity && m && (
        <label className="flex items-center gap-1 text-xs text-text-tertiary" title="Opacité">
          <input
            type="range" min="0" max="100" step="5" value={alpha}
            onChange={e => onChange(combine(rgb, parseInt(e.target.value, 10)))}
            className="w-16 cursor-pointer"
          />
          <span className="tabular-nums w-8 text-right">{alpha}%</span>
        </label>
      )}
    </div>
  )
}

function FieldControl({ field, value, onChange }) {
  if (field.type === 'bool') return <Toggle checked={!!value} onChange={onChange} />
  if (field.type === 'color') return <ColorField value={value} onChange={onChange} allowAuto={field.allowAuto} allowTransparent={field.allowTransparent} allowOpacity={field.allowOpacity} transparentLabel={field.transparentLabel} />
  if (field.type === 'enum') {
    return (
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-8 px-2 rounded-lg border border-border text-sm text-text-primary bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
      >
        {field.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    )
  }
  if (field.type === 'number') {
    return (
      <input
        type="number"
        value={value}
        min={field.min} max={field.max} step={field.step}
        onChange={e => onChange(e.target.value === '' ? field.min : parseInt(e.target.value, 10))}
        className="w-20 h-8 px-2 rounded-lg border border-border text-sm text-text-primary bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
      />
    )
  }
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-40 h-8 px-2 rounded-lg border border-border text-sm text-text-primary bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
    />
  )
}

function PreviewFrame({ payload }) {
  const ref = useRef(null)
  const ready = useRef(false)
  const pending = useRef(null)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  const srcDoc = useMemo(() => (
    '<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0}body{padding:18px;background:#f5f4f0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}</style></head><body><div id="root"></div>'
    + '<script src="' + origin + '/api/v1/widgets/runtime.js?v=' + Date.now() + '"></script>'
    + '<script>window.addEventListener("message",function(e){if(e.data&&e.data.__lcgw&&window.__lcgw){window.__lcgw.render(document.getElementById("root"),e.data.__lcgw)}});parent.postMessage({__lcgwReady:1},"*")</script>'
    + '</body></html>'
  ), [origin])

  const post = useCallback((p) => {
    const w = ref.current && ref.current.contentWindow
    if (w) w.postMessage({ __lcgw: p }, '*')
  }, [])

  useEffect(() => {
    function onMsg(e) {
      if (e.data && e.data.__lcgwReady) {
        ready.current = true
        if (pending.current) post(pending.current)
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [post])

  useEffect(() => {
    if (!payload) return
    if (ready.current) post(payload)
    else pending.current = payload
  }, [payload, post])

  return <iframe ref={ref} title="Aperçu du widget" srcDoc={srcDoc} className="w-full h-[440px] rounded-xl border border-border" />
}

export default function WidgetBuilderPage() {
  const { id } = useParams()
  const editing = !!id
  const navigate = useNavigate()
  const { activeBusiness } = useBusiness()
  const { locations = [], activeLocation } = useLocations() || {}

  const [name, setName] = useState('Mon widget')
  const [type, setType] = useState('carousel')
  const [config, setConfig] = useState(() => defaultConfig('carousel'))
  const [locationId, setLocationId] = useState('')
  const [tagId, setTagId] = useState('')
  const [tags, setTags] = useState([])
  const [embedCode, setEmbedCode] = useState('')
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(editing)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(null)
  const [openSections, setOpenSections] = useState(() => new Set(['source']))
  const locationPrefilled = useRef(false)

  useEffect(() => {
    if (editing || locationPrefilled.current || !activeLocation) return
    locationPrefilled.current = true
    setLocationId(activeLocation.id)
  }, [editing, activeLocation])

  function toggleSection(sid) {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(sid)) next.delete(sid)
      else next.add(sid)
      return next
    })
  }

  const style = config.style
  const bid = activeBusiness?.id

  useEffect(() => {
    if (!bid) return
    api.get(`/api/v1/tags?business_id=${bid}`).then(setTags).catch(() => setTags([]))
  }, [bid])

  useEffect(() => {
    if (!editing || !bid) return
    setLoading(true)
    api.get(`/api/v1/widgets/${id}?business_id=${bid}`)
      .then(w => {
        setName(w.name || 'Mon widget')
        setType(w.type)
        const base = defaultConfig(w.type)
        setConfig({
          version: 1,
          style: (w.config && w.config.style) || DEFAULT_STYLE[w.type],
          common: { ...base.common, ...(w.config && w.config.common) },
          badge: { ...base.badge, ...(w.config && w.config.badge) },
          carousel: { ...base.carousel, ...(w.config && w.config.carousel) },
        })
        setLocationId(w.location_id || '')
        setTagId(w.tag_id || '')
        setEmbedCode(w.embed_code || '')
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [editing, id, bid])

  // Aperçu live (debounce) via /preview — la config NON persistée est rendue par le vrai runtime.
  useEffect(() => {
    if (!bid) return
    const t = setTimeout(() => {
      api.post(`/api/v1/widgets/preview?business_id=${bid}`, { type, config, locationId: locationId || null, tagId: tagId || null })
        .then(setPayload)
        .catch(() => {})
    }, 300)
    return () => clearTimeout(t)
  }, [bid, type, config, locationId, tagId])

  function setStyle(s) { setConfig(c => ({ ...c, style: s })) }
  function setType2(t) { setType(t); setConfig(c => ({ ...c, style: DEFAULT_STYLE[t] })) }
  function setField(scope, key, val) {
    setConfig(c => ({ ...c, [scope]: { ...c[scope], [key]: val } }))
  }

  async function save() {
    if (!bid) return
    setSaving(true); setError(null)
    try {
      if (editing) {
        const w = await api.patch(`/api/v1/widgets/${id}?business_id=${bid}`, { name, location_id: locationId || null, tag_id: tagId || null, config })
        setEmbedCode(w.embed_code || '')
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      } else {
        const w = await api.post(`/api/v1/widgets?business_id=${bid}`, { name, type, locationId: locationId || null, tagId: tagId || null, config })
        navigate(`/widgets/${w.id}`, { replace: true })
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  function copyEmbed() {
    navigator.clipboard.writeText(embedCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const fields = fieldsFor(type, style)
  const emptySource = payload && payload.aggregate && payload.aggregate.count === 0

  if (loading) {
    return <AppLayout title="Widget"><div className="flex justify-center py-20"><Loader2 className="animate-spin text-accent" /></div></AppLayout>
  }

  return (
    <AppLayout title={editing ? 'Modifier le widget' : 'Nouveau widget'}>
      <div className="max-w-6xl mx-auto">
        <button onClick={() => navigate('/widgets')} className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary mb-4">
          <ArrowLeft size={15} /> Retour aux widgets
        </button>

        {error && <div className="text-sm text-danger bg-red-50 border border-red-100 rounded-lg px-4 py-3 mb-4">{error}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,360px)_1fr] gap-6">
          {/* ── Colonne config ── */}
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Nom du widget</label>
              <input value={name} onChange={e => setName(e.target.value)} className="w-full h-9 px-3 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent" />
            </div>

            {/* Type + style */}
            <div>
              <p className="text-xs font-medium text-text-secondary mb-1.5">Type</p>
              <div className="grid grid-cols-2 gap-2">
                {WIDGET_TYPES.map(t => (
                  <button
                    key={t.type}
                    onClick={() => !editing && setType2(t.type)}
                    disabled={editing && type !== t.type}
                    className={`text-left px-3 py-2 rounded-lg border text-sm transition-colors ${type === t.type ? 'border-accent bg-accent-light text-accent' : 'border-border text-text-secondary hover:bg-gray-50'} ${editing && type !== t.type ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    <span className="font-medium block">{t.name}</span>
                    <span className="text-xs text-text-tertiary">{t.desc}</span>
                  </button>
                ))}
              </div>
              {editing && <p className="text-xs text-text-tertiary mt-1">Le type n'est pas modifiable après création.</p>}
            </div>

            <div>
              <p className="text-xs font-medium text-text-secondary mb-1.5">Style</p>
              <div className="flex flex-wrap gap-2">
                {WIDGET_TYPES.find(t => t.type === type).styles.map(s => (
                  <Chip key={s.key} active={style === s.key} onClick={() => setStyle(s.key)}>{s.name}</Chip>
                ))}
              </div>
            </div>

            {/* Paramètres en accordéons */}
            <div className="space-y-2">
              <Accordion id="source" title="Source des avis" openSet={openSections} toggle={toggleSection}>
                <div className="space-y-2">
                  <select value={locationId} onChange={e => setLocationId(e.target.value)} className="w-full h-9 px-2 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/30">
                    <option value="">Toutes les localisations</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}{l.address ? ` — ${l.address}` : ''}</option>)}
                  </select>
                  <select value={tagId} onChange={e => setTagId(e.target.value)} className="w-full h-9 px-2 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/30">
                    <option value="">Tous les tags</option>
                    {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </Accordion>

              {SECTIONS.map(([secKey, secLabel]) => {
                const secFields = fields.filter(f => f.section === secKey)
                if (!secFields.length) return null
                return (
                  <Accordion key={secKey} id={secKey} title={secLabel} openSet={openSections} toggle={toggleSection}>
                    <div className="space-y-2.5">
                      {secFields.map(f => (
                        <div key={f.scope + f.key} className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <span className="text-sm text-text-secondary">{f.label}</span>
                            {f.note && <span className="block text-xs text-text-tertiary">{f.note}</span>}
                          </div>
                          <FieldControl field={f} value={config[f.scope][f.key]} onChange={v => setField(f.scope, f.key, v)} />
                        </div>
                      ))}
                    </div>
                  </Accordion>
                )
              })}
            </div>
          </div>

          {/* ── Colonne aperçu ── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-text-secondary">Aperçu en direct</p>
              <div className="flex items-center gap-2">
                {saved && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                    <Check size={14} /> Enregistré
                  </span>
                )}
                <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 bg-accent text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                  {editing ? 'Enregistrer' : 'Créer le widget'}
                </button>
              </div>
            </div>

            <PreviewFrame payload={payload} />

            {emptySource && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                Aucun avis pour cette source — le widget restera masqué sur le site tant qu'il n'y a pas d'avis.
              </p>
            )}

            {/* Code d'intégration */}
            {editing && embedCode && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-medium text-text-secondary">Code d'intégration</p>
                  <button onClick={copyEmbed} className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
                    {copied ? <><Check size={12} /> Copié</> : <><Copy size={12} /> Copier</>}
                  </button>
                </div>
                <pre className="text-xs bg-bg-page border border-border rounded-lg p-3 overflow-x-auto text-text-secondary font-mono whitespace-pre-wrap break-all">{embedCode}</pre>
                <p className="text-xs text-text-tertiary mt-1.5">Collez ce code sur votre site à l'endroit où afficher le widget.</p>
              </div>
            )}
            {!editing && (
              <p className="text-xs text-text-tertiary">Le code d'intégration s'affichera après la création du widget.</p>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
