import { useState, useEffect, useCallback } from 'react'
import { Star, RefreshCw, MessageSquare, ChevronLeft, ChevronRight } from 'lucide-react'
import AppLayout from '../components/layout/AppLayout'
import Badge from '../components/common/Badge'
import Select from '../components/common/Select'
import Button from '../components/common/Button'
import EntityAvatar from '../components/common/EntityAvatar'
import { useBusiness } from '../contexts/BusinessContext'
import { useLocations } from '../contexts/LocationContext'
import api from '../lib/api'

function StarRating({ value }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={13}
          className={i <= value ? 'fill-amber-400 text-amber-400' : 'text-gray-200 fill-gray-200'}
        />
      ))}
    </div>
  )
}

function ReviewCard({ review }) {
  return (
    <div className="bg-white rounded-xl border border-border p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <EntityAvatar name={review.author_name} src={review.author_image_url} size={36} shape="circle" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary">{review.author_name || 'Anonyme'}</p>
            <p className="text-xs text-text-tertiary">
              {review.published_at
                ? new Date(review.published_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
                : '—'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {review.rating && <StarRating value={review.rating} />}
          {review.replied && (
            <Badge variant="accent">
              <MessageSquare size={10} className="mr-1" />
              Répondu
            </Badge>
          )}
        </div>
      </div>

      {review.text && (
        <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">{review.text}</p>
      )}

      {review.reply_text && (
        <div className="bg-bg-page border border-border rounded-lg px-3 py-2">
          <p className="text-xs font-medium text-text-secondary mb-1">Votre réponse</p>
          <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-line">{review.reply_text}</p>
        </div>
      )}
    </div>
  )
}

const STAR_OPTIONS = [
  { value: '', label: 'Toutes les notes' },
  { value: '5', label: '5 étoiles' },
  { value: '4', label: '4 étoiles' },
  { value: '3', label: '3 étoiles' },
  { value: '2', label: '2 étoiles' },
  { value: '1', label: '1 étoile' },
]

const LIMIT = 20

export default function ReviewsPage() {
  const { activeBusiness } = useBusiness()
  const { activeLocation } = useLocations() || {}
  const locId = activeLocation?.id

  const [reviews, setReviews]       = useState([])
  const [total, setTotal]           = useState(0)
  const [page, setPage]             = useState(1)
  const [starFilter, setStarFilter] = useState('')
  const [isLoading, setIsLoading]   = useState(true)
  const [isSyncing, setIsSyncing]   = useState(false)
  const [error, setError]           = useState(null)
  const [success, setSuccess]       = useState(null)
  const [syncStatus, setSyncStatus] = useState(null)

  const load = useCallback(async () => {
    if (!activeBusiness || !locId) {
      setReviews([])
      setTotal(0)
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ page, limit: LIMIT, location_id: locId })
      const data = await api.get(`/api/v1/reviews?business_id=${activeBusiness.id}&${qs}`)
      let rows = data.reviews
      if (starFilter) rows = rows.filter(r => r.rating === parseInt(starFilter))
      setReviews(rows)
      setTotal(data.total)
    } catch (err) {
      setError(err.message || 'Erreur de chargement')
    } finally {
      setIsLoading(false)
    }
  }, [activeBusiness, locId, page, starFilter])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [locId, starFilter])

  useEffect(() => {
    if (!activeBusiness) { setSyncStatus(null); return }
    api.get(`/api/v1/reviews/sync/status?business_id=${activeBusiness.id}`)
      .then(setSyncStatus)
      .catch(() => {})
  }, [activeBusiness])

  async function handleSync() {
    if (!activeBusiness) return
    setIsSyncing(true)
    setError(null)
    setSuccess(null)
    try {
      await api.post(`/api/v1/reviews/sync?business_id=${activeBusiness.id}`)
      // Tâches DataForSEO asynchrones : on poll l'état (jusqu'à ~90 s) puis on recharge.
      const deadline = Date.now() + 90000
      let lastStatus = null
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 3000))
        const s = await api.get(`/api/v1/reviews/sync/status?business_id=${activeBusiness.id}`)
        lastStatus = s
        if (!s.running) break
      }
      if (lastStatus) setSyncStatus(lastStatus)
      if (lastStatus?.last_job?.status === 'done' && lastStatus.last_job.reviews_upserted > 0) {
        setSuccess(`${lastStatus.last_job.reviews_upserted} avis importés`)
      }
      await load()
    } catch (err) {
      setError(err.message || 'Erreur de synchronisation')
    } finally {
      setIsSyncing(false)
    }
  }

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <AppLayout>
      <div className="p-6 space-y-5 max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-text-primary">Avis Google</h1>
            <p className="text-sm text-text-tertiary mt-0.5">{total} avis synchronisés</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSync}
            disabled={isSyncing}
            icon={<RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />}
          >
            {isSyncing ? 'Synchronisation…' : 'Synchroniser'}
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="w-full sm:w-44">
            <Select
              value={starFilter}
              onChange={e => setStarFilter(e.target.value)}
              options={STAR_OPTIONS}
            />
          </div>
        </div>

        {error && (
          <div className="text-sm text-danger bg-red-50 border border-red-100 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {success && (
          <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-3">
            {success}
          </div>
        )}

        {!error && syncStatus?.running && (
          <div className="flex items-center gap-2 text-sm text-accent bg-accent/5 border border-accent/20 rounded-lg px-4 py-3">
            <div className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin shrink-0" />
            Synchronisation des avis en cours…
          </div>
        )}

        {!syncStatus?.running && syncStatus?.last_job?.status === 'failed' && (
          <div className="text-sm text-danger bg-red-50 border border-red-100 rounded-lg px-4 py-3">
            La dernière synchronisation a échoué : {syncStatus.last_job.error_message || 'erreur inconnue'}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-16 text-text-tertiary">
            <Star size={32} className="mx-auto mb-3 text-gray-200 fill-gray-200" />
            {syncStatus?.running ? (
              <>
                <p className="text-sm font-medium text-text-secondary">Synchronisation des avis en cours…</p>
                <p className="text-xs mt-1">Cela peut prendre jusqu'à une minute.</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-text-secondary">Aucun avis</p>
                <p className="text-xs mt-1">Synchronisez pour récupérer vos avis Google Business Profile.</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map(r => <ReviewCard key={r.id} review={r} />)}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-text-tertiary">Page {page} sur {totalPages}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-border text-text-secondary hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-border text-text-secondary hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
