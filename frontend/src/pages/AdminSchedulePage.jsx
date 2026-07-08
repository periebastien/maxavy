import { useEffect, useState } from 'react'
import api from '../lib/api'
import AdminLayout from '../components/layout/AdminLayout'

const FREQUENCY_LABELS = { monthly: 'Mensuel', weekly: 'Hebdo', daily: 'Quotidien' }

export default function AdminSchedulePage() {
  const [items, setItems] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get('/api/v1/admin/schedule/geogrid-month')
      .then(setItems)
      .catch(err => setError(err.message))
  }, [])

  return (
    <AdminLayout>
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold mb-1">Planning geogrid — mois en cours</h1>
      <p className="text-sm text-gray-500 mb-4">
        Rapports de positionnement et hitmaps prévus à partir d'aujourd'hui jusqu'à la fin du mois.
      </p>

      {error && <p className="text-red-600 mb-3">{error}</p>}
      {!items && !error && <p className="text-sm text-gray-500">Chargement...</p>}

      {items && items.length === 0 && (
        <p className="text-sm text-gray-500">Aucun rapport prévu ce mois-ci.</p>
      )}

      {items && items.length > 0 && (
        <div className="border rounded-lg divide-y">
          {items.map((it, i) => (
            <div key={i} className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">{it.business_name} — {it.location_name}</p>
                <p className="text-xs text-gray-400">{FREQUENCY_LABELS[it.frequency] || it.frequency}</p>
              </div>
              <p className="text-sm text-gray-600">
                {new Date(it.scheduled_for).toLocaleString('fr-FR', {
                  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
    </AdminLayout>
  )
}
