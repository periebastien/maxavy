import { useState, useEffect } from 'react'
import { Check, Zap } from 'lucide-react'
import AppLayout from '../components/layout/AppLayout'
import Button from '../components/common/Button'
import Badge from '../components/common/Badge'
import { useBusiness } from '../contexts/BusinessContext'
import api from '../lib/api'

function PlanCard({ plan, current, onSubscribe, loading }) {
  const isFree = parseFloat(plan.price) === 0
  const isCurrent = current?.id === plan.id
  const features = Array.isArray(plan.features) ? plan.features : []

  return (
    <div className={`bg-white rounded-xl border-2 p-6 flex flex-col gap-5 transition-all ${isCurrent ? 'border-accent' : 'border-border'}`}>
      <div>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-semibold text-text-primary">{plan.name}</h3>
          {isCurrent && <Badge variant="accent">Plan actuel</Badge>}
        </div>
        <p className="text-xs text-text-tertiary">{plan.description}</p>
      </div>

      <div>
        {isFree
          ? <span className="text-3xl font-bold text-text-primary">Gratuit</span>
          : <div className="flex items-end gap-1">
              <span className="text-3xl font-bold text-text-primary">{parseFloat(plan.price).toFixed(0)}€</span>
              <span className="text-sm text-text-tertiary mb-1">/mois</span>
            </div>
        }
        <p className="text-xs text-text-secondary mt-1">
          <Zap size={11} className="inline mr-0.5 text-accent" />
          {plan.monthly_credits} crédits / mois
        </p>
      </div>

      <ul className="space-y-2 flex-1">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
            <Check size={14} className="text-success shrink-0 mt-0.5" />
            {f}
          </li>
        ))}
      </ul>

      <Button
        variant={isCurrent ? 'secondary' : 'primary'}
        disabled={isCurrent || isFree || loading}
        onClick={() => onSubscribe(plan.id)}
        className="w-full"
      >
        {isCurrent ? 'Plan actuel' : isFree ? 'Gratuit' : 'Choisir ce plan'}
      </Button>
    </div>
  )
}

export default function PricingPage() {
  const { activeBusiness } = useBusiness()
  const [plans, setPlans]     = useState([])
  const [currentPlan, setCurrentPlan] = useState(null)
  const [loading, setLoading] = useState(null)
  const [error, setError]     = useState(null)

  useEffect(() => {
    api.get('/api/v1/stripe/plans').then(setPlans).catch(() => {})
  }, [])

  useEffect(() => {
    if (!activeBusiness?.plan_id || !plans.length) return
    setCurrentPlan(plans.find(p => p.id === activeBusiness.plan_id) || null)
  }, [activeBusiness, plans])

  async function handleSubscribe(planId) {
    if (!activeBusiness) return
    setLoading(planId)
    setError(null)
    try {
      const { url } = await api.post(
        `/api/v1/stripe/checkout/subscribe?business_id=${activeBusiness.id}`,
        { planId }
      )
      window.location.href = url
    } catch (err) {
      setError(err.message || 'Erreur lors de la redirection vers le paiement')
      setLoading(null)
    }
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Plans & Tarifs</h1>
          <p className="text-sm text-text-tertiary mt-0.5">Choisissez le plan adapté à votre activité</p>
        </div>

        {error && (
          <div className="text-sm text-danger bg-red-50 border border-red-100 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              current={currentPlan}
              onSubscribe={handleSubscribe}
              loading={loading === plan.id}
            />
          ))}
        </div>

        <p className="text-xs text-text-tertiary text-center">
          Paiement sécurisé par Stripe. Résiliable à tout moment.
        </p>
      </div>
    </AppLayout>
  )
}
