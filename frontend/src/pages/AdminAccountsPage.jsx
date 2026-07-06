import { useEffect, useState } from 'react'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import AdminLayout from '../components/layout/AdminLayout'

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR')
}

function ownerLabel(owner) {
  if (!owner) return '—'
  const name = [owner.firstname, owner.lastname].filter(Boolean).join(' ')
  return name ? `${name} (${owner.email})` : owner.email
}

function PlanSelect({ account, plans, onChanged }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleChange(e) {
    const value = e.target.value
    const planId = value === '' ? null : value
    setSaving(true)
    setError(null)
    try {
      await api.put(`/api/v1/admin/accounts/${account.id}/plan`, { plan_id: planId })
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <select
        className="border rounded px-2 py-1 text-sm"
        value={account.plan?.id ?? ''}
        onChange={handleChange}
        disabled={saving}
      >
        <option value="">Aucun plan</option>
        {plans?.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      {error && <div className="text-red-600 text-xs mt-1">{error}</div>}
    </div>
  )
}

function AddCreditsButton({ account, onChanged }) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function submit() {
    const n = Number(amount)
    if (!Number.isFinite(n) || n <= 0) {
      setError('Montant invalide')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await api.post(`/api/v1/credits/add?business_id=${account.id}`, {
        amount: n,
        action_type: 'admin_grant',
        source: 'bonus',
      })
      setOpen(false)
      setAmount('')
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-[#7C5CFC] text-sm underline"
      >
        + Crédits
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        className="border rounded px-2 py-1 text-sm w-20"
        placeholder="Montant"
        value={amount}
        onChange={e => setAmount(e.target.value)}
        autoFocus
      />
      <button onClick={submit} disabled={saving} className="bg-[#7C5CFC] text-white px-2 py-1 rounded text-sm disabled:opacity-50">
        OK
      </button>
      <button onClick={() => { setOpen(false); setError(null) }} className="text-sm text-gray-500">
        Annuler
      </button>
      {error && <span className="text-red-600 text-xs">{error}</span>}
    </div>
  )
}

export default function AdminAccountsPage() {
  const { user, isLoading: authLoading } = useAuth()
  const [accounts, setAccounts] = useState(null)
  const [plans, setPlans] = useState(null)
  const [q, setQ] = useState('')
  const [error, setError] = useState(null)

  function load(query) {
    const qs = query ? `?q=${encodeURIComponent(query)}` : ''
    api.get(`/api/v1/admin/accounts${qs}`)
      .then(setAccounts)
      .catch(err => setError(err.message))
  }

  useEffect(() => {
    load('')
    api.get('/api/v1/admin/plans').then(setPlans).catch(() => {})
  }, [])

  function handleSearch(e) {
    e.preventDefault()
    load(q)
  }

  if (authLoading) return null
  if (user?.role !== 'superadmin') {
    return <div className="p-6 text-red-600">Accès réservé au Super Admin.</div>
  }

  return (
    <AdminLayout>
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-xl font-semibold mb-4">Comptes</h1>

      <form onSubmit={handleSearch} className="mb-4 flex gap-2">
        <input
          type="text"
          className="border rounded px-3 py-1.5 text-sm w-72"
          placeholder="Rechercher (entreprise ou email)"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <button type="submit" className="bg-[#7C5CFC] text-white px-3 py-1.5 rounded text-sm">
          Rechercher
        </button>
      </form>

      {error && <p className="text-red-600 mb-3">{error}</p>}
      {!accounts && !error && <p>Chargement...</p>}

      {accounts && (
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-3 py-2">Entreprise</th>
                <th className="px-3 py-2">Propriétaire</th>
                <th className="px-3 py-2">Plan</th>
                <th className="px-3 py-2">Crédits</th>
                <th className="px-3 py-2">Localisations</th>
                <th className="px-3 py-2">Créé le</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {accounts.map(a => (
                <tr key={a.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{a.name}</td>
                  <td className="px-3 py-2">{ownerLabel(a.owner)}</td>
                  <td className="px-3 py-2">
                    <PlanSelect account={a} plans={plans} onChanged={() => load(q)} />
                  </td>
                  <td className="px-3 py-2">{a.credit_balance}</td>
                  <td className="px-3 py-2">{a.locations_count}</td>
                  <td className="px-3 py-2">{formatDate(a.created_at)}</td>
                  <td className="px-3 py-2">
                    <AddCreditsButton account={a} onChanged={() => load(q)} />
                  </td>
                </tr>
              ))}
              {accounts.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-center text-gray-500">Aucun compte trouvé.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
    </AdminLayout>
  )
}
