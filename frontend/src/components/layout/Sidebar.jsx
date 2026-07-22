import { useState, useRef, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, MapPin, Eye, MessageSquare, Users, Mail,
  QrCode, LayoutTemplate, BarChart2, FileText, Image, LogOut, ChevronDown, Plus, User, Globe, Zap, CreditCard, X,
  Settings2, LineChart, Swords
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useBusiness } from '../../contexts/BusinessContext'
import { useLocations } from '../../contexts/LocationContext'
import { useClickOutside } from '../../lib/useClickOutside'
import { faviconUrl } from '../../lib/favicon'
import { gravatarUrl } from '../../lib/gravatar'
import EntityAvatar from '../common/EntityAvatar'
import api from '../../lib/api'

const sections = [
  {
    title: 'TABLEAU DE BORD',
    items: [
      { label: 'Vue d\'ensemble', to: '/dashboard', icon: LayoutDashboard },
      { label: 'Localisations', to: '/locations', icon: MapPin },
    ]
  },
  {
    title: 'AVIS',
    items: [
      { label: 'Surveillance', to: '/reviews', icon: Eye },
      { label: 'Concurrents', to: '/reviews/concurrents', icon: Swords },
      { label: 'Répondre', to: '/reviews/reply', icon: MessageSquare, soon: true },
    ]
  },
  {
    title: 'CLIENTS',
    items: [
      { label: 'Liste clients', to: '/customers', icon: Users },
      { label: 'Invitations', to: '/invitations', icon: Mail },
    ]
  },
  {
    title: 'COLLECTE',
    items: [
      { label: 'Page de collecte', to: '/parametres-page-collecte', icon: Globe },
      { label: 'QR Code', to: '/qrcode', icon: QrCode },
      { label: 'Widgets', to: '/widgets', icon: LayoutTemplate },
    ]
  },
  {
    title: 'POSITIONNEMENT',
    items: [
      { label: 'Configuration', to: '/positionnement/configuration', icon: Settings2 },
      { label: 'Suivi', to: '/positionnement/suivi', icon: LineChart },
      { label: 'Concurrents', to: '/positionnement/concurrents', icon: Swords },
    ]
  },
  {
    title: 'MODULES',
    items: [
      { label: 'Concurrence', to: '/competitors', icon: BarChart2, soon: true },
      { label: 'Publications GBP', to: '/gbp-posts', icon: FileText, soon: true },
      { label: 'Photos GBP', to: '/gbp-photos', icon: Image, soon: true },
    ]
  },
  {
    title: 'FACTURATION',
    items: [
      { label: 'Crédits', to: '/credits', icon: Zap },
      { label: 'Plans & Tarifs', to: '/pricing', icon: CreditCard },
    ]
  },
  {
    title: 'ENTREPRISE',
    items: [
      { label: 'Paramètres', to: '/settings', icon: Settings2 },
    ]
  },
]

function NavItem({ item, onClose }) {
  const Icon = item.icon

  if (item.soon) {
    return (
      <div className="flex items-center justify-between px-3 py-1.5 rounded-lg text-sm text-text-tertiary cursor-default">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={15} />}
          <span>{item.label}</span>
        </div>
        <span className="text-xs bg-gray-100 text-text-tertiary px-1.5 py-0.5 rounded">bientôt</span>
      </div>
    )
  }
  return (
    <NavLink
      to={item.to}
      onClick={onClose}
      className={({ isActive }) =>
        `flex items-center justify-between px-3 py-1.5 rounded-lg text-sm transition-colors ${
          isActive
            ? 'bg-accent-light text-accent font-medium'
            : 'text-text-secondary hover:bg-gray-50 hover:text-text-primary'
        }`
      }
    >
      <div className="flex items-center gap-2">
        {Icon && <Icon size={15} />}
        <span>{item.label}</span>
      </div>
      {item.count !== undefined && (
        <span className="text-xs text-text-tertiary">{item.count}</span>
      )}
    </NavLink>
  )
}

/* ── Sélecteur de LOCALISATION active (haut de sidebar) ──
   C'est le périmètre de travail courant (avis, invitations, QR…). */
