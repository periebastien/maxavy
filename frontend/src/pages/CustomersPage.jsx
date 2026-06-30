import { useState, useEffect, useRef } from 'react'
import { Users, Plus, Upload, X, Check, AlertCircle, FileText, Trash2, Mail, Phone } from 'lucide-react'
import AppLayout from '../components/layout/AppLayout'
import Button from '../components/common/Button'
import Input from '../components/common/Input'
import Badge from '../components/common/Badge'
import { useBusiness } from '../contexts/BusinessContext'
import { useLocations } from '../contexts/LocationContext'
import api from '../lib/api'

const STATUS_LABEL = { pending: 'En attente', invited: 'Invité', reviewed: 'A laissé un avis' }
const STATUS_VARIANT = { pending: 'neutral', invited: 'accent', reviewed: 'success' }

const emptyForm = { firstname: '', lastname: '', email: '', phone: '', consent_given: false }

export default function CustomersPage() {
  const { activeBusiness, refresh: refreshBusiness } = useBusiness()
  const { locations, activeLocation } = useLocations()

  const [customers, setCustomers]   = useState([])
  const [isLoading, setIsLoading]   = useState(true)
  const [panel, setPanel]           = useState(null) // null | 'add' | 'import'

  const [form, setForm]             = useState(emptyForm)
  const [saving, setSaving]         = useState(false)
  const [formError, setFormError]   = useState('')

  const [csvFile, setCsvFile]       = useState(null)
  const [csvConsent, setCsvConsent] = useState(false)
  const [importing, setImporting]   = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [importError, setImportError]   = useState('')
  const [dragging, setDragging]     = useState(false)
  const fileInputRef = useRef(null)

  const [inviteModal, setInviteModal]         = useState(null)
  const [inviteChannel, setInviteChannel]     = useState('email')
  const [inviteLocationId, setInviteLocationId] = useState('')
  const [inviting, setInviting]               = useState(false)
  const [inviteError, setInviteError]         = useState('')

  async function load() {
    if (!activeBusiness) return
    setIsLoading(true)
    try {
      const data = await api.get(`/api/v1/customers?business_id=${activeBusiness.id}`)
      setCustomers(data)
    } catch {
      setCustomers([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { load() }, [activeBusiness?.id])

  function openPanel(name) {
    setPanel(name)
    setForm(emptyForm); setFormError('')
    setCsvFile(null); setCsvConsent(false); setImportResult(null); setImportError('')
  }
  function closePanel() { setPanel(null) }

  async function handleAdd() {
    if (!form.email.trim()) { setFormError('L\'email est requis'); return }
    setSaving(true); setFormError('')
    try {
      await api.post('/api/v1/customers', {
        business_id:   activeBusiness.id,
        firstname:     form.firstname.trim() || undefined,
        lastname:      form.lastname.trim()  || undefined,
        email:         form.email.trim(),
        phone:         form.phone.trim()     || undefined,
        consent_given: form.consent_given,
      })
      await load()
      closePanel()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleImport() {
    if (!csvFile)     { setImportError('Sélectionnez un fichier CSV'); return }
    if (!csvConsent)  { setImportError('Vous devez confirmer le consentement'); return }
    setImporting(true); setImportError(''); setImportResult(null)
    try {
      const fd = new FormData()
      fd.append('file', csvFile)
      fd.append('business_id', activeBusiness.id)
      fd.append('consent_confirmed', 'true')
      const result = await api.upload('/api/v1/customers/import', fd)
      setImportResult(result)
      await load()
    } catch (err) {
      setImportError(err.message)
    } finally {
      setImporting(false)
    }
  }

  function openInvite(customer) {
    setInviteModal(customer)
    setInviteChannel(customer.email ? 'email' : 'sms')
    setInviteLocationId(activeLocation?.id || locations[0]?.id || '')
    setInviteError('')
  }

  async function handleInvite() {
    setInviting(true); setInviteError('')
    try {
      await api.post('/api/v1/invitations', {
        customer_id:  inviteModal.id,
        channel:      inviteChannel,
        location_id:  inviteLocationId,
        business_id:  activeBusiness.id,
      })
      await Promise.all([load(), refreshBusiness()])
      setInviteModal(null)
    } catch (err) {
      setInviteError(err.message)
    } finally {
      setInviting(false)
    }
  }

  async function handleDelete(customer) {
    if (!window.confirm(`Supprimer ${customer.firstname || customer.email} ?`)) return
    try {
      await api.delete(`/api/v1/customers/${customer.id}`)
      await load()
    } catch (err) {
      window.alert(err.message)
    }
  }

  return (
    <AppLayout
      title="Clients"
      actions={!panel && (
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => openPanel('import')}><Upload size={15} /> Importer CSV</Button>
          <Button onClick={() => openPanel('add')}><Plus size={15} /> Ajouter un client</Button>
        </div>
      )}
    >
      <div className="max-w-4xl space-y-6">

        {/* Panel — ajout individuel */}
        {panel === 'add' && (
          <div className="bg-white border border-border rounded-xl">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <p className="text-sm font-semibold text-text-primary">Nouveau client</p>
              <button onClick={closePanel} className="text-text-tertiary hover:text-text-primary"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Prénom" value={form.firstname} onChange={e => setForm(f => ({ ...f, firstname: e.target.value }))} />
                <Input label="Nom"    value={form.lastname}  onChange={e => setForm(f => ({ ...f, lastname:  e.target.value }))} />
              </div>
              <Input label="Email" type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              <Input label="Téléphone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.consent_given}
                  onChange={e => setForm(f => ({ ...f, consent_given: e.target.checked }))}
                  className="mt-0.5 accent-accent"
                />
                <span className="text-sm text-text-secondary">Ce contact a donné son consentement pour recevoir des communications</span>
              </label>
              {formError && <p className="text-sm text-danger">{formError}</p>}
              <div className="flex items-center gap-3 pt-1">
                <Button onClick={handleAdd} disabled={saving}>{saving ? 'Enregistrement…' : 'Ajouter'}</Button>
                <Button variant="secondary" onClick={closePanel} disabled={saving}>Annuler</Button>
              </div>
            </div>
          </div>
        )}

        {/* Panel — import CSV */}
        {panel === 'import' && (
          <div className="bg-white border border-border rounded-xl">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <p className="text-sm font-semibold text-text-primary">Importer depuis un CSV</p>
              <button onClick={closePanel} className="text-text-tertiary hover:text-text-primary"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-xs text-text-secondary">
                  Format attendu : <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">firstname,lastname,email,phone</code> (séparateur <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">,</code> ou <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">;</code>). L'email est obligatoire par ligne.
                </p>
                <button
                  onClick={() => {
                    const csv = 'firstname,lastname,email,phone\nJean,Dupont,jean.dupont@email.com,0612345678\nMarie,Martin,marie.martin@email.com,'
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url; a.download = 'modele-clients.csv'; a.click()
                    URL.revokeObjectURL(url)
                  }}
                  className="text-xs text-accent hover:underline shrink-0 ml-4"
                >
                  Télécharger un modèle
                </button>
              </div>

              <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={e => { setCsvFile(e.target.files[0] || null); setImportResult(null); setImportError('') }} />

              {csvFile ? (
                <div className="flex items-center gap-3 p-3 border border-border rounded-lg bg-gray-50">
                  <FileText size={18} className="text-accent shrink-0" />
                  <span className="text-sm text-text-primary flex-1 truncate">{csvFile.name}</span>
                  <button onClick={() => { setCsvFile(null); fileInputRef.current.value = '' }} className="text-text-tertiary hover:text-danger"><X size={15} /></button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current.click()}
                  onDragOver={e => { e.preventDefault(); setDragging(true) }}
                  onDragEnter={e => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={e => {
                    e.preventDefault(); setDragging(false)
                    const file = e.dataTransfer.files[0]
                    if (file) { setCsvFile(file); setImportResult(null); setImportError('') }
                  }}
                  className={`w-full border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${dragging ? 'border-accent bg-accent-light/40' : 'border-border hover:border-accent hover:bg-accent-light/30'}`}
                >
                  <Upload size={22} className={`mx-auto mb-2 ${dragging ? 'text-accent' : 'text-text-tertiary'}`} />
                  <p className="text-sm font-medium text-text-primary">Glisser-déposer ou cliquer pour sélectionner</p>
                  <p className="text-xs text-text-tertiary mt-1">Fichier CSV · Maximum 5 Mo</p>
                </div>
              )}

              <label className="flex items-start gap-2.5 cursor-pointer select-none p-4 border border-amber-200 bg-amber-50 rounded-xl">
                <input
                  type="checkbox"
                  checked={csvConsent}
                  onChange={e => setCsvConsent(e.target.checked)}
                  className="mt-0.5 accent-accent"
                />
                <span className="text-sm text-amber-800">
                  Je confirme avoir obtenu le <strong>consentement explicite</strong> de toutes les personnes listées dans ce fichier pour recevoir des communications de la part de mon établissement.
                </span>
              </label>

              {importError && (
                <div className="flex items-start gap-2 text-sm text-danger">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />{importError}
                </div>
              )}

              {importResult && (
                <div className="p-4 bg-green-50 border border-success/20 rounded-xl space-y-1">
                  <p className="text-sm font-medium text-success flex items-center gap-1.5"><Check size={14} /> Import terminé</p>
                  <p className="text-xs text-text-secondary">{importResult.imported} contact(s) importé(s) · {importResult.skipped} ignoré(s) (déjà présents)</p>
                  {importResult.errors?.length > 0 && (
                    <ul className="mt-2 space-y-0.5">
                      {importResult.errors.map((e, i) => (
                        <li key={i} className="text-xs text-danger">Ligne {e.row} : {e.message}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="flex items-center gap-3 pt-1">
                <Button onClick={handleImport} disabled={importing || !csvFile || !csvConsent}>
                  {importing ? 'Import en cours…' : 'Importer'}
                </Button>
                <Button variant="secondary" onClick={closePanel} disabled={importing}>Annuler</Button>
              </div>
            </div>
          </div>
        )}

        {/* Liste */}
        {isLoading ? (
          <p className="text-sm text-text-tertiary">Chargement…</p>
        ) : customers.length === 0 ? (
          !panel && (
            <div className="bg-white border border-border rounded-xl p-10 text-center">
              <Users size={28} className="text-text-tertiary mx-auto mb-3" />
              <p className="text-sm font-medium text-text-primary">Aucun client</p>
              <p className="text-xs text-text-secondary mt-1 mb-4">Ajoutez votre premier client ou importez un fichier CSV.</p>
              <div className="flex justify-center gap-2">
                <Button variant="secondary" onClick={() => openPanel('import')}><Upload size={15} /> Importer CSV</Button>
                <Button onClick={() => openPanel('add')}><Plus size={15} /> Ajouter un client</Button>
              </div>
            </div>
          )
        ) : (
          <div className="bg-white border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary">Nom</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary hidden md:table-cell">Téléphone</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary">Statut</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary hidden md:table-cell">Consentement</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-text-primary">
                      {[c.firstname, c.lastname].filter(Boolean).join(' ') || <span className="text-text-tertiary">—</span>}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{c.email || '—'}</td>
                    <td className="px-4 py-3 text-text-secondary hidden md:table-cell">{c.phone || '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[c.status] || 'neutral'}>{STATUS_LABEL[c.status] || c.status}</Badge>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {c.consent_given
                        ? <span className="inline-flex items-center gap-1 text-xs text-success"><Check size={12} /> Oui</span>
                        : <span className="text-xs text-text-tertiary">Non</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openInvite(c)} title="Envoyer une invitation" className="p-1.5 rounded text-text-tertiary hover:text-accent hover:bg-accent-light transition-colors">
                          <Mail size={14} />
                        </button>
                        <button onClick={() => handleDelete(c)} title="Supprimer" className="p-1.5 rounded text-text-tertiary hover:text-danger hover:bg-red-50 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-2.5 border-t border-border bg-gray-50">
              <p className="text-xs text-text-tertiary">{customers.length} client{customers.length > 1 ? 's' : ''}</p>
            </div>
          </div>
        )}
      </div>
      {/* Modal invitation */}
      {inviteModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-text-primary">Envoyer une invitation</p>
              <button onClick={() => setInviteModal(null)} className="text-text-tertiary hover:text-text-primary"><X size={16} /></button>
            </div>

            <p className="text-sm text-text-secondary">
              {[inviteModal.firstname, inviteModal.lastname].filter(Boolean).join(' ') || inviteModal.email}
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setInviteChannel('email')}
                disabled={!inviteModal.email}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm border transition-colors ${inviteChannel === 'email' ? 'border-accent bg-accent-light text-accent font-medium' : 'border-border text-text-secondary hover:border-accent/50'} disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <Mail size={13} /> Email
              </button>
              <button
                onClick={() => setInviteChannel('sms')}
                disabled={!inviteModal.phone}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm border transition-colors ${inviteChannel === 'sms' ? 'border-accent bg-accent-light text-accent font-medium' : 'border-border text-text-secondary hover:border-accent/50'} disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <Phone size={13} /> SMS
              </button>
            </div>

            {locations.length > 1 && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-text-tertiary">Localisation</label>
                <select
                  value={inviteLocationId}
                  onChange={e => setInviteLocationId(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm text-text-primary bg-white focus:outline-none focus:ring-2 focus:ring-accent/30"
                >
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}{l.address ? ` — ${l.address}` : ''}</option>)}
                </select>
              </div>
            )}

            {inviteError && (
              <div className="flex items-start gap-2 text-sm text-danger">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />{inviteError}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button onClick={handleInvite} disabled={inviting}>
                {inviting ? 'Envoi…' : 'Envoyer'}
              </Button>
              <Button variant="secondary" onClick={() => setInviteModal(null)} disabled={inviting}>Annuler</Button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
