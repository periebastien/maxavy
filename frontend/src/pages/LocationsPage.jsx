import { useState } from 'react'
import { MapPin, Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { importLibrary } from '@googlemaps/js-api-loader'
import AppLayout from '../components/layout/AppLayout'
import Button from '../components/common/Button'
import Input from '../components/common/Input'
import PlaceSearch from '../components/common/PlaceSearch'
import EntityAvatar from '../components/common/EntityAvatar'
import { faviconUrl } from '../lib/favicon'
import { useBusiness } from '../contexts/BusinessContext'
import { useLocations } from '../contexts/LocationContext'
import api from '../lib/api'

const emptyForm = { name: '', address: '', lat: null, lng: null, google_place_id: null, google_place_name: null, website_url: null }

export default function LocationsPage() {
  const { activeBusiness } = useBusiness()
  const { locations, isLoading, refresh } = useLocations()

  const [panelOpen, setPanelOpen] = useState(false)
  const [editId, setEditId]       = useState(null) // null => création
  const [form, setForm]           = useState(emptyForm)
  const [fetching, setFetching]   = useState(false)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  function openCreate() { setEditId(null); setForm(emptyForm); setError(''); setPanelOpen(true) }
  function openEdit(loc) {
    setEditId(loc.id)
    setForm({
      name:              loc.name || '',
      address:           loc.address || '',
      lat:               loc.lat ?? null,
      lng:               loc.lng ?? null,
      google_place_id:   loc.google_place_id || null,
      google_place_name: loc.google_place_name || null,
      website_url:       loc.website_url || null,
    })
    setError(''); setPanelOpen(true)
  }
  function closePanel() { setPanelOpen(false); setEditId(null); setForm(emptyForm); setError('') }

  async function handleSelect(place) {
    setError(''); setFetching(true)
    const base = { google_place_id: place.place_id, google_place_name: place.name, name: place.name, address: place.address || '' }
    try {
      const { Place } = await importLibrary('places')
      const p = new Place({ id: place.place_id })
      await p.fetchFields({ fields: ['displayName', 'formattedAddress', 'location', 'websiteURI'] })
      setForm(f => ({
        ...f, ...base,
        name:        p.displayName || place.name,
        address:     p.formattedAddress || place.address || '',
        lat:         p.location ? p.location.lat() : null,
        lng:         p.location ? p.location.lng() : null,
        website_url: p.websiteURI || null,
      }))
    } catch {
      setForm(f => ({ ...f, ...base }))
    } finally {
      setFetching(false)
    }
  }

  async function handleSave() {
    if (!form.google_place_id) { setError('Sélectionnez une fiche Google'); return }
    if (!form.name.trim())     { setError('Le nom est requis'); return }
    setSaving(true); setError('')
    try {
      const payload = {
        name:              form.name.trim(),
        address:           form.address || undefined,
        lat:               form.lat ?? undefined,
        lng:               form.lng ?? undefined,
        google_place_id:   form.google_place_id,
        google_place_name: form.google_place_name || undefined,
        website_url:       form.website_url || undefined,
      }
      if (editId) {
        await api.patch(`/api/v1/locations/${editId}`, payload)
      } else {
        await api.post('/api/v1/locations', { business_id: activeBusiness.id, ...payload })
      }
      await refresh()
      closePanel()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(loc) {
    if (!window.confirm(`Supprimer la localisation « ${loc.name} » ?`)) return
    try {
      await api.delete(`/api/v1/locations/${loc.id}`)
      await refresh()
    } catch (err) {
      window.alert(err.message)
    }
  }

  return (
    <AppLayout
      title="Localisations"
      actions={!panelOpen && <Button onClick={openCreate}><Plus size={15} /> Ajouter une localisation</Button>}
    >
      <div className="max-w-3xl space-y-6">

        {/* Panneau création / édition */}
        {panelOpen && (
          <div className="bg-white border border-border rounded-xl">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <p className="text-sm font-semibold text-text-primary">{editId ? 'Modifier la localisation' : 'Nouvelle localisation'}</p>
              <button onClick={closePanel} className="text-text-tertiary hover:text-text-primary"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-text-primary">Fiche Google</label>
                <PlaceSearch
                  onSelect={handleSelect}
                  country={activeBusiness?.country || ''}
                  placeholder="Recherchez l'établissement sur Google Maps…"
                />
              </div>
              {fetching && <p className="text-xs text-text-tertiary">Récupération de la fiche…</p>}
              {form.google_place_id && !fetching && (
                <>
                  <div className="flex items-center gap-2.5 p-3 bg-success/5 border border-success/20 rounded-lg">
                    <Check size={15} className="text-success shrink-0" />
                    <span className="text-xs text-success font-medium">{form.google_place_name || 'Fiche Google sélectionnée'}</span>
                  </div>
                  <Input
                    label="Nom de la localisation"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    required
                  />
                  {form.address && (
                    <div className="flex items-start gap-2 text-xs text-text-secondary">
                      <MapPin size={14} className="text-text-tertiary shrink-0 mt-0.5" /><span>{form.address}</span>
                    </div>
                  )}
                </>
              )}
              {error && <p className="text-sm text-danger">{error}</p>}
              <div className="flex items-center gap-3 pt-1">
                <Button onClick={handleSave} disabled={saving || !form.google_place_id}>
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </Button>
                <Button variant="secondary" onClick={closePanel} disabled={saving}>Annuler</Button>
              </div>
            </div>
          </div>
        )}

        {/* Liste */}
        {isLoading ? (
          <p className="text-sm text-text-tertiary">Chargement…</p>
        ) : locations.length === 0 ? (
          !panelOpen && (
            <div className="bg-white border border-border rounded-xl p-10 text-center">
              <MapPin size={28} className="text-text-tertiary mx-auto mb-3" />
              <p className="text-sm font-medium text-text-primary">Aucune localisation</p>
              <p className="text-xs text-text-secondary mt-1 mb-4">Ajoutez votre première localisation pour collecter des avis.</p>
              <Button onClick={openCreate}><Plus size={15} /> Ajouter une localisation</Button>
            </div>
          )
        ) : (
          <div className="space-y-3">
            {locations.map(loc => (
              <div key={loc.id} className="bg-white border border-border rounded-xl p-4 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <EntityAvatar name={loc.name} src={faviconUrl(loc.website_url)} size={36} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{loc.name}</p>
                    {loc.address && <p className="text-xs text-text-secondary truncate">{loc.address}</p>}
                    <span className="inline-flex items-center gap-1 mt-1 text-xs text-success"><Check size={11} /> Fiche Google connectée</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(loc)} title="Modifier" className="p-1.5 rounded text-text-tertiary hover:text-accent hover:bg-accent-light transition-colors"><Pencil size={15} /></button>
                  <button onClick={() => handleDelete(loc)} title="Supprimer" className="p-1.5 rounded text-text-tertiary hover:text-danger hover:bg-red-50 transition-colors"><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
