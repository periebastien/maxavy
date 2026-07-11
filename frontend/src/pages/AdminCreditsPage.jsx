import { useEffect, useState } from 'react'
import api from '../lib/api'
import AdminLayout from '../components/layout/AdminLayout'

const COST_LABELS = {
  invitation_email:    'Invitation par email',
  invitation_sms:      'Invitation par SMS',
  invitation_whatsapp: 'Invitation par WhatsApp',
  geogrid_point:       'Geogrid — par mot-clé et par point',
}

const UNAVAILABLE_CHANNELS = ['invitation_sms', 'invitation_whatsapp']

function pricePerCredit(pack) {
  if (pack.price_per_credit != null) return pack.price_per_credit
  if (!pack.credits) return 0
  return Number(pack.price) / pack.credits
}

function PackForm({ pack, onSaved, onCancel }) {
  const isNew = !pack
  const [form, setForm] = useState({
    label: pack?.label ?? '',
    credits: pack?.credits ?? '',
    price: pack?.price ?? '',
    sort_order: pack?.sort_order ?? 0,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const payload = {
        label: form.label,
        credits: Number(form.credits),
        price: Number(form.price),
        sort_order: Number(form.sort_order),
      }
      if (isNew) {
        await api.post('/api/v1/admin/credits/packs', payload)
      } else {
        await api.put(`/api/v1/admin/credits/packs/${pack.id}`, payload)
      }
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <div className="grid grid-cols-2 gap-4">
        <label className="text-sm">
          Libellé
          <input type="text" className="border rounded px-2 py-1 w-full mt-1"
            value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
        </label>
        <label className="text-sm">
          Ordre d'affichage
          <input type="number" className="border rounded px-2 py-1 w-full mt-1"
            value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))} />
        </label>
        <label className="text-sm">
          Crédits
          <input type="number" min="1" className="border rounded px-2 py-1 w-full mt-1"
            value={form.credits} onChange={e => setForm(f => ({ ...f, credits: e.target.value }))} />
        </label>
        <label className="text-sm">
          Prix (€)
          <input type="number" step="0.01" min="0" className="border rounded px-2 py-1 w-full mt-1"
            value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
        </label>
      </div>
      <div className="flex items-center gap-3 mt-3">
        <button onClick={save} disabled={saving || !form.label.trim() || !form.credits || !form.price}
          className="bg-[#7C5CFC] text-white px-4 py-1.5 rounded text-sm disabled:opacity-50">
          {saving ? 'Enregistrement...' : isNew ? 'Créer' : 'Enregistrer'}
        </button>
        <button onClick={onCancel} className="text-sm text-gray-600">Annuler</button>
        {error && <span className="text-red-600 text-sm">{error}</span>}
      </div>
    </div>
  )
}

