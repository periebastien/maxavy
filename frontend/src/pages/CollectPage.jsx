import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Star, MapPin, Loader2, CheckCircle2, ExternalLink, ArrowLeft } from 'lucide-react'
import api from '../lib/api'
import { googleReviewUrl } from '../lib/googleReview'
import { faviconUrl } from '../lib/favicon'
import EntityAvatar from '../components/common/EntityAvatar'

const DEFAULT_ACCENT = '#7C5CFC'

/* Lecture défensive de feedback_page_config (rempli par la session 14 « Réglages »).
   Clés en snake_case ; valeurs par défaut tant que l'admin n'a rien configuré. */
function readConfig(cfg = {}, business, location) {
  const branding = cfg.branding || {}
  const rating   = cfg.rating   || {}
  return {
    mode:        cfg.mode || 'smart',
    accent:      branding.primary_color || DEFAULT_ACCENT,
    logoUrl:     branding.logo_url || faviconUrl(location?.website_url || business?.website_url, 128),
    threshold:   typeof rating.threshold === 'number' ? rating.threshold : 4,
    title:       rating.welcome_text || `Comment s'est passée votre expérience ?`,
    subtitle:    rating.subtitle || 'Votre avis nous aide à progresser.',
    thanksHigh:  rating.thanks_high || 'Merci beaucoup ! 🎉',
    thanksLow:   rating.thanks_low  || 'Merci pour votre retour.',
  }
}

function Stars({ value, onPick, accent }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex items-center justify-center gap-2" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map(n => {
        const active = (hover || value) >= n
        return (
          <button
            key={n}
            type="button"
            aria-label={`${n} étoile${n > 1 ? 's' : ''}`}
            onMouseEnter={() => setHover(n)}
            onClick={() => onPick(n)}
            className="p-1 transition-transform hover:scale-110 focus:outline-none"
          >
            <Star
              size={44}
              strokeWidth={1.5}
              className="transition-colors"
              style={{
                fill:   active ? '#F5B100' : 'transparent',
                color:  active ? '#F5B100' : '#D4D4DB',
              }}
            />
          </button>
        )
      })}
    </div>
  )
}

