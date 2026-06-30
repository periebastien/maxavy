import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, Plus, Pencil, Trash2 } from 'lucide-react'
import { useBusiness } from '../../contexts/BusinessContext'
import { useClickOutside } from '../../lib/useClickOutside'
import { faviconUrl } from '../../lib/favicon'
import EntityAvatar from '../common/EntityAvatar'
import api from '../../lib/api'

/* ── Sélecteur d'ENTREPRISE active (tenant), en haut à droite ──
   Switch de tenant + gestion rapide (modifier → Settings, supprimer). */
function BusinessSelector() {
  const { businesses, activeBusiness, setActiveBusiness, refresh } = useBusiness()
  const navigate    = useNavigate()
  const [open, setOpen]           = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const ref = useRef(null)
  useClickOutside(ref, () => setOpen(false), open)

  if (!activeBusiness) return null

  async function handleDelete(e, b) {
    e.stopPropagation()
    if (!window.confirm(`Supprimer « ${b.name} » et toutes ses localisations ?`)) return
    setDeletingId(b.id)
    try {
      await api.delete(`/api/v1/businesses/${b.id}`)
      const remaining = await refresh()
      setOpen(false)
      if (!remaining || remaining.length === 0) navigate('/onboarding')
    } catch (err) {
      window.alert(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  function handleEdit(e, b) {
    e.stopPropagation()
    setActiveBusiness(b)
    setOpen(false)
    navigate('/settings')
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
      >
        <EntityAvatar name={activeBusiness.name} src={faviconUrl(activeBusiness.website_url)} size={28} shape="circle" />
        <span className="text-sm text-text-primary font-medium max-w-[160px] truncate">{activeBusiness.name}</span>
        <ChevronDown size={14} className={`text-text-tertiary shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 bg-white border border-border rounded-xl shadow-lg z-50 overflow-hidden">
          <p className="px-3 pt-2.5 pb-1 text-xs font-medium text-text-tertiary uppercase tracking-wide">Entreprises</p>

          {businesses.map(b => (
            <div
              key={b.id}
              className={`flex items-center gap-2 px-3 py-2.5 border-b border-border last:border-0 group transition-colors
                ${b.id === activeBusiness.id ? 'bg-accent-light' : 'hover:bg-bg-page'}`}
            >
              {/* Zone de sélection */}
              <button
                onClick={() => { setActiveBusiness(b); setOpen(false) }}
                className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
              >
                <EntityAvatar name={b.name} src={faviconUrl(b.website_url)} size={26} shape="circle" />
                <span className="text-sm text-text-primary truncate">{b.name}</span>
              </button>

              {/* Icônes d'action — visibles au survol de la ligne */}
              <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={e => handleEdit(e, b)}
                  title="Modifier"
                  className="p-1.5 rounded text-text-tertiary hover:text-accent hover:bg-white transition-colors"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={e => handleDelete(e, b)}
                  title="Supprimer"
                  disabled={deletingId === b.id}
                  className="p-1.5 rounded text-text-tertiary hover:text-danger hover:bg-red-50 transition-colors disabled:opacity-40"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={() => { setOpen(false); navigate('/onboarding') }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-bg-page transition-colors text-accent"
          >
            <Plus size={14} className="shrink-0" />
            <span className="text-sm font-medium">Ajouter une entreprise</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default function TopBar({ title, actions }) {
  return (
    <header className="h-14 bg-white border-b border-border flex items-center justify-between px-6 sticky top-0 z-10">
      <h1 className="text-lg font-semibold text-text-primary">{title}</h1>
      <div className="flex items-center gap-3">
        {actions}
        <div className="pl-3 border-l border-border">
          <BusinessSelector />
        </div>
      </div>
    </header>
  )
}
