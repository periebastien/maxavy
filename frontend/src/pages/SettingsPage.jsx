import { useState, useEffect } from 'react'
import { Check, MapPin, ChevronRight, Link2, Link2Off, AlertCircle } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AppLayout from '../components/layout/AppLayout'
import Input from '../components/common/Input'
import Select from '../components/common/Select'
import Button from '../components/common/Button'
import { useBusiness } from '../contexts/BusinessContext'
import { useLocations } from '../contexts/LocationContext'
import api from '../lib/api'
import TeamSection from '../components/settings/TeamSection'

const COUNTRIES = [
  { code: 'FR', label: 'France' },
  { code: 'BE', label: 'Belgique' },
  { code: 'CH', label: 'Suisse' },
  { code: 'LU', label: 'Luxembourg' },
  { code: 'CA', label: 'Canada' },
  { code: 'MA', label: 'Maroc' },
  { code: 'TN', label: 'Tunisie' },
  { code: 'SN', label: 'Sénégal' },
]

const TIMEZONES = [
  { value: 'Europe/Paris',      label: 'Europe/Paris (UTC+1/+2)' },
  { value: 'Europe/Brussels',   label: 'Europe/Brussels (UTC+1/+2)' },
  { value: 'Europe/Zurich',     label: 'Europe/Zurich (UTC+1/+2)' },
  { value: 'Europe/Luxembourg', label: 'Europe/Luxembourg (UTC+1/+2)' },
  { value: 'America/Montreal',  label: 'America/Montréal (UTC-5/-4)' },
  { value: 'Africa/Casablanca', label: 'Africa/Casablanca (UTC+1)' },
  { value: 'Africa/Tunis',      label: 'Africa/Tunis (UTC+1)' },
  { value: 'Africa/Dakar',      label: 'Africa/Dakar (UTC+0)' },
]

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/

const NOTIF_OPTIONS = [
  { key: 'email_new_review',    label: 'Nouvel avis reçu',       description: 'Recevoir un email à chaque nouvel avis synchronisé.' },
  { key: 'email_negative_review', label: 'Avis négatif (≤ 3★)',  description: 'Alerte immédiate en cas d\'avis négatif.' },
  { key: 'email_weekly_report', label: 'Rapport hebdomadaire',   description: 'Résumé hebdomadaire de votre e-réputation.' },
  { key: 'email_scan_report',   label: 'Rapports de positionnement', description: 'Notification à chaque rapport geogrid terminé.' },
]

function Toggle({ checked, onChange, label, description }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between gap-4 py-2 text-left"
    >
      <div>
        <p className="text-sm font-medium text-text-primary">{label}</p>
        {description && <p className="text-xs text-text-secondary mt-0.5">{description}</p>}
      </div>
      <span className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-gray-200'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
      </span>
    </button>
  )
}

