import { MapPin, Star, Mail, Zap, AlertCircle, ChevronRight, Globe, Clock, CheckCircle2, Circle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '../components/layout/AppLayout'
import MetricCard from '../components/common/MetricCard'
import { useBusiness } from '../contexts/BusinessContext'
import { useLocations } from '../contexts/LocationContext'
import EntityAvatar from '../components/common/EntityAvatar'
import { faviconUrl } from '../lib/favicon'

function StepItem({ done, label, description, action, onAction }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <div className="shrink-0 mt-0.5">
        {done
          ? <CheckCircle2 size={18} className="text-success" />
          : <Circle size={18} className="text-gray-300" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${done ? 'text-text-secondary line-through' : 'text-text-primary'}`}>{label}</p>
        {!done && <p className="text-xs text-text-tertiary mt-0.5">{description}</p>}
      </div>
      {!done && action && (
        <button
          onClick={onAction}
          className="text-xs font-medium text-accent hover:text-violet-700 flex items-center gap-0.5 shrink-0"
        >
          {action} <ChevronRight size={12} />
        </button>
      )}
    </div>
  )
}

function InfoRow({ label, value }) {
  if (!value) return null
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-border last:border-0">
      <span className="text-xs text-text-tertiary">{label}</span>
      <span className="text-xs font-medium text-text-primary text-right max-w-[60%] truncate">{value}</span>
    </div>
  )
}

export default function DashboardPage() {
  const { activeBusiness } = useBusiness()
  const navigate = useNavigate()

  const { locations = [], hasLocations } = useLocations() || {}
  const hasWebsite = !!activeBusiness?.website_url
  const credits    = activeBusiness?.credit_balance ?? 0

  const COUNTRIES = { FR: 'France', BE: 'Belgique', CH: 'Suisse', LU: 'Luxembourg', CA: 'Canada', MA: 'Maroc', TN: 'Tunisie', SN: 'Sénégal' }
  const countryLabel = COUNTRIES[activeBusiness?.country] || activeBusiness?.country

  const timezoneLabel = activeBusiness?.timezone
    ? activeBusiness.timezone.split('/').pop().replace(/_/g, ' ')
    : null
  const websiteLabel = activeBusiness?.website_url
    ? activeBusiness.website_url.replace(/^https?:\/\//, '').replace(/\/$/, '')
    : null

  return (
    <AppLayout title="Vue d'ensemble">
      <div className="space-y-6">

        {/* Alerte localisation */}
        {!hasLocations && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertCircle size={18} className="text-amber-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">Aucune localisation</p>
                <p className="text-xs text-amber-600 mt-0.5">Ajoutez une localisation avec sa fiche Google pour collecter vos avis.</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/locations')}
              className="text-xs font-medium text-amber-700 hover:text-amber-900 flex items-center gap-1 shrink-0"
            >
              Ajouter <ChevronRight size={13} />
            </button>
          </div>
        )}

        {/* Métriques */}
        <div className="grid grid-cols-4 gap-4">
          <MetricCard
            label="Crédits restants"
            value={credits}
            icon={<Zap size={16} className="text-accent" />}
          />
          <MetricCard
            label="Avis collectés"
            value="0"
            sub="Bientôt disponible"
            icon={<Star size={16} className="text-yellow-400" />}
          />
          <MetricCard
            label="Note moyenne"
            value="—"
            sub="Bientôt disponible"
            icon={<Star size={16} className="text-yellow-400" />}
          />
          <MetricCard
            label="Invitations envoyées"
            value="0"
            sub="Bientôt disponible"
            icon={<Mail size={16} className="text-blue-400" />}
          />
        </div>

        {/* Grille basse */}
        <div className="grid grid-cols-3 gap-6">

          {/* Premiers pas — 2/3 */}
          <div className="col-span-2 bg-white border border-border rounded-xl p-5">
            <p className="text-sm font-semibold text-text-primary mb-1">Premiers pas</p>
            <p className="text-xs text-text-secondary mb-4">Complétez ces étapes pour tirer le meilleur de Locagain.</p>
            <div>
              <StepItem done label="Compte créé" />
              <StepItem done label="Premier établissement configuré" />
              <StepItem
                done={hasLocations}
                label="Première localisation ajoutée"
                description="Reliez votre fiche Google pour collecter vos avis."
                action="Ajouter"
                onAction={() => navigate('/locations')}
              />
              <StepItem
                done={false}
                label="Envoyer votre première invitation"
                description="Demandez un avis à un de vos clients."
                action="Inviter"
                onAction={() => navigate('/invitations')}
              />
              <StepItem
                done={false}
                label="Configurer votre QR code"
                description="Affichez-le en boutique pour collecter des avis."
                action="Configurer"
                onAction={() => navigate('/qrcode')}
              />
            </div>
          </div>

          {/* Fiche établissement — 1/3 */}
          <div className="bg-white border border-border rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <EntityAvatar name={activeBusiness?.name} src={faviconUrl(activeBusiness?.website_url)} size={40} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text-primary truncate">{activeBusiness?.name}</p>
                <p className="text-xs text-text-tertiary">{countryLabel}</p>
              </div>
            </div>
            <div>
              <InfoRow label="Site web" value={websiteLabel} />
              <InfoRow label="Fuseau horaire" value={timezoneLabel} />
              <InfoRow label="Localisations" value={locations.length || null} />
            </div>
            {!hasWebsite && !hasLocations && (
              <p className="text-xs text-text-tertiary mt-3">Complétez votre profil pour débloquer toutes les fonctionnalités.</p>
            )}
            <button
              onClick={() => navigate('/settings')}
              className="mt-4 w-full text-xs font-medium text-accent hover:text-violet-700 flex items-center justify-center gap-1 py-2 border border-accent/30 rounded-lg hover:bg-accent-light transition-colors"
            >
              Modifier l'établissement <ChevronRight size={12} />
            </button>
          </div>

        </div>
      </div>
    </AppLayout>
  )
}
