import { useEffect, useState } from 'react'
import api from '../lib/api'
import AdminLayout from '../components/layout/AdminLayout'

export default function AdminModulesPage() {
  const [businesses, setBusinesses] = useState(null)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [modules, setModules] = useState(null)
  const [error, setError] = useState(null)
  const [savingKey, setSavingKey] = useState(null)

  useEffect(() => {
    api.get('/api/v1/admin/business-modules/businesses')
      .then(setBusinesses)
      .catch(err => setError(err.message))
  }, [])

  function loadModules(businessId) {
    setModules(null)
    api.get(`/api/v1/admin/business-modules?business_id=${businessId}`)
      .then(setModules)
      .catch(err => setError(err.message))
  }

  function selectBusiness(id) {
    setSelectedId(id)
    setError(null)
    if (id) loadModules(id)
    else setModules(null)
  }

  async function toggle(moduleKey, current) {
    setSavingKey(moduleKey)
    setError(null)
    try {
      await api.put(`/api/v1/admin/business-modules/${selectedId}/${moduleKey}`, { enabled: !current })
      loadModules(selectedId)
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingKey(null)
    }
  }

  const filtered = (businesses || []).filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <AdminLayout>
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold mb-1">Modules par entreprise</h1>
      <p className="text-sm text-gray-500 mb-4">
        Active ou désactive un module hors plan pour une entreprise précise (ex. bêta-test).
        Ce réglage vient en surcouche du gating par plan.
      </p>

      {error && <p className="text-red-600 mb-3">{error}</p>}

      <div className="mb-4">
        <input
          type="text"
          placeholder="Rechercher une entreprise..."
          className="border rounded px-2 py-1.5 w-full"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {!businesses && !error && <p className="text-sm text-gray-500 mt-2">Chargement...</p>}
        {businesses && (
          <select
            className="border rounded px-2 py-1.5 w-full mt-2"
            value={selectedId}
            onChange={e => selectBusiness(e.target.value)}
          >
            <option value="">— Choisir une entreprise —</option>
            {filtered.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}
      </div>

      {selectedId && !modules && !error && <p className="text-sm text-gray-500">Chargement des modules...</p>}

      {selectedId && modules && (
        <div className="border rounded-lg divide-y">
          {modules.map(m => (
            <div key={m.module_key} className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">{m.label}</p>
                <p className="text-xs text-gray-400">
                  {m.enabled && m.activated_at
                    ? `Activé le ${new Date(m.activated_at).toLocaleDateString('fr-FR')}`
                    : 'Désactivé'}
                </p>
              </div>
              <button
                onClick={() => toggle(m.module_key, m.enabled)}
                disabled={savingKey === m.module_key}
                className={`px-4 py-1.5 rounded text-sm text-white disabled:opacity-50 ${
                  m.enabled ? 'bg-gray-400' : 'bg-[#7C5CFC]'
                }`}
              >
                {savingKey === m.module_key ? '...' : m.enabled ? 'Désactiver' : 'Activer'}
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-4">
        Note : ce réglage est pour l'instant purement déclaratif — aucun module métier ne lit
        encore ce flag pour décider s'il est actif (le gating réel passe par le quota du plan).
        Il sera consommé par le code métier dans une session ultérieure.
      </p>
    </div>
    </AdminLayout>
  )
}