function Section({ title, description, children }) {
  return (
    <div className="bg-white border border-border rounded-xl">
      <div className="px-6 py-4 border-b border-border">
        <p className="text-sm font-semibold text-text-primary">{title}</p>
        {description && <p className="text-xs text-text-secondary mt-0.5">{description}</p>}
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

export default function SettingsPage() {
  const { activeBusiness, refresh } = useBusiness()
  const { locations = [] } = useLocations() || {}
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [form, setForm]       = useState({
    name: '', website_url: '', country: 'FR', timezone: 'Europe/Paris',
    logo_url: '', contact_email: '', contact_phone: '', address: '', slug: '',
  })
  const [notifs, setNotifs]   = useState({})
  const [notifError, setNotifError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError]     = useState('')

  const [googleStatus, setGoogleStatus]       = useState(null)
  const [googleLoading, setGoogleLoading]     = useState(false)
  const [googleNotif, setGoogleNotif]         = useState(null)

  useEffect(() => {
    if (!activeBusiness) return
    setForm({
      name:        activeBusiness.name        || '',
      website_url: activeBusiness.website_url || '',
      country:     activeBusiness.country     || 'FR',
      timezone:    activeBusiness.timezone    || 'Europe/Paris',
      logo_url:      activeBusiness.logo_url      || '',
      contact_email: activeBusiness.contact_email || '',
      contact_phone: activeBusiness.contact_phone || '',
      address:       activeBusiness.address       || '',
      slug:          activeBusiness.slug          || '',
    })
    setNotifs(activeBusiness.notification_prefs || {})
    loadGoogleStatus()
  }, [activeBusiness?.id])

  useEffect(() => {
    const g = searchParams.get('google')
    if (!g) return
    if (g === 'connected') {
      setGoogleNotif({ type: 'success', message: 'Compte Google connecté avec succès.' })
      loadGoogleStatus()
    } else if (g === 'error') {
      const reason = searchParams.get('reason') || 'Erreur lors de la connexion Google.'
      setGoogleNotif({ type: 'error', message: reason })
    }
    setSearchParams({}, { replace: true })
  }, [])

  async function loadGoogleStatus() {
    if (!activeBusiness) return
    try {
      const data = await api.get(`/api/v1/google/status?businessId=${activeBusiness.id}`)
      setGoogleStatus(data)
    } catch {}
  }

  async function handleGoogleConnect() {
    setGoogleLoading(true); setGoogleNotif(null)
    try {
      const { url } = await api.get(`/api/v1/google/auth-url?businessId=${activeBusiness.id}`)
      window.location.href = url
    } catch (err) {
      setGoogleNotif({ type: 'error', message: err.message })
      setGoogleLoading(false)
    }
  }

  async function handleGoogleDisconnect() {
    if (!confirm('Déconnecter le compte Google ?')) return
    setGoogleLoading(true); setGoogleNotif(null)
    try {
      await api.delete(`/api/v1/google/disconnect?businessId=${activeBusiness.id}`)
      setGoogleStatus({ connected: false })
      setGoogleNotif({ type: 'success', message: 'Compte Google déconnecté.' })
    } catch (err) {
      setGoogleNotif({ type: 'error', message: err.message })
    } finally {
      setGoogleLoading(false)
    }
  }

  async function handleNotifChange(key, value) {
    const next = { ...notifs, [key]: value }
    setNotifs(next)
    setNotifError('')
    try {
      await api.patch(`/api/v1/businesses/${activeBusiness.id}`, { notification_prefs: next })
      await refresh()
    } catch (err) {
      setNotifs(notifs)
      setNotifError(err.message)
    }
  }

  function set(field) {
    return e => { setSuccess(false); setForm(f => ({ ...f, [field]: e.target.value })) }
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Le nom est requis'); return }
    const slug = form.slug.trim()
    if (slug && !SLUG_RE.test(slug)) {
      setError('Slug invalide : minuscules, chiffres et tirets uniquement (ex : mon-entreprise)')
      return
    }
    setLoading(true); setError(''); setSuccess(false)
    try {
      await api.patch(`/api/v1/businesses/${activeBusiness.id}`, {
        name:        form.name.trim(),
        website_url: form.website_url.trim() || null,
        country:     form.country,
        timezone:    form.timezone,
        logo_url:      form.logo_url.trim()      || null,
        contact_email: form.contact_email.trim() || null,
        contact_phone: form.contact_phone.trim() || null,
        address:       form.address.trim()       || null,
        ...(slug ? { slug } : {}),
        notification_prefs: notifs,
      })
      await refresh()
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!activeBusiness) return null

  return (
    <AppLayout title="Paramètres">
      <div className="max-w-2xl space-y-6">

        {/* Informations générales */}
        <Section
          title="Informations de l'entreprise"
          description="Ces informations sont utilisées dans vos communications et rapports."
        >
          <form onSubmit={handleSave} className="space-y-4">
            <Input
              label="Nom de l'entreprise"
              value={form.name}
              onChange={set('name')}
              placeholder="Ex : Atlas Immobilier"
              required
            />
            <Input
              label="Site web"
              type="url"
              value={form.website_url}
              onChange={set('website_url')}
              placeholder="https://www.monsite.com"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select label="Pays" value={form.country} onChange={set('country')}>
                {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
              </Select>
              <Select label="Fuseau horaire" value={form.timezone} onChange={set('timezone')}>
                {TIMEZONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
            </div>

            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Input
                  label="Logo (URL)"
                  type="url"
                  value={form.logo_url}
                  onChange={set('logo_url')}
                  placeholder="https://www.monsite.com/logo.png"
                />
              </div>
              {form.logo_url.trim() && (
                <img
                  src={form.logo_url.trim()}
                  alt="Logo"
                  className="w-10 h-10 rounded-lg object-contain border border-border bg-white shrink-0"
                  onError={e => { e.currentTarget.style.display = 'none' }}
                />
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Email de contact"
                type="email"
                value={form.contact_email}
                onChange={set('contact_email')}
                placeholder="contact@monsite.com"
              />
              <Input
                label="Téléphone"
                type="tel"
                value={form.contact_phone}
                onChange={set('contact_phone')}
                placeholder="01 23 45 67 89"
              />
            </div>
            <Input
              label="Adresse"
              value={form.address}
              onChange={set('address')}
              placeholder="12 rue de la République, 75001 Paris"
            />

            <div>
              <Input
                label="Slug public"
                value={form.slug}
                onChange={set('slug')}
                placeholder="mon-entreprise"
              />
              <p className={`text-xs mt-1 ${form.slug.trim() && !SLUG_RE.test(form.slug.trim()) ? 'text-danger' : 'text-text-tertiary'}`}>
                {form.slug.trim() && !SLUG_RE.test(form.slug.trim())
                  ? 'Format invalide : minuscules, chiffres et tirets uniquement.'
                  : 'Identifiant public de votre entreprise (kebab-case, unique).'}
              </p>
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <div className="flex items-center gap-3 pt-1">
              <Button type="submit" disabled={loading}>
                {loading ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
              {success && (
                <span className="flex items-center gap-1.5 text-sm text-success">
                  <Check size={15} /> Modifications enregistrées
                </span>
              )}
            </div>
          </form>
        </Section>

        {/* Préférences de notifications */}
        <Section
          title="Notifications"
          description="Choisissez les emails que vous souhaitez recevoir."
        >
          <div className="divide-y divide-border">
            {NOTIF_OPTIONS.map(opt => (
              <Toggle
                key={opt.key}
                label={opt.label}
                description={opt.description}
                checked={!!notifs[opt.key]}
                onChange={val => handleNotifChange(opt.key, val)}
              />
            ))}
          </div>
          {notifError && <p className="text-sm text-danger mt-2">{notifError}</p>}
        </Section>

        {/* Gestion de l'équipe */}
        <TeamSection Section={Section} businessId={activeBusiness.id} />

        {/* Localisations & fiches Google (gérées ailleurs) */}
        <Section
          title="Localisations & fiches Google"
          description="Les fiches Google sont désormais associées à chaque localisation."
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-accent-light rounded-lg flex items-center justify-center">
                <MapPin size={17} className="text-accent" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {locations.length} localisation{locations.length > 1 ? 's' : ''}
                </p>
                <p className="text-xs text-text-secondary">Gérez vos établissements et leurs fiches Google.</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/locations')}
              className="flex items-center gap-1 text-xs font-medium text-accent hover:text-violet-700 transition-colors"
            >
              Gérer <ChevronRight size={13} />
            </button>
          </div>
        </Section>

        {/* Connexion Google Business Profile */}
        <Section
          title="Google Business Profile"
          description="Connectez votre compte Google pour synchroniser vos avis GMB."
        >
          {googleNotif && (
            <div className={`flex items-start gap-2 text-sm mb-4 p-3 rounded-lg ${
              googleNotif.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-danger border border-red-200'
            }`}>
              {googleNotif.type === 'error' && <AlertCircle size={15} className="mt-0.5 shrink-0" />}
              {googleNotif.type === 'success' && <Check size={15} className="mt-0.5 shrink-0" />}
              {googleNotif.message}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                googleStatus?.connected ? 'bg-green-50' : 'bg-surface'
              }`}>
                {googleStatus?.connected
                  ? <Link2 size={17} className="text-green-600" />
                  : <Link2Off size={17} className="text-text-secondary" />
                }
              </div>
              <div>
                {googleStatus?.connected ? (
                  <>
                    <p className="text-sm font-medium text-text-primary">Connecté</p>
                    <p className="text-xs text-text-secondary">{googleStatus.email}</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-text-primary">Non connecté</p>
                    <p className="text-xs text-text-secondary">Autorisez l'accès à vos fiches Google.</p>
                  </>
                )}
              </div>
            </div>

            {googleStatus?.connected ? (
              <Button
                variant="secondary"
                disabled={googleLoading}
                onClick={handleGoogleDisconnect}
              >
                Déconnecter
              </Button>
            ) : (
              <Button
                disabled={googleLoading}
                onClick={handleGoogleConnect}
              >
                {googleLoading ? 'Redirection…' : 'Connecter Business Profile'}
              </Button>
            )}
          </div>
        </Section>

      </div>
    </AppLayout>
  )
}
