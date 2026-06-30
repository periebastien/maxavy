import { useState, useEffect, useRef } from 'react'
import { Mail, Phone, Plus, Pause, Play, X, AlertCircle, Check, Users, Search } from 'lucide-react'
import AppLayout from '../components/layout/AppLayout'
import Button from '../components/common/Button'
import Input from '../components/common/Input'
import Select from '../components/common/Select'
import Badge from '../components/common/Badge'
import { useBusiness } from '../contexts/BusinessContext'
import { useLocations } from '../contexts/LocationContext'
import api from '../lib/api'

const STATUS_LABEL   = { running: 'En cours', paused: 'En pause', completed: 'Terminée', cancelled: 'Annulée' }
const STATUS_VARIANT = { running: 'accent', paused: 'neutral', completed: 'success', cancelled: 'neutral' }
const CHANNEL_ICON   = { email: Mail, sms: Phone }

function ProgressBar({ sent, total }) {
  const pct = total > 0 ? Math.round((sent / total) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
        <div className="bg-accent h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-text-secondary shrink-0">{sent}/{total}</span>
    </div>
  )
}

const emptyForm = { name: '', channel: 'email', locationId: '', ratePer: '10', rateUnit: 'day', mode: 'uninvited' }

export default function InvitationsPage() {
  const { activeBusiness } = useBusiness()
  const { locations = [] } = useLocations() || {}

  const [campaigns, setCampaigns]     = useState([])
  const [stats, setStats]             = useState(null)
  const [isLoading, setIsLoading]     = useState(true)
  const [showForm, setShowForm]       = useState(false)

  const [form, setForm]               = useState(emptyForm)
  const [searchQ, setSearchQ]         = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [saving, setSaving]           = useState(false)
  const [formError, setFormError]     = useState('')
  const [formSuccess, setFormSuccess] = useState('')

  const debounceRef = useRef(null)

  async function loadCampaigns() {
    if (!activeBusiness) return
    setIsLoading(true)
    try {
      const [c, s] = await Promise.all([
        api.get(`/api/v1/campaigns?businessId=${activeBusiness.id}`),
        api.get(`/api/v1/customers/stats?business_id=${activeBusiness.id}`),
      ])
      setCampaigns(c)
      setStats(s)
    } catch {
      setCampaigns([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { loadCampaigns() }, [activeBusiness?.id])

  useEffect(() => {
    if (!showForm) return
    setForm(f => ({ ...f, locationId: f.locationId || locations[0]?.id || '' }))
  }, [showForm, locations.length])

  // Recherche debouncée (mode manuel uniquement)
  useEffect(() => {
    if (form.mode !== 'manual') return
    clearTimeout(debounceRef.current)
    if (!searchQ.trim()) { setSearchResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const results = await api.get(
          `/api/v1/customers/search?business_id=${activeBusiness.id}&q=${encodeURIComponent(searchQ)}&limit=50`
        )
        setSearchResults(results)
      } catch {
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    }, 350)
  }, [searchQ, form.mode])

  function setField(k) { return e => { setFormError(''); setForm(f => ({ ...f, [k]: e.target.value })) } }

  function toggleId(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function openForm() {
    setShowForm(true)
    setForm(emptyForm)
    setSearchQ('')
    setSearchResults([])
    setSelectedIds(new Set())
    setFormError('')
    setFormSuccess('')
  }

  function estimatedCount() {
    if (form.mode === 'uninvited') return stats?.uninvited ?? '…'
    if (form.mode === 'all')      return stats?.total     ?? '…'
    return selectedIds.size
  }

  async function handleCreate() {
    if (form.mode === 'manual' && selectedIds.size === 0) {
      setFormError('Sélectionnez au moins un client'); return
    }
    if (!form.locationId) { setFormError('Sélectionnez une localisation'); return }
    if (!Number(form.ratePer) || Number(form.ratePer) < 1) {
      setFormError('La cadence doit être ≥ 1'); return
    }
    setSaving(true); setFormError('')
    try {
      const body = {
        businessId: activeBusiness.id,
        name:       form.name.trim() || undefined,
        channel:    form.channel,
        locationId: form.locationId,
        ratePer:    Number(form.ratePer),
        rateUnit:   form.rateUnit,
      }
      if (form.mode === 'manual') body.customerIds = [...selectedIds]
      else body.filter = form.mode

      await api.post('/api/v1/campaigns', body)
      const count = estimatedCount()
      setFormSuccess(`Campagne créée — ${count} invitation(s) planifiée(s).`)
      setShowForm(false)
      await loadCampaigns()
      setTimeout(() => setFormSuccess(''), 5000)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleAction(campaignId, action) {
    try {
      await api.patch(`/api/v1/campaigns/${campaignId}/${action}`, { businessId: activeBusiness.id })
      await loadCampaigns()
    } catch (err) {
      alert(err.message)
    }
  }

  const count = estimatedCount()

  return (
    <AppLayout
      title="Invitations"
      actions={!showForm && (
        <Button onClick={openForm}><Plus size={15} /> Nouvelle campagne</Button>
      )}
    >
      <div className="max-w-4xl space-y-6">

        {formSuccess && (
          <div className="flex items-center gap-2 text-sm text-success bg-green-50 border border-green-200 p-3 rounded-lg">
            <Check size={15} /> {formSuccess}
          </div>
        )}

        {/* Formulaire nouvelle campagne */}
        {showForm && (
          <div className="bg-white border border-border rounded-xl">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <p className="text-sm font-semibold text-text-primary">Nouvelle campagne</p>
              <button onClick={() => setShowForm(false)} className="text-text-tertiary hover:text-text-primary"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-5">

              <Input
                label="Nom de la campagne (optionnel)"
                value={form.name}
                onChange={setField('name')}
                placeholder="Ex : Relance clients juin 2026"
              />

              <div className="grid grid-cols-2 gap-4">
                {/* Canal */}
                <div>
                  <p className="text-xs font-medium text-text-secondary mb-1.5">Canal</p>
                  <div className="flex gap-2">
                    {[{ k: 'email', label: 'Email', Icon: Mail }, { k: 'sms', label: 'SMS', Icon: Phone }].map(({ k, label, Icon }) => (
                      <button key={k} onClick={() => setForm(f => ({ ...f, channel: k }))}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          form.channel === k ? 'border-accent bg-accent-light text-accent' : 'border-border text-text-secondary hover:border-accent'
                        }`}
                      >
                        <Icon size={13} /> {label}
                      </button>
                    ))}
                  </div>
                </div>

                <Select label="Localisation" value={form.locationId} onChange={setField('locationId')}>
                  <option value="">Sélectionner…</option>
                  {locations.map(l => (
                    <option key={l.id} value={l.id}>{l.name}{l.address ? ` — ${l.address}` : ''}</option>
                  ))}
                </Select>
              </div>

              {/* Cadence */}
              <div>
                <p className="text-xs font-medium text-text-secondary mb-1.5">Cadence d'envoi</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <Input type="number" min="1" value={form.ratePer} onChange={setField('ratePer')} className="w-24" />
                  <span className="text-sm text-text-secondary">invitation(s) par</span>
                  <div className="flex gap-1">
                    {[{ k: 'day', label: 'jour' }, { k: 'week', label: 'semaine' }].map(({ k, label }) => (
                      <button key={k} onClick={() => setForm(f => ({ ...f, rateUnit: k }))}
                        className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                          form.rateUnit === k ? 'border-accent bg-accent-light text-accent' : 'border-border text-text-secondary hover:border-accent'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {Number(form.ratePer) > 0 && (
                  <p className="text-xs text-text-tertiary mt-1">
                    1 invitation toutes les {form.rateUnit === 'day'
                      ? `${Math.round(1440 / Number(form.ratePer))} min`
                      : `${Math.round(10080 / Number(form.ratePer))} min`}
                  </p>
                )}
              </div>

              {/* Sélection clients */}
              <div>
                <p className="text-xs font-medium text-text-secondary mb-1.5">Clients à inviter</p>
                <div className="flex gap-1 mb-3">
                  {[
                    { k: 'uninvited', label: 'Non invités', count: stats?.uninvited },
                    { k: 'all',      label: 'Tous',        count: stats?.total },
                    { k: 'manual',   label: 'Sélection manuelle' },
                  ].map(({ k, label, count: c }) => (
                    <button key={k}
                      onClick={() => { setForm(f => ({ ...f, mode: k })); setSearchQ(''); setSearchResults([]); setSelectedIds(new Set()) }}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                        form.mode === k ? 'border-accent bg-accent-light text-accent' : 'border-border text-text-secondary hover:border-accent'
                      }`}
                    >
                      {label}{c !== undefined ? ` (${c})` : ''}
                    </button>
                  ))}
                </div>

                {/* Modes non-invités / tous : juste un résumé */}
                {form.mode !== 'manual' && (
                  <div className="flex items-center gap-3 p-4 bg-gray-50 border border-border rounded-lg">
                    <Users size={16} className="text-text-secondary shrink-0" />
                    <p className="text-sm text-text-secondary">
                      <strong className="text-text-primary">{form.mode === 'uninvited' ? stats?.uninvited : stats?.total}</strong>
                      {' '}client(s) {form.mode === 'uninvited' ? 'sans invitation' : 'au total'} seront ciblés.
                    </p>
                  </div>
                )}

                {/* Mode manuel : recherche + liste */}
                {form.mode === 'manual' && (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="p-3 border-b border-border bg-gray-50 relative">
                      <Search size={14} className="absolute left-5 top-1/2 -translate-y-1/2 text-text-tertiary" />
                      <input
                        type="text"
                        value={searchQ}
                        onChange={e => setSearchQ(e.target.value)}
                        placeholder="Rechercher par nom ou email…"
                        className="w-full pl-7 pr-3 py-1.5 text-sm bg-white border border-border rounded-lg focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div className="max-h-52 overflow-y-auto">
                      {searchLoading && (
                        <p className="text-xs text-text-tertiary text-center py-4">Recherche…</p>
                      )}
                      {!searchLoading && !searchQ && (
                        <p className="text-xs text-text-tertiary text-center py-4">Tapez pour rechercher des clients</p>
                      )}
                      {!searchLoading && searchQ && searchResults.length === 0 && (
                        <p className="text-xs text-text-tertiary text-center py-4">Aucun résultat</p>
                      )}
                      {!searchLoading && searchResults.map(c => (
                        <label key={c.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer border-b border-border last:border-0">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(c.id)}
                            onChange={() => toggleId(c.id)}
                            className="accent-accent"
                          />
                          <span className="text-sm text-text-primary flex-1">
                            {[c.firstname, c.lastname].filter(Boolean).join(' ') || c.email}
                          </span>
                          <span className="text-xs text-text-tertiary">{c.email}</span>
                        </label>
                      ))}
                    </div>
                    <div className="px-4 py-2 bg-gray-50 border-t border-border">
                      <p className="text-xs text-text-tertiary">{selectedIds.size} client(s) sélectionné(s)</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Résumé crédits */}
              <div className="flex items-center gap-2 p-3 bg-accent-light/40 border border-accent/20 rounded-lg">
                <p className="text-xs text-text-secondary">
                  Cette campagne utilisera <strong className="text-text-primary">{count}</strong> crédit(s).
                </p>
              </div>

              {formError && (
                <div className="flex items-center gap-2 text-sm text-danger">
                  <AlertCircle size={14} /> {formError}
                </div>
              )}

              <div className="flex items-center gap-3 pt-1">
                <Button onClick={handleCreate} disabled={saving || (form.mode === 'manual' && selectedIds.size === 0)}>
                  {saving ? 'Création…' : `Lancer la campagne (${count} invitations)`}
                </Button>
                <Button variant="secondary" onClick={() => setShowForm(false)} disabled={saving}>Annuler</Button>
              </div>
            </div>
          </div>
        )}

        {/* Liste des campagnes */}
        {isLoading ? (
          <p className="text-sm text-text-tertiary">Chargement…</p>
        ) : campaigns.length === 0 && !showForm ? (
          <div className="bg-white border border-border rounded-xl p-10 text-center">
            <Mail size={28} className="text-text-tertiary mx-auto mb-3" />
            <p className="text-sm font-medium text-text-primary">Aucune campagne</p>
            <p className="text-xs text-text-secondary mt-1 mb-4">
              Créez votre première campagne pour inviter vos clients à laisser un avis.
            </p>
            <Button onClick={openForm}><Plus size={15} /> Nouvelle campagne</Button>
          </div>
        ) : campaigns.length > 0 ? (
          <div className="bg-white border border-border rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <p className="text-sm font-semibold text-text-primary">Campagnes</p>
            </div>
            <div className="divide-y divide-border">
              {campaigns.map(camp => {
                const Icon = CHANNEL_ICON[camp.channel] || Mail
                const cadence = camp.rate_per_day
                  ? `${camp.rate_per_day}/jour`
                  : camp.rate_per_week ? `${camp.rate_per_week}/semaine` : '—'
                return (
                  <div key={camp.id} className="px-6 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-accent-light flex items-center justify-center shrink-0">
                          <Icon size={15} className="text-accent" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">{camp.name}</p>
                          <p className="text-xs text-text-secondary">{cadence} · {new Date(camp.created_at).toLocaleDateString('fr-FR')}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={STATUS_VARIANT[camp.status]}>{STATUS_LABEL[camp.status]}</Badge>
                        {camp.status === 'running' && (
                          <button onClick={() => handleAction(camp.id, 'pause')} title="Mettre en pause"
                            className="p-1.5 rounded text-text-tertiary hover:text-accent hover:bg-accent-light transition-colors">
                            <Pause size={14} />
                          </button>
                        )}
                        {camp.status === 'paused' && (
                          <button onClick={() => handleAction(camp.id, 'resume')} title="Reprendre"
                            className="p-1.5 rounded text-text-tertiary hover:text-accent hover:bg-accent-light transition-colors">
                            <Play size={14} />
                          </button>
                        )}
                        {['running', 'paused'].includes(camp.status) && (
                          <button onClick={() => { if (confirm('Annuler cette campagne ?')) handleAction(camp.id, 'cancel') }}
                            title="Annuler"
                            className="p-1.5 rounded text-text-tertiary hover:text-danger hover:bg-red-50 transition-colors">
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="mt-3">
                      <ProgressBar sent={camp.sent_count} total={camp.total_count} />
                      {camp.failed_count > 0 && (
                        <p className="text-xs text-danger mt-0.5">{camp.failed_count} échec(s)</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}

      </div>
    </AppLayout>
  )
}