export default function CollectPage() {
  const { businessSlug, locationSlug } = useParams()

  const [data, setData]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [rating, setRating]     = useState(0)
  const [step, setStep]         = useState('rate') // rate | positive | negative | done
  const [comment, setComment]   = useState('')
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true); setNotFound(false)
    api.get(`/api/v1/public/collect/${businessSlug}/${locationSlug}`)
      .then(d => { if (alive) setData(d) })
      .catch(() => { if (alive) setNotFound(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [businessSlug, locationSlug])

  // Mode direct : redirige immédiatement vers Google sans passer par les étoiles.
  useEffect(() => {
    if (!data) return
    const cfg = readConfig(data.business.feedback_page_config, data.business, data.location)
    if (cfg.mode !== 'direct') return
    const url = googleReviewUrl(data.location.google_place_id)
    if (url) window.location.replace(url)
  }, [data])

  function pickRating(n) {
    setRating(n)
    setError('')
    const threshold = data?.business?.feedback_page_config?.rating?.threshold ?? 4
    setStep(n >= threshold ? 'positive' : 'negative')
  }

  function resetRating() {
    setStep('rate'); setRating(0); setError('')
  }

  async function submitFeedback(e) {
    e.preventDefault()
    if (!comment.trim()) { setError('Merci de décrire votre expérience.'); return }
    setSubmitting(true); setError('')
    try {
      await api.post(`/api/v1/public/collect/${businessSlug}/${locationSlug}/feedback`, {
        rating, comment, author_name: name, author_email: email,
      })
      setStep('done')
    } catch (err) {
      setError(err.message || 'Une erreur est survenue.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-page">
        <Loader2 className="animate-spin text-accent" size={28} />
      </div>
    )
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-page px-4">
        <div className="text-center">
          <MapPin size={32} className="text-text-tertiary mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-text-primary">Page introuvable</h1>
          <p className="text-sm text-text-secondary mt-1">Ce lien de collecte d'avis n'existe pas ou n'est plus actif.</p>
        </div>
      </div>
    )
  }

  const { business, location } = data
  const cfg = readConfig(business.feedback_page_config, business, location)
  const reviewUrl = googleReviewUrl(location.google_place_id)

  return (
    <div className="min-h-screen bg-bg-page flex flex-col items-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-md">

        {/* En-tête : logo + identité */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <EntityAvatar name={business.name} src={cfg.logoUrl} size={64} shape="rounded" />
          </div>
          <h1 className="text-lg font-bold text-text-primary">{business.name}</h1>
          <p className="text-sm text-text-tertiary flex items-center justify-center gap-1 mt-0.5">
            <MapPin size={13} /> {location.name}
          </p>
        </div>

        <div className="bg-white border border-border rounded-2xl shadow-sm p-6 sm:p-8">

          {/* ── Étape 1 : notation ── */}
          {step === 'rate' && (
            <div className="text-center space-y-6">
              <div>
                <h2 className="text-base font-semibold text-text-primary">{cfg.title}</h2>
                <p className="text-sm text-text-secondary mt-1">{cfg.subtitle}</p>
              </div>
              <Stars value={rating} onPick={pickRating} accent={cfg.accent} />
              <p className="text-xs text-text-tertiary">Touchez une étoile pour noter</p>
            </div>
          )}

          {/* ── Étape 2a : note ≥ 4 → redirection Google ── */}
          {step === 'positive' && (
            <div className="text-center space-y-5">
              <CheckCircle2 size={44} className="mx-auto" style={{ color: cfg.accent }} />
              <div>
                <h2 className="text-base font-semibold text-text-primary">{cfg.thanksHigh}</h2>
                <p className="text-sm text-text-secondary mt-1.5">
                  Partagez votre expérience sur Google, ça nous aiderait énormément.
                </p>
              </div>
              <a
                href={reviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 text-white text-sm font-medium py-3 rounded-xl transition-opacity hover:opacity-90"
                style={{ backgroundColor: cfg.accent }}
              >
                Laisser un avis sur Google <ExternalLink size={15} />
              </a>
              <button onClick={resetRating} className="text-xs text-text-tertiary hover:text-text-secondary inline-flex items-center gap-1">
                <ArrowLeft size={12} /> Modifier ma note
              </button>
            </div>
          )}

          {/* ── Étape 2b : note ≤ 3 → feedback privé ── */}
          {step === 'negative' && (
            <form onSubmit={submitFeedback} className="space-y-4">
              <div className="text-center">
                <h2 className="text-base font-semibold text-text-primary">Que pouvons-nous améliorer ?</h2>
                <p className="text-sm text-text-secondary mt-1">
                  Votre retour reste privé et nous est transmis directement.
                </p>
              </div>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={4}
                autoFocus
                placeholder="Décrivez votre expérience…"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors resize-none"
              />
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Votre nom (facultatif)"
                className="w-full h-10 px-3.5 rounded-xl border border-border text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
              />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Votre email (facultatif)"
                className="w-full h-10 px-3.5 rounded-xl border border-border text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
              />
              {error && <p className="text-sm text-danger">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 text-white text-sm font-medium py-3 rounded-xl transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: cfg.accent }}
              >
                {submitting ? 'Envoi…' : 'Envoyer mon retour'}
              </button>
              <button type="button" onClick={resetRating} className="w-full text-xs text-text-tertiary hover:text-text-secondary inline-flex items-center justify-center gap-1">
                <ArrowLeft size={12} /> Modifier ma note
              </button>
            </form>
          )}

          {/* ── Étape 3 : confirmation feedback privé ── */}
          {step === 'done' && (
            <div className="text-center space-y-4 py-2">
              <CheckCircle2 size={44} className="mx-auto" style={{ color: cfg.accent }} />
              <div>
                <h2 className="text-base font-semibold text-text-primary">{cfg.thanksLow}</h2>
                <p className="text-sm text-text-secondary mt-1.5">
                  Nous avons bien reçu votre message et reviendrons vers vous si nécessaire.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Powered by — masquable plus tard (plans payants, cf. cahier branding) */}
        <p className="text-center text-xs text-text-tertiary mt-6">
          Propulsé par <span className="font-medium text-text-secondary">Locagain</span>
        </p>
      </div>
    </div>
  )
}
