import { useState, useEffect } from 'react'
import { Check, ExternalLink, Eye } from 'lucide-react'
import AppLayout from '../components/layout/AppLayout'
import Input from '../components/common/Input'
import Button from '../components/common/Button'
import { useBusiness } from '../contexts/BusinessContext'
import { useLocations } from '../contexts/LocationContext'
import api from '../lib/api'

const DEFAULTS = {
  mode: 'smart',
  branding: {
    logo_url: '',
    primary_color: '#7C5CFC',
    show_powered_by: true,
  },
  rating: {
    welcome_text: "Comment s'est passée votre expérience ?",
    subtitle: 'Votre avis nous aide à progresser.',
    threshold: 4,
    thanks_high: 'Merci beaucoup ! 🎉',
    thanks_low: 'Merci pour votre retour.',
  },
  seo: {
    title: '',
    description: '',
  },
}

function merge(saved) {
  const s = saved || {}
  return {
    mode:     s.mode || DEFAULTS.mode,
    branding: { ...DEFAULTS.branding, ...(s.branding || {}) },
    rating:   { ...DEFAULTS.rating,   ...(s.rating   || {}) },
    seo:      { ...DEFAULTS.seo,       ...(s.seo      || {}) },
  }
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

function Toggle({ label, description, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-4 cursor-pointer">
      <div>
        <p className="text-sm font-medium text-text-primary">{label}</p>
        {description && <p className="text-xs text-text-secondary mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${checked ? 'bg-accent' : 'bg-gray-200'}`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`}
        />
      </button>
    </label>
  )
}

export default function CollectSettingsPage() {
  const { activeBusiness, refresh } = useBusiness()
  const { activeLocation } = useLocations() || {}

  const [cfg, setCfg]         = useState(() => merge(null))
  const [saving, setSaving]   = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    if (activeBusiness) setCfg(merge(activeBusiness.feedback_page_config))
  }, [activeBusiness?.id])

  function setMode(mode) {
    setCfg(c => ({ ...c, mode }))
    setSuccess(false)
  }

  function setBranding(key, value) {
    setCfg(c => ({ ...c, branding: { ...c.branding, [key]: value } }))
    setSuccess(false)
  }

  function setRating(key, value) {
    setCfg(c => ({ ...c, rating: { ...c.rating, [key]: value } }))
    setSuccess(false)
  }

  function setSeo(key, value) {
    setCfg(c => ({ ...c, seo: { ...c.seo, [key]: value } }))
    setSuccess(false)
  }

  const baseUrl    = import.meta.env.VITE_APP_URL || window.location.origin
  const previewUrl = activeBusiness?.slug && activeLocation?.slug
    ? `${baseUrl}/avis/${activeBusiness.slug}/${activeLocation.slug}`
    : null

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true); setError(''); setSuccess(false)
    try {
      await api.patch(`/api/v1/businesses/${activeBusiness.id}`, { feedback_page_config: cfg })
      await refresh()
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!activeBusiness) return null

  return (
    <AppLayout title="Page de collecte">
      <form onSubmit={handleSave} className="max-w-2xl space-y-6">

        <div className="flex items-center justify-between">
          <p className="text-sm text-text-secondary">
            Personnalisez l'apparence et le comportement de votre page de collecte d'avis.
          </p>
          {previewUrl && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-violet-700 transition-colors shrink-0 ml-4"
            >
              <Eye size={15} /> Aperçu
            </a>
          )}
        </div>

        {/* ── Mode ── */}
        <Section
          title="Mode de la page"
          description="Choisissez comment les visiteurs arrivent sur votre page de collecte."
        >
          <div className="space-y-3">
            <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${cfg.mode === 'smart' ? 'border-accent bg-accent-light' : 'border-border hover:border-gray-300'}`}>
              <input
                type="radio"
                name="mode"
                value="smart"
                checked={cfg.mode === 'smart'}
                onChange={() => setMode('smart')}
                className="mt-0.5 accent-accent shrink-0"
              />
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  Page intelligente{' '}
                  <span className="ml-1 text-xs font-normal bg-accent text-white px-1.5 py-0.5 rounded">Recommandé</span>
                </p>
                <p className="text-xs text-text-secondary mt-1">
                  Le visiteur note de 1 à 5 étoiles. Une note haute (≥ seuil) l'oriente vers Google ;
                  une note basse le dirige vers un formulaire privé.{' '}
                  <strong>Filtre les avis négatifs avant publication.</strong>
                </p>
              </div>
            </label>
            <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${cfg.mode === 'direct' ? 'border-accent bg-accent-light' : 'border-border hover:border-gray-300'}`}>
              <input
                type="radio"
                name="mode"
                value="direct"
                checked={cfg.mode === 'direct'}
                onChange={() => setMode('direct')}
                className="mt-0.5 accent-accent shrink-0"
              />
              <div>
                <p className="text-sm font-semibold text-text-primary">Redirection directe Google</p>
                <p className="text-xs text-text-secondary mt-1">
                  Le visiteur est renvoyé immédiatement sur la page d'écriture d'avis Google.{' '}
                  Aucun filtre — les avis négatifs peuvent être publiés directement.
                </p>
              </div>
            </label>
            <div className="flex items-start gap-3 p-4 rounded-xl border-2 border-border opacity-50 cursor-not-allowed select-none">
              <input type="radio" disabled className="mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  Page intelligente + avis vocal{' '}
                  <span className="ml-1 text-xs font-normal bg-gray-100 text-text-tertiary px-1.5 py-0.5 rounded">bientôt</span>
                </p>
                <p className="text-xs text-text-secondary mt-1">
                  Comme la page intelligente, avec en plus la possibilité de laisser un avis vocal (enregistrement audio + transcription IA). Filtre identique sur la note.
                </p>
              </div>
            </div>
          </div>
        </Section>

        {/* ── Branding ── */}
        <Section title="Apparence" description="Logo et couleur principale de votre page.">
          <div className="space-y-5">
            <Input
              label="URL du logo"
              type="url"
              value={cfg.branding.logo_url}
              onChange={e => setBranding('logo_url', e.target.value)}
              placeholder="https://www.monsite.com/logo.png"
            />
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Couleur principale</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={cfg.branding.primary_color}
                  onChange={e => setBranding('primary_color', e.target.value)}
                  className="h-9 w-12 rounded border border-border cursor-pointer p-0.5"
                />
                <input
                  type="text"
                  value={cfg.branding.primary_color}
                  onChange={e => {
                    if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value))
                      setBranding('primary_color', e.target.value)
                  }}
                  className="w-28 h-9 px-3 rounded-lg border border-border text-sm font-mono text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                  maxLength={7}
                />
                <span className="text-xs text-text-tertiary">hex. Ex : #7C5CFC</span>
              </div>
            </div>
            <Toggle
              label='Afficher "Propulsé par Locagain"'
              description="Réservé aux plans payants — la désactivation sera grisée sur le plan gratuit."
              checked={cfg.branding.show_powered_by}
              onChange={v => setBranding('show_powered_by', v)}
            />
          </div>
        </Section>

        {/* ── Textes — mode smart uniquement ── */}
        {cfg.mode === 'smart' && (
          <Section title="Textes de la page" description="Personnalisez les messages affichés sur votre page de collecte.">
            <div className="space-y-4">
              <Input
                label="Titre d'accueil"
                value={cfg.rating.welcome_text}
                onChange={e => setRating('welcome_text', e.target.value)}
                placeholder="Comment s'est passée votre expérience ?"
              />
              <Input
                label="Sous-titre"
                value={cfg.rating.subtitle}
                onChange={e => setRating('subtitle', e.target.value)}
                placeholder="Votre avis nous aide à progresser."
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Message avis positif"
                  value={cfg.rating.thanks_high}
                  onChange={e => setRating('thanks_high', e.target.value)}
                  placeholder="Merci beaucoup ! 🎉"
                />
                <Input
                  label="Message avis négatif"
                  value={cfg.rating.thanks_low}
                  onChange={e => setRating('thanks_low', e.target.value)}
                  placeholder="Merci pour votre retour."
                />
              </div>
            </div>
          </Section>
        )}

        {/* ── Seuil Google — mode smart uniquement ── */}
        {cfg.mode === 'smart' && (
          <Section
            title="Redirection Google"
            description="À partir de combien d'étoiles le visiteur est renvoyé vers Google pour laisser un avis public ?"
          >
            <div className="flex items-center gap-3">
              {[3, 4, 5].map(n => (
                <label
                  key={n}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 cursor-pointer transition-colors text-sm ${
                    cfg.rating.threshold === n
                      ? 'border-accent bg-accent-light text-accent font-semibold'
                      : 'border-border text-text-secondary hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="threshold"
                    value={n}
                    checked={cfg.rating.threshold === n}
                    onChange={() => setRating('threshold', n)}
                    className="hidden"
                  />
                  ≥ {n} ★
                </label>
              ))}
            </div>
            <p className="text-xs text-text-secondary mt-3">
              En dessous du seuil, le retour reste privé et est visible uniquement par vous dans le tableau de bord.
            </p>
          </Section>
        )}

        {/* ── SEO ── */}
        <Section title="SEO" description="Métadonnées de votre page publique pour les moteurs de recherche.">
          <div className="space-y-4">
            <Input
              label="Titre SEO"
              value={cfg.seo.title}
              onChange={e => setSeo('title', e.target.value)}
              placeholder={`Avis ${activeBusiness.name}`}
            />
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Description SEO</label>
              <textarea
                value={cfg.seo.description}
                onChange={e => setSeo('description', e.target.value)}
                rows={2}
                placeholder="Donnez votre avis sur notre établissement…"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors resize-none"
              />
            </div>
          </div>
        </Section>

        {/* ── Sauvegarde ── */}
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
          {previewUrl && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              <ExternalLink size={14} /> Voir la page en ligne
            </a>
          )}
          {success && (
            <span className="flex items-center gap-1.5 text-sm text-success">
              <Check size={15} /> Modifications enregistrées
            </span>
          )}
        </div>
      </form>
    </AppLayout>
  )
}
