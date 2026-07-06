import { useEffect, useState } from 'react'
import api from '../lib/api'
import AdminLayout from '../components/layout/AdminLayout'

const FREQUENCIES = ['monthly', 'weekly', 'daily']
const SHAPES = ['square', 'circle']
const SPACINGS = [250, 500, 750, 1000, 1500, 2000] // cf. GeogridConfigPage.jsx SPACING_OPTIONS

function spacingLabel(m) {
  return m < 1000 ? `${m} m` : `${m / 1000} km`
}

function GeneralForm({ plan, onSaved }) {
  const [form, setForm] = useState({
    name: plan.name ?? '',
    description: plan.description ?? '',
    price: plan.price ?? 0,
    monthly_credits: plan.monthly_credits ?? 0,
    max_businesses: plan.max_businesses ?? '',
    max_locations: plan.max_locations ?? '',
    features: (plan.features ?? []).join('\n'),
    active: plan.active ?? true,
    stripe_price_id: plan.stripe_price_id ?? '',
    stripe_price_id_yearly: plan.stripe_price_id_yearly ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  async function save() {
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      await api.put(`/api/v1/admin/plans/${plan.id}`, {
        name: form.name,
        description: form.description,
        price: Number(form.price),
        monthly_credits: Number(form.monthly_credits),
        max_businesses: form.max_businesses === '' ? null : Number(form.max_businesses),
        max_locations: form.max_locations === '' ? null : Number(form.max_locations),
        features: form.features.split('\n').map(s => s.trim()).filter(Boolean),
        active: form.active,
        stripe_price_id: form.stripe_price_id || null,
        stripe_price_id_yearly: form.stripe_price_id_yearly || null,
      })
      setSuccess(true)
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <label className="text-sm">
        Nom
        <input type="text" className="border rounded px-2 py-1 w-full mt-1"
          value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
      </label>
      <label className="text-sm flex items-center gap-2 mt-5">
        <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
        Actif
      </label>
      <label className="text-sm col-span-2">
        Description
        <input type="text" className="border rounded px-2 py-1 w-full mt-1"
          value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
      </label>
      <label className="text-sm">
        Prix (€)
        <input type="number" step="0.01" className="border rounded px-2 py-1 w-full mt-1"
          value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
      </label>
      <label className="text-sm">
        Crédits / mois
        <input type="number" className="border rounded px-2 py-1 w-full mt-1"
          value={form.monthly_credits} onChange={e => setForm(f => ({ ...f, monthly_credits: e.target.value }))} />
      </label>
      <label className="text-sm">
        Entreprises max <span className="text-gray-400">(vide = illimité)</span>
        <input type="number" min="1" className="border rounded px-2 py-1 w-full mt-1"
          value={form.max_businesses} onChange={e => setForm(f => ({ ...f, max_businesses: e.target.value }))} />
      </label>
      <label className="text-sm">
        Localisations max / entreprise <span className="text-gray-400">(vide = illimité)</span>
        <input type="number" min="1" className="border rounded px-2 py-1 w-full mt-1"
          value={form.max_locations} onChange={e => setForm(f => ({ ...f, max_locations: e.target.value }))} />
      </label>
      <label className="text-sm">
        Stripe price ID (mensuel)
        <input type="text" className="border rounded px-2 py-1 w-full mt-1"
          value={form.stripe_price_id} onChange={e => setForm(f => ({ ...f, stripe_price_id: e.target.value }))} />
      </label>
      <label className="text-sm">
        Stripe price ID (annuel)
        <input type="text" className="border rounded px-2 py-1 w-full mt-1"
          value={form.stripe_price_id_yearly} onChange={e => setForm(f => ({ ...f, stripe_price_id_yearly: e.target.value }))} />
      </label>
      <label className="text-sm col-span-2">
        Features (une par ligne)
        <textarea rows={4} className="border rounded px-2 py-1 w-full mt-1"
          value={form.features} onChange={e => setForm(f => ({ ...f, features: e.target.value }))} />
      </label>
      <div className="col-span-2 flex items-center gap-3">
        <button onClick={save} disabled={saving}
          className="bg-[#7C5CFC] text-white px-4 py-1.5 rounded text-sm disabled:opacity-50">
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
        {success && <span className="text-green-600 text-sm">Enregistré</span>}
        {error && <span className="text-red-600 text-sm">{error}</span>}
      </div>
    </div>
  )
}

function NewPlanForm({ onCreated, onCancel }) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: 0,
    monthly_credits: 0,
    features: '',
    active: true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function create() {
    setSaving(true)
    setError(null)
    try {
      await api.post('/api/v1/admin/plans', {
        name: form.name,
        description: form.description,
        price: Number(form.price),
        monthly_credits: Number(form.monthly_credits),
        features: form.features.split('\n').map(s => s.trim()).filter(Boolean),
        active: form.active,
      })
      onCreated()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border rounded-lg p-4 mb-6 bg-gray-50">
      <h2 className="font-medium mb-3">Nouveau plan</h2>
      <div className="grid grid-cols-2 gap-4">
        <label className="text-sm">
          Nom
          <input type="text" className="border rounded px-2 py-1 w-full mt-1"
            value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </label>
        <label className="text-sm">
          Prix (€)
          <input type="number" step="0.01" className="border rounded px-2 py-1 w-full mt-1"
            value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
        </label>
        <label className="text-sm">
          Crédits / mois
          <input type="number" className="border rounded px-2 py-1 w-full mt-1"
            value={form.monthly_credits} onChange={e => setForm(f => ({ ...f, monthly_credits: e.target.value }))} />
        </label>
        <label className="text-sm col-span-2">
          Description
          <input type="text" className="border rounded px-2 py-1 w-full mt-1"
            value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </label>
        <label className="text-sm col-span-2">
          Features (une par ligne)
          <textarea rows={3} className="border rounded px-2 py-1 w-full mt-1"
            value={form.features} onChange={e => setForm(f => ({ ...f, features: e.target.value }))} />
        </label>
      </div>
      <div className="flex items-center gap-3 mt-3">
        <button onClick={create} disabled={saving || !form.name.trim()}
          className="bg-[#7C5CFC] text-white px-4 py-1.5 rounded text-sm disabled:opacity-50">
          {saving ? 'Création...' : 'Créer'}
        </button>
        <button onClick={onCancel} className="text-sm text-gray-600">Annuler</button>
        {error && <span className="text-red-600 text-sm">{error}</span>}
      </div>
    </div>
  )
}

function RankTrackingForm({ plan, onSaved }) {
  const [form, setForm] = useState({
    max_grid_size: plan.rank_tracking?.max_grid_size ?? '',
    max_competitors: plan.rank_tracking?.max_competitors ?? '',
    max_keywords: plan.rank_tracking?.max_keywords ?? '',
    grid_spacing_m: plan.rank_tracking?.grid_spacing_m ?? SPACINGS[1],
    allowed_frequencies: plan.rank_tracking?.allowed_frequencies ?? [],
    allowed_shapes: plan.rank_tracking?.allowed_shapes ?? [],
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  if (!plan.rank_tracking) {
    return <p className="text-sm text-gray-500">Module non activé pour ce plan.</p>
  }

  function toggle(field, value) {
    setForm(f => ({
      ...f,
      [field]: f[field].includes(value) ? f[field].filter(v => v !== value) : [...f[field], value],
    }))
  }

  async function save() {
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      await api.put(`/api/v1/admin/plans/${plan.id}/rank-tracking`, {
        max_grid_size: Number(form.max_grid_size),
        max_competitors: Number(form.max_competitors),
        max_keywords: Number(form.max_keywords),
        grid_spacing_m: Number(form.grid_spacing_m),
        allowed_frequencies: form.allowed_frequencies,
        allowed_shapes: form.allowed_shapes,
      })
      setSuccess(true)
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid grid-cols-2 gap-4 mt-3">
      <label className="text-sm">
        Taille grille max (impair)
        <input type="number" className="border rounded px-2 py-1 w-full mt-1"
          value={form.max_grid_size} onChange={e => setForm(f => ({ ...f, max_grid_size: e.target.value }))} />
      </label>
      <label className="text-sm">
        Concurrents max
        <input type="number" className="border rounded px-2 py-1 w-full mt-1"
          value={form.max_competitors} onChange={e => setForm(f => ({ ...f, max_competitors: e.target.value }))} />
      </label>
      <label className="text-sm">
        Mots-clés max
        <input type="number" className="border rounded px-2 py-1 w-full mt-1"
          value={form.max_keywords} onChange={e => setForm(f => ({ ...f, max_keywords: e.target.value }))} />
      </label>
      <label className="text-sm">
        Espacement grille
        <select className="border rounded px-2 py-1 w-full mt-1"
          value={form.grid_spacing_m} onChange={e => setForm(f => ({ ...f, grid_spacing_m: Number(e.target.value) }))}>
          {SPACINGS.map(m => <option key={m} value={m}>{spacingLabel(m)}</option>)}
        </select>
      </label>
      <div className="text-sm">
        Fréquences autorisées
        <div className="flex gap-3 mt-1">
          {FREQUENCIES.map(f => (
            <label key={f} className="flex items-center gap-1">
              <input type="checkbox" checked={form.allowed_frequencies.includes(f)} onChange={() => toggle('allowed_frequencies', f)} />
              {f}
            </label>
          ))}
        </div>
      </div>
      <div className="text-sm">
        Formes autorisées
        <div className="flex gap-3 mt-1">
          {SHAPES.map(s => (
            <label key={s} className="flex items-center gap-1">
              <input type="checkbox" checked={form.allowed_shapes.includes(s)} onChange={() => toggle('allowed_shapes', s)} />
              {s}
            </label>
          ))}
        </div>
      </div>
      <div className="col-span-2 flex items-center gap-3 mt-1">
        <button onClick={save} disabled={saving}
          className="bg-[#7C5CFC] text-white px-4 py-1.5 rounded text-sm disabled:opacity-50">
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
        {success && <span className="text-green-600 text-sm">Enregistré</span>}
        {error && <span className="text-red-600 text-sm">{error}</span>}
      </div>
    </div>
  )
}

export default function AdminPlansPage() {
  const [plans, setPlans] = useState(null)
  const [error, setError] = useState(null)
  const [showNew, setShowNew] = useState(false)

  function load() {
    api.get('/api/v1/admin/plans')
      .then(setPlans)
      .catch(err => setError(err.message))
  }

  useEffect(() => { load() }, [])

  return (
    <AdminLayout>
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Gestion des plans</h1>
        {!showNew && (
          <button onClick={() => setShowNew(true)}
            className="bg-[#7C5CFC] text-white px-4 py-1.5 rounded text-sm">
            Nouveau plan
          </button>
        )}
      </div>
      {error && <p className="text-red-600 mb-3">{error}</p>}
      {showNew && (
        <NewPlanForm
          onCreated={() => { setShowNew(false); load() }}
          onCancel={() => setShowNew(false)}
        />
      )}
      {!plans && !error && <p>Chargement...</p>}
      <div className="space-y-6">
        {plans?.map(plan => (
          <div key={plan.id} className="border rounded-lg p-4">
            <h2 className="font-medium mb-3">{plan.name}</h2>
            <GeneralForm plan={plan} onSaved={load} />
            <hr className="my-4" />
            <h3 className="text-sm font-medium text-gray-700 mb-1">Quotas geogrid (rank_tracking)</h3>
            <RankTrackingForm plan={plan} onSaved={load} />
          </div>
        ))}
      </div>
    </div>
    </AdminLayout>
  )
}