function LocationSelector({ onClose }) {
  const { locations, activeLocation, setActiveLocation } = useLocations()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useClickOutside(ref, () => setOpen(false), open)

  return (
    <div ref={ref} className="relative px-3 pb-3 border-b border-border">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 p-2 rounded-lg text-left transition-colors hover:bg-gray-50 cursor-pointer"
      >
        {activeLocation
          ? <EntityAvatar name={activeLocation.name} src={faviconUrl(activeLocation.website_url)} size={32} />
          : <div className="w-8 h-8 rounded-lg bg-accent-light flex items-center justify-center text-accent shrink-0"><MapPin size={16} /></div>
        }
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text-primary truncate">{activeLocation?.name || 'Aucune localisation'}</p>
          <p className="text-xs text-text-tertiary truncate">{activeLocation?.address || 'Localisation active'}</p>
        </div>
        <ChevronDown size={14} className={`text-text-tertiary shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-3 right-3 top-full mt-1 bg-white border border-border rounded-xl shadow-lg z-50 overflow-hidden">
          {locations.map(loc => (
            <button
              key={loc.id}
              onClick={() => { setActiveLocation(loc); setOpen(false); onClose?.() }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-bg-page transition-colors border-b border-border last:border-0 ${loc.id === activeLocation?.id ? 'bg-accent-light' : ''}`}
            >
              <EntityAvatar name={loc.name} src={faviconUrl(loc.website_url)} size={28} />
              <div className="min-w-0">
                <p className="text-sm text-text-primary truncate">{loc.name}</p>
                {loc.address && <p className="text-xs text-text-tertiary truncate">{loc.address}</p>}
              </div>
            </button>
          ))}
          <button
            onClick={() => { setOpen(false); onClose?.(); navigate('/locations') }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-bg-page transition-colors text-accent"
          >
            <Plus size={14} className="shrink-0" />
            <span className="text-sm font-medium">Ajouter une localisation</span>
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Menu COMPTE UTILISATEUR (bas de sidebar) ──
   Le sous-menu s'étoffera (profil, sécurité, équipe…). */
function AccountMenu({ user }) {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [avatarSrc, setAvatarSrc] = useState(null)
  const ref = useRef(null)
  useClickOutside(ref, () => setOpen(false), open)

  useEffect(() => {
    gravatarUrl(user?.email, 56).then(setAvatarSrc)
  }, [user?.email])

  function handleLogout() { logout(); navigate('/login') }
  const displayName = `${user?.firstname || ''} ${user?.lastname || ''}`.trim() || user?.email || 'Utilisateur'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left hover:bg-gray-50 transition-colors cursor-pointer"
      >
        <EntityAvatar name={displayName} src={avatarSrc} size={28} shape="circle" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-text-primary truncate">{displayName}</p>
          <p className="text-xs text-text-tertiary truncate">{user?.email}</p>
        </div>
        <ChevronDown size={13} className={`text-text-tertiary shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 bottom-full mb-1 bg-white border border-border rounded-xl shadow-lg z-50 overflow-hidden">
          <button
            onClick={() => { setOpen(false); navigate('/account') }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm text-text-secondary hover:bg-gray-50 hover:text-text-primary transition-colors"
          >
            <User size={14} /> Mon compte
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm text-text-secondary hover:bg-red-50 hover:text-danger transition-colors border-t border-border"
          >
            <LogOut size={14} /> Se déconnecter
          </button>
        </div>
      )}
    </div>
  )
}

const LOW_CREDIT_THRESHOLD = 100

export default function Sidebar({ user, open = false, onClose }) {
  const { activeBusiness } = useBusiness()
  const { locations = [], activeLocation } = useLocations() || {}
  const [credits, setCredits] = useState(0)
  const [counts, setCounts] = useState({ customers: null, widgets: null, reviews: null })

  useEffect(() => {
    if (!activeBusiness) return
    api.get(`/api/v1/credits/balance?business_id=${activeBusiness.id}`)
      .then(b => setCredits(b.balance ?? 0))
      .catch(() => {})
  }, [activeBusiness])

  useEffect(() => {
    if (!activeBusiness) return
    const locationParam = activeLocation ? `&location_id=${activeLocation.id}` : ''

    api.get(`/api/v1/customers/stats?business_id=${activeBusiness.id}${locationParam}`)
      .then(s => setCounts(c => ({ ...c, customers: s.total })))
      .catch(() => {})

    api.get(`/api/v1/widgets?business_id=${activeBusiness.id}${locationParam}`)
      .then(w => setCounts(c => ({ ...c, widgets: w.length })))
      .catch(() => {})

    api.get(`/api/v1/reviews?business_id=${activeBusiness.id}${locationParam}&limit=1`)
      .then(r => setCounts(c => ({ ...c, reviews: r.total })))
      .catch(() => {})
  }, [activeBusiness, activeLocation])

  return (
    <aside
      className={`w-60 bg-white border-r border-border flex flex-col h-screen fixed left-0 top-0 z-40 transition-transform lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
    >
      {/* Logo + fermeture mobile */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="text-lg font-semibold text-accent">GMB Manager</span>
        <button onClick={onClose} className="lg:hidden text-text-tertiary hover:text-text-primary" aria-label="Fermer le menu">
          <X size={18} />
        </button>
      </div>

      {/* Sélecteur de localisation active */}
      <div className="px-0 pt-3">
        <LocationSelector onClose={onClose} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {sections.map(section => (
          <div key={section.title}>
            <p className="text-xs font-medium text-text-tertiary px-3 mb-1 tracking-wide">{section.title}</p>
            <div className="space-y-0.5">
              {section.items.map(item => (
                <NavItem
                  key={item.to}
                  item={
                    item.to === '/locations' ? { ...item, count: locations.length }
                    : item.to === '/customers' ? { ...item, count: counts.customers ?? undefined }
                    : item.to === '/widgets' ? { ...item, count: counts.widgets ?? undefined }
                    : item.to === '/reviews' ? { ...item, count: counts.reviews ?? undefined }
                    : item
                  }
                  onClose={onClose}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Bas de sidebar */}
      <div className="px-3 py-4 border-t border-border space-y-3">
        {/* Crédits */}
        <NavLink to="/credits" onClick={onClose} className="block px-3 group">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-text-secondary group-hover:text-accent transition-colors">Crédits</span>
            <span className={`text-xs flex items-center gap-1 ${
              credits <= 0 ? 'text-danger font-bold' : credits < LOW_CREDIT_THRESHOLD ? 'text-danger font-medium' : 'text-text-primary font-medium'
            }`}>
              {credits ?? 0}
              <Zap size={10} className={credits <= 0 ? 'text-danger' : 'text-accent'} />
            </span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full" style={{ width: `${Math.min((credits / 500) * 100, 100)}%` }} />
          </div>
        </NavLink>
        {/* Bouton Upgrade */}
        <NavLink
          to="/pricing"
          onClick={onClose}
          className="block w-full bg-accent text-white text-sm font-medium py-2 rounded-lg hover:bg-violet-700 transition-colors text-center"
        >
          Upgrade
        </NavLink>
        {/* Compte utilisateur */}
        <AccountMenu user={user} />
      </div>
    </aside>
  )
}
