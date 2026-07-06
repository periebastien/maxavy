import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { LayoutTemplate, Plus, Trash2, Pencil, Loader2 } from 'lucide-react'
import AppLayout from '../components/layout/AppLayout'
import { useBusiness } from '../contexts/BusinessContext'
import { useLocations } from '../contexts/LocationContext'
import api from '../lib/api'
import { WIDGET_TYPES } from '../lib/widget-schema'

function styleLabel(type, styleKey) {
  const t = WIDGET_TYPES.find(w => w.type === type)
  const s = t && t.styles.find(x => x.key === styleKey)
  return `${t ? t.name : type}${s ? ' · ' + s.name : ''}`
}

export default function WidgetsPage() {
  const { activeBusiness } = useBusiness()
  const { activeLocation } = useLocations() || {}
  const navigate = useNavigate()
  const [widgets, setWidgets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const bid = activeBusiness?.id
  const lid = activeLocation?.id

  const load = useCallback(async () => {
    if (!bid) return
    setLoading(true)
    try {
      const params = lid ? `business_id=${bid}&location_id=${lid}` : `business_id=${bid}`
      setWidgets(await api.get(`/api/v1/widgets?${params}`))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [bid, lid])

  useEffect(() => { load() }, [load])

  async function remove(w) {
    if (!confirm(`Supprimer le widget « ${w.name} » ?`)) return
    try {
      await api.delete(`/api/v1/widgets/${w.id}?business_id=${bid}`)
      setWidgets(ws => ws.filter(x => x.id !== w.id))
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <AppLayout title="Widgets">
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-tertiary">Affichez vos avis Google sur votre site.</p>
          <button onClick={() => navigate('/widgets/new')} className="inline-flex items-center gap-1.5 bg-accent text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors">
            <Plus size={15} /> Créer un widget
          </button>
        </div>

        {error && <div className="text-sm text-danger bg-red-50 border border-red-100 rounded-lg px-4 py-3">{error}</div>}

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-accent" /></div>
        ) : widgets.length === 0 ? (
          <div className="text-center py-16 text-text-tertiary border border-dashed border-border rounded-2xl">
            <LayoutTemplate size={32} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-medium text-text-secondary">Aucun widget</p>
            <p className="text-xs mt-1">Créez un badge ou un carrousel pour afficher vos avis.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {widgets.map(w => (
              <div key={w.id} className="flex items-center justify-between gap-3 bg-white border border-border rounded-xl px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{w.name}</p>
                    {!w.location_id && (
                      <span className="text-[11px] text-text-tertiary bg-gray-50 border border-border rounded-full px-2 py-0.5 shrink-0">Toutes les localisations</span>
                    )}
                  </div>
                  <p className="text-xs text-text-tertiary">{styleLabel(w.type, w.config && w.config.style)}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => navigate(`/widgets/${w.id}`)} className="p-2 rounded-lg text-text-secondary hover:bg-gray-50 hover:text-accent transition-colors" title="Modifier">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => remove(w)} className="p-2 rounded-lg text-text-secondary hover:bg-red-50 hover:text-danger transition-colors" title="Supprimer">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
