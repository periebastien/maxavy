import { useState, useEffect, useCallback } from 'react'
import { Zap, TrendingUp, TrendingDown, ChevronLeft, ChevronRight } from 'lucide-react'
import AppLayout from '../components/layout/AppLayout'
import Button from '../components/common/Button'
import { useBusiness } from '../contexts/BusinessContext'
import api from '../lib/api'

const ACTION_LABELS = {
  welcome:         'Crédits de bienvenue',
  invitation:      'Invitation envoyée',
  purchase:        'Achat de crédits',
  monthly_renewal: 'Renouvellement mensuel',
  refund:          'Remboursement',
  bonus:           'Bonus',
}

const LIMIT = 20

function PackCard({ pack, onBuy, loading }) {
  return (
    <div className="bg-white border border-border rounded-xl p-4 flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-text-primary">{pack.credits} crédits</p>
        <p className="text-xs text-text-tertiary">{pack.label}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-base font-bold text-text-primary">{pack.price}€</span>
        <Button size="sm" variant="primary" onClick={() => onBuy(pack.id)} disabled={loading}>
          Acheter
        </Button>
      </div>
    </div>
  )
}

function CreditRow({ item }) {
  const isPositive = item.amount > 0
  const label = ACTION_LABELS[item.action_type] || item.action_type || '—'
  const date = new Date(item.created_at).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isPositive ? 'bg-green-50' : 'bg-red-50'}`}>
          {isPositive
            ? <TrendingUp size={14} className="text-success" />
            : <TrendingDown size={14} className="text-danger" />
          }
        </div>
        <div>
          <p className="text-sm text-text-primary">{label}</p>
          <p className="text-xs text-text-tertiary">{date}</p>
        </div>
      </div>
      <span className={`text-sm font-semibold ${isPositive ? 'text-success' : 'text-danger'}`}>
        {isPositive ? '+' : ''}{item.amount}
      </span>
    </div>
  )
}

export default function CreditsPage() {
  const { activeBusiness } = useBusiness()

  const [stats, setStats]     = useState(null)
  const [history, setHistory] = useState([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [packs, setPacks]     = useState([])
  const [buyingPack, setBuyingPack] = useState(false)
  const [packError, setPackError]   = useState(null)

  const load = useCallback(async () => {
    if (!activeBusiness) return
    setIsLoading(true)
    try {
      const [s, h] = await Promise.all([
        api.get(`/api/v1/credits/balance?business_id=${activeBusiness.id}`),
        api.get(`/api/v1/credits/history?business_id=${activeBusiness.id}&page=${page}&limit=${LIMIT}`),
      ])
      setStats(s)
      setHistory(h.history)
      setTotal(h.total)
    } catch {
      // silencieux
    } finally {
      setIsLoading(false)
    }
  }, [activeBusiness, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { api.get('/api/v1/stripe/packs').then(setPacks).catch(() => {}) }, [])

  async function handleBuyPack(packId) {
    if (!activeBusiness) return
    setBuyingPack(true)
    setPackError(null)
    try {
      const { url } = await api.post(
        `/api/v1/stripe/checkout/credits?business_id=${activeBusiness.id}`,
        { packId }
      )
      window.location.href = url
    } catch (err) {
      setPackError(err.message || 'Erreur lors de la redirection vers le paiement')
      setBuyingPack(false)
    }
  }

  const totalPages = Math.ceil(total / LIMIT)
  const pct = stats ? Math.min((stats.balance / 500) * 100, 100) : 0

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-2xl mx-auto">
        <h1 className="text-xl font-semibold text-text-primary">Crédits</h1>

        {/* Carte solde */}
        <div className="bg-white rounded-xl border border-border p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent-light rounded-xl flex items-center justify-center">
              <Zap size={18} className="text-accent" />
            </div>
            <div>
              <p className="text-xs text-text-tertiary">Solde actuel</p>
              <p className="text-2xl font-bold text-text-primary">{stats?.balance ?? '—'}</p>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs text-text-tertiary mb-1.5">
              <span>Utilisés</span>
              <span>{stats?.balance ?? 0} / 500</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="bg-bg-page rounded-lg px-4 py-3">
              <p className="text-xs text-text-tertiary">Total reçus</p>
              <p className="text-lg font-semibold text-success">+{stats?.total_earned ?? 0}</p>
            </div>
            <div className="bg-bg-page rounded-lg px-4 py-3">
              <p className="text-xs text-text-tertiary">Total utilisés</p>
              <p className="text-lg font-semibold text-danger">−{stats?.total_spent ?? 0}</p>
            </div>
          </div>
        </div>

        {/* Acheter des crédits */}
        {packs.length > 0 && (
          <div className="bg-white rounded-xl border border-border p-5 space-y-3">
            <h2 className="text-sm font-semibold text-text-primary">Acheter des crédits</h2>
            {packError && (
              <p className="text-xs text-danger">{packError}</p>
            )}
            {packs.map(pack => (
              <PackCard key={pack.id} pack={pack} onBuy={handleBuyPack} loading={buyingPack} />
            ))}
            <p className="text-xs text-text-tertiary">Paiement sécurisé par Stripe.</p>
          </div>
        )}

        {/* Historique */}
        <div className="bg-white rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-primary mb-4">Historique</h2>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-text-tertiary text-center py-8">Aucun mouvement</p>
          ) : (
            <div>
              {history.map(item => <CreditRow key={item.id} item={item} />)}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-xs text-text-tertiary">Page {page} sur {totalPages}</p>
              <div className="flex gap-2">
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
      </div>
    </AppLayout>
  )
}