function PacksSection() {
  const [packs, setPacks] = useState(null)
  const [error, setError] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [showNew, setShowNew] = useState(false)
  const [busyId, setBusyId] = useState(null)

  function load() {
    api.get('/api/v1/admin/credits/packs')
      .then(setPacks)
      .catch(err => setError(err.message))
  }

  useEffect(() => { load() }, [])

  async function toggleActive(pack) {
    setBusyId(pack.id)
    setError(null)
    try {
      if (pack.active) {
        await api.delete(`/api/v1/admin/credits/packs/${pack.id}`)
      } else {
        await api.put(`/api/v1/admin/credits/packs/${pack.id}`, { active: true })
      }
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const sorted = (packs || []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-medium">Packs de crédits</h2>
        {!showNew && (
          <button onClick={() => setShowNew(true)}
            className="bg-[#7C5CFC] text-white px-4 py-1.5 rounded text-sm">
            Nouveau pack
          </button>
        )}
      </div>

      {error && <p className="text-red-600 mb-3 text-sm">{error}</p>}
      {!packs && !error && <p className="text-sm text-gray-500">Chargement...</p>}

      {showNew && (
        <div className="mb-4">
          <PackForm onSaved={() => { setShowNew(false); load() }} onCancel={() => setShowNew(false)} />
        </div>
      )}

      {packs && (
        <div className="border rounded-lg divide-y overflow-hidden">
          <div className="grid grid-cols-6 gap-2 px-4 py-2 bg-gray-50 text-xs font-medium text-gray-500">
            <span>Libellé</span>
            <span>Crédits</span>
            <span>Prix</span>
            <span>Prix / crédit</span>
            <span>Statut</span>
            <span className="text-right">Actions</span>
          </div>
          {sorted.map(pack => (
            editingId === pack.id ? (
              <div key={pack.id} className="p-4">
                <PackForm pack={pack} onSaved={() => { setEditingId(null); load() }} onCancel={() => setEditingId(null)} />
              </div>
            ) : (
              <div key={pack.id} className={`grid grid-cols-6 gap-2 px-4 py-3 items-center text-sm ${!pack.active ? 'opacity-50' : ''}`}>
                <span className="font-medium">{pack.label}</span>
                <span>{pack.credits}</span>
                <span>{Number(pack.price).toFixed(2)} €</span>
                <span>{pricePerCredit(pack).toFixed(3)} €</span>
                <span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    pack.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {pack.active ? 'Actif' : 'Inactif'}
                  </span>
                </span>
                <span className="flex justify-end gap-2">
                  <button onClick={() => setEditingId(pack.id)} className="text-xs text-[#7C5CFC]">
                    Modifier
                  </button>
                  <button
                    onClick={() => toggleActive(pack)}
                    disabled={busyId === pack.id}
                    className="text-xs text-gray-500 disabled:opacity-50"
                  >
                    {busyId === pack.id ? '...' : pack.active ? 'Désactiver' : 'Réactiver'}
                  </button>
                </span>
              </div>
            )
          ))}
          {sorted.length === 0 && (
            <p className="p-4 text-sm text-gray-500">Aucun pack pour l'instant.</p>
          )}
        </div>
      )}
    </div>
  )
}

function CostsSection() {
  const [costs, setCosts] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  function load() {
    api.get('/api/v1/admin/credits/costs')
      .then(setCosts)
      .catch(err => setError(err.message))
  }

  useEffect(() => { load() }, [])

  function updateCost(actionKey, value) {
    setSuccess(false)
    setCosts(list => list.map(c => c.action_key === actionKey ? { ...c, cost: value } : c))
  }

  async function save() {
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      await api.put('/api/v1/admin/credits/costs', {
        costs: costs.map(c => ({ action_key: c.action_key, cost: Number(c.cost) })),
      })
      setSuccess(true)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h2 className="font-medium mb-4">Coûts des actions en crédits</h2>
      {error && <p className="text-red-600 mb-3 text-sm">{error}</p>}
      {!costs && !error && <p className="text-sm text-gray-500">Chargement...</p>}

      {costs && (
        <div className="border rounded-lg divide-y">
          {costs.map(c => (
            <div key={c.action_key} className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-medium">{COST_LABELS[c.action_key] || c.label || c.action_key}</p>
                {UNAVAILABLE_CHANNELS.includes(c.action_key) && (
                  <p className="text-xs text-gray-400 mt-0.5">Canal pas encore disponible</p>
                )}
              </div>
              <input
                type="number"
                min="0"
                className="border rounded px-2 py-1 w-24 text-sm"
                value={c.cost}
                onChange={e => updateCost(c.action_key, e.target.value)}
              />
            </div>
          ))}
        </div>
      )}

      {costs && (
        <div className="flex items-center gap-3 mt-4">
          <button onClick={save} disabled={saving}
            className="bg-[#7C5CFC] text-white px-4 py-1.5 rounded text-sm disabled:opacity-50">
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
          {success && <span className="text-green-600 text-sm">Enregistré</span>}
        </div>
      )}
    </div>
  )
}

export default function AdminCreditsPage() {
  return (
    <AdminLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-8">
        <h1 className="text-xl font-semibold">Crédits</h1>

        <div className="border rounded-lg p-4">
          <PacksSection />
        </div>

        <div className="border rounded-lg p-4">
          <CostsSection />
        </div>
      </div>
    </AdminLayout>
  )
}
