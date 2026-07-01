import { useState, useEffect, useCallback } from 'react'
import { Star, RefreshCw, MessageSquare, ChevronLeft, ChevronRight } from 'lucide-react'
import AppLayout from '../components/layout/AppLayout'
import Badge from '../components/common/Badge'
import Select from '../components/common/Select'
import Button from '../components/common/Button'
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
  const [expanded, setExpanded] = useState(false)
  const hasLongText = review.text && review.text.length > 200

  return (
    <div className="bg-white rounded-xl border border-border p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary">{review.author_name || 'Anonyme'}</p>
          <p className="text-xs text-text-tertiary">
            {review.published_at
              ? new Date(review.published_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
              : '—'}
          </p>
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
        <div>
          <p className="text-sm text-text-secondary leading-relaxed">
            {hasLongText && !expanded ? review.text.slice(0, 200) + '…' : review.text}
          </p>
          {hasLongText && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-xs text-accent mt-1 hover:underline"
            >
              {expanded ? 'Voir moins' : 'Voir plus'}
            </button>
          )}
        </div>
      )}

      {review.reply_text && (
        <div className="bg-bg-page border border-border rounded-lg px-3 py-2">
          <p className="text-xs font-medium text-text-secondary mb-1">Votre réponse</p>
          <p className="text-xs text-text-secondary leading-relaxed">{review.reply_text}</p>
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
  const { locations = [] } = useLocations() || {}

  const [reviews, setReviews]       = useState([])
  const [total, setTotal]           = useState(0)
  const [page, setPage]             = useState(1)
  const [locationId, setLocationId] = useState('')
  const [starFilter, setStarFilter] = useState('')
  const [isLoading, setIsLoading]   = useState(true)
  const [isSyncing, setIsSyncing]   = useState(false)
  const [error, setError]           = useState(null)

  const locationOptions = [
    { value: '', label: 'Toutes les localisations' },
    ...locations.map(l => ({ value: l.id, label: l.name })),
  ]

  const load = useCallback(async () => {
    if (!activeBusiness) return
    setIsLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ page, limit: LIMIT })
      if (locationId) qs.set('location_id', locationId)
      const data = await api.get(`/api/v1/reviews?business_id=${activeBusiness.id}&${qs}`)
      let rows = data.reviews
      if (starFilter) rows = rows.filter(r => r.rating === parseInt(starFilter))
      setReviews(rows)
      setTotal(data.total)
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur de chargement')
    } finally {
      setIsLoading(false)
    }
  }, [activeBusiness, page, locationId, starFilter])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [locationId, starFilter])

  async function handleSync() {
    setIsSyncing(true)
    setError(null)
    try {
      await api.post('/reviews/sync')
      await load()
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur de synchronisation')
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
          <div className="w-full sm:w-56">
            <Select
              value={locationId}
              onChange={e => setLocationId(e.target.value)}
              options={locationOptions}
            />
          </div>
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

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-16 text-text-tertiary">
            <Star size={32} className="mx-auto mb-3 text-gray-200 fill-gray-200" />
            <p className="text-sm font-medium text-text-secondary">Aucun avis</p>
            <p className="text-xs mt-1">Synchronisez pour récupérer vos avis Google Business Profile.</p>
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
