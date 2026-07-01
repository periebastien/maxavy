import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Building2, MapPin } from 'lucide-react'
import { importLibrary } from '@googlemaps/js-api-loader'
import { useBusiness } from '../contexts/BusinessContext'
import { useAuth } from '../contexts/AuthContext'
import Button from '../components/common/Button'
import Input from '../components/common/Input'
import Select from '../components/common/Select'
import PlaceSearch from '../components/common/PlaceSearch'
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

const COUNTRY_TIMEZONE = {
  FR: 'Europe/Paris', BE: 'Europe/Brussels', CH: 'Europe/Zurich',
  LU: 'Europe/Luxembourg', CA: 'America/Montreal',
  MA: 'Africa/Casablanca', TN: 'Africa/Tunis', SN: 'Africa/Dakar',
}

const STEPS = [
  { id: 1, label: 'Entreprise',    icon: Building2 },
  { id: 2, label: 'Localisation',  icon: MapPin },
  { id: 3, label: 'Confirmation',  icon: Check },
]

function StepIndicator({ steps, current }) {
  return (
    <div className="flex items-center justify-center mb-10">
      {steps.map((step, i) => {
        const done   = step.id < current
        const active = step.id === current
        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300
                ${done ? 'bg-accent text-white' : active ? 'bg-accent text-white ring-4 ring-accent/20' : 'bg-gray-100 text-text-tertiary'}`}>
                {done ? <Check size={16} strokeWidth={2.5} /> : step.id}
              </div>
              <span className={`text-xs font-medium whitespace-nowrap ${active ? 'text-accent' : done ? 'text-text-secondary' : 'text-text-tertiary'}`}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-16 h-0.5 mx-1 mb-5 ${step.id < current ? 'bg-accent' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

const emptyBiz = { name: '', website_url: '', country: 'FR', timezone: 'Europe/Paris' }
const emptyLoc = { name: '', address: '', lat: null, lng: null, google_place_id: null, google_place_name: null, website_url: null }

export default function OnboardingPage() {
  const [step, setStep]               = useState(1)
  const [biz, setBiz]                 = useState(emptyBiz)
  const [loc, setLoc]                 = useState(emptyLoc)
  const [createdBusinessId, setCreatedBusinessId] = useState(null) // robustesse : entreprise déjà créée si l'étape localisation a échoué
  const [fetchingPlace, setFetching]  = useState(false)
  const [error, setError]             = useState('')
  const [submitting, setSubmitting]   = useState(false)
  const { refresh, setActiveBusiness, hasBusinesses } = useBusiness()
  const { user }                      = useAuth()
  const navigate                      = useNavigate()
  const isAdding                      = hasBusinesses // ajout d'un établissement supplémentaire

  function bizField(key) {
    return e => setBiz(b => ({ ...b, [key]: e.target.value }))
  }
  function setCountry(e) {
    const code = e.target.value
    setBiz(b => ({ ...b, country: code, timezone: COUNTRY_TIMEZONE[code] || b.timezone }))
  }

  /* ── Sélection de la fiche Google pour la localisation ── */
  async function handleLocSelect(place) {
    setError('')
    setFetching(true)
    const base = { google_place_id: place.place_id, google_place_name: place.name, name: place.name, address: place.address || '' }
    try {
      const { Place } = await importLibrary('places')
      const p = new Place({ id: place.place_id })
      await p.fetchFields({ fields: ['displayName', 'formattedAddress', 'location', 'websiteURI'] })
      setLoc(l => ({
        ...l,
        ...base,
        name:        p.displayName || place.name,
        address:     p.formattedAddress || place.address || '',
        lat:         p.location ? p.location.lat() : null,
        lng:         p.location ? p.location.lng() : null,
        website_url: p.websiteURI || null,
      }))
    } catch {
      setLoc(l => ({ ...l, ...base }))
    } finally {
      setFetching(false)
    }
  }

  function next() {
    setError('')
    if (step === 1 && !biz.name.trim()) {
      setError("Le nom de l'entreprise est requis")
      return
    }
    if (step === 2) {
      if (!loc.google_place_id) { setError('Sélectionnez votre établissement sur Google pour continuer'); return }
      if (!loc.name.trim())     { setError('Le nom de la localisation est requis'); return }
    }
    setStep(s => s + 1)
  }

  function back() { setError(''); setStep(s => s - 1) }

  async function handleCreate() {
    setSubmitting(true); setError('')
    try {
      let businessId = createdBusinessId
      if (!businessId) {
        const created = await api.post('/api/v1/businesses', {
          name:        biz.name.trim(),
          website_url: biz.website_url.trim() || undefined,
          country:     biz.country,
          timezone:    biz.timezone,
        })
        businessId = created.id
        setCreatedBusinessId(businessId)
      }
      await api.post('/api/v1/locations', {
        business_id:       businessId,
        name:              loc.name.trim(),
        address:           loc.address || undefined,
        lat:               loc.lat ?? undefined,
        lng:               loc.lng ?? undefined,
        google_place_id:   loc.google_place_id,
        google_place_name: loc.google_place_name || undefined,
        website_url:       loc.website_url || undefined,
      })
      const list   = await refresh()
      const active = list.find(b => b.id === businessId)
      if (active) setActiveBusiness(active)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const title =
    step === 1 ? (isAdding ? 'Ajouter un établissement' : `Bienvenue${user?.firstname ? `, ${user.firstname}` : ''} !`)
    : step === 2 ? 'Ajoutez votre première localisation'
    : 'Vérifiez et confirmez'

  const subtitle =
    step === 1 ? "Renseignez les informations de votre entreprise."
    : step === 2 ? 'Recherchez votre établissement tel qu\'il apparaît sur Google Maps — c\'est lui qui portera vos avis.'
    : 'Un dernier coup d\'œil avant de créer votre espace.'

  return (
    <div className="min-h-screen bg-bg-page flex items-center justify-center p-4">
      <div className="w-full max-w-lg">

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-accent rounded-xl mb-3">
            <span className="text-white font-bold text-lg">L</span>
          </div>
          <h1 className="text-xl font-bold text-text-primary">{title}</h1>
          <p className="text-text-secondary text-sm mt-1">{subtitle}</p>
          {isAdding && (
            <button
              onClick={() => navigate('/dashboard')}
              className="text-xs text-text-tertiary hover:text-text-secondary transition-colors mt-3"
            >
              ← Annuler et revenir au tableau de bord
            </button>
          )}
        </div>

        <StepIndicator steps={STEPS} current={step} />

        <div className="bg-white border border-border rounded-xl shadow-sm">

          {/* ── Étape 1 : entreprise (manuel) ── */}
          {step === 1 && (
            <div className="p-8 space-y-4">
              <Input
                label="Nom de l'entreprise"
                value={biz.name}
                onChange={bizField('name')}
                placeholder="Ex : Atlas Immobilier"
                autoFocus
                required
              />
              <Input
                label="Site web (optionnel)"
                type="url"
                value={biz.website_url}
                onChange={bizField('website_url')}
                placeholder="https://www.monsite.com"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select label="Pays" value={biz.country} onChange={setCountry}>
                  {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                </Select>
                <Select label="Fuseau horaire" value={biz.timezone} onChange={bizField('timezone')}>
                  {TIMEZONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </Select>
              </div>
            </div>
          )}

          {/* ── Étape 2 : première localisation (Google obligatoire) ── */}
          {step === 2 && (
            <div className="p-8 space-y-4">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-text-primary">Fiche Google de l'établissement</label>
                <PlaceSearch
                  onSelect={handleLocSelect}
                  country={biz.country}
                  autoFocus
                  placeholder="Ex : Atlas Immobilier Casablanca"
                />
                <p className="text-xs text-text-tertiary">Minimum 3 caractères · Résultats Google Maps</p>
              </div>

              {fetchingPlace && (
                <div className="flex items-center gap-3 py-2">
                  <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin shrink-0" />
                  <span className="text-sm text-text-secondary">Récupération des informations de la fiche…</span>
                </div>
              )}

              {loc.google_place_id && !fetchingPlace && (
                <>
                  <div className="flex items-center gap-2.5 p-3 bg-success/5 border border-success/20 rounded-lg">
                    <Check size={15} className="text-success shrink-0" />
                    <span className="text-xs text-success font-medium">Fiche Google sélectionnée</span>
                  </div>
                  <Input
                    label="Nom de la localisation"
                    value={loc.name}
                    onChange={e => setLoc(l => ({ ...l, name: e.target.value }))}
                    placeholder="Ex : Agence Casablanca Centre"
                    required
                  />
                  {loc.address && (
                    <div className="flex items-start gap-2 text-xs text-text-secondary">
                      <MapPin size={14} className="text-text-tertiary shrink-0 mt-0.5" />
                      <span>{loc.address}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Étape 3 : confirmation ── */}
          {step === 3 && (
            <div className="p-8 space-y-5">
              <div>
                <p className="text-xs font-medium text-text-tertiary mb-2 uppercase tracking-wide">Entreprise</p>
                <div className="bg-bg-page border border-border rounded-lg divide-y divide-border">
                  <Recap label="Nom" value={biz.name} />
                  <Recap label="Site web" value={biz.website_url || '—'} />
                  <Recap label="Pays" value={COUNTRIES.find(c => c.code === biz.country)?.label || biz.country} />
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-text-tertiary mb-2 uppercase tracking-wide">Première localisation</p>
                <div className="bg-bg-page border border-border rounded-lg divide-y divide-border">
                  <Recap label="Nom" value={loc.name} />
                  <Recap label="Adresse" value={loc.address || '—'} />
                  <Recap label="Fiche Google" value={loc.google_place_name || 'Connectée'} />
                </div>
              </div>
            </div>
          )}

          {error && <p className="px-8 text-sm text-danger -mt-2 pb-2">{error}</p>}

          {/* ── Footer ── */}
          <div className={`px-8 pb-8 pt-2 flex items-center gap-3 ${step > 1 ? 'justify-between' : 'justify-end'}`}>
            {step > 1 && (
              <Button variant="secondary" onClick={back} disabled={submitting}>← Précédent</Button>
            )}
            {step < 3 && (
              <Button onClick={next} disabled={fetchingPlace}>Suivant →</Button>
            )}
            {step === 3 && (
              <Button onClick={handleCreate} disabled={submitting} className="min-w-44 justify-center">
                {submitting ? 'Création…' : '🚀 Créer mon espace'}
              </Button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-text-tertiary mt-6">Étape {step} sur {STEPS.length}</p>
      </div>
    </div>
  )
}

function Recap({ label, value }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-xs text-text-tertiary">{label}</span>
      <span className="text-sm font-medium text-text-primary text-right max-w-[60%] truncate">{value}</span>
    </div>
  )
}
