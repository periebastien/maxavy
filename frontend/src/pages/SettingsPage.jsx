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

  const [form, setForm]       = useState({ name: '', website_url: '', country: 'FR', timezone: 'Europe/Paris' })
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
    })
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

  function set(field) {
    return e => { setSuccess(false); setForm(f => ({ ...f, [field]: e.target.value })) }
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Le nom est requis'); return }
    setLoading(true); setError(''); setSuccess(false)
    try {
      await api.patch(`/api/v1/businesses/${activeBusiness.id}`, {
        name:        form.name.trim(),
        website_url: form.website_url.trim() || null,
        country:     form.country,
        timezone:    form.timezone,
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
            <div className="grid grid-cols-2 gap-4">
              <Select label="Pays" value={form.country} onChange={set('country')}>
                {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
              </Select>
              <Select label="Fuseau horaire" value={form.timezone} onChange={set('timezone')}>
                {TIMEZONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
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
