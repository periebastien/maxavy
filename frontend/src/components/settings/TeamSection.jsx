import { useState, useEffect } from 'react'
import { Trash2, UserPlus, Mail, Check } from 'lucide-react'
import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'
import Badge from '../common/Badge'
import api from '../../lib/api'

const ROLE_LABELS = { owner: 'Propriétaire', admin: 'Administrateur', editor: 'Éditeur', viewer: 'Lecteur' }
const ROLE_OPTIONS = [
  { value: 'admin',  label: 'Administrateur — gère l\'équipe et tout le contenu' },
  { value: 'editor', label: 'Éditeur — peut créer et modifier le contenu' },
  { value: 'viewer', label: 'Lecteur — consultation seule' },
]

function StatusBadge({ status, expired }) {
  if (status === 'active') return <Badge variant="success">Actif</Badge>
  if (expired) return <Badge variant="danger">Expiré</Badge>
  return <Badge variant="warning">En attente</Badge>
}

export default function TeamSection({ Section, businessId }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const [email, setEmail]     = useState('')
  const [role, setRole]       = useState('viewer')
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState(null)

  async function load() {
    setLoading(true); setError('')
    try {
      const res = await api.get(`/api/v1/team?business_id=${businessId}`)
      setData(res)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (businessId) load() }, [businessId])

  const canManage = data && (data.my_role === 'owner' || data.my_role === 'admin')

  async function handleInvite(e) {
    e.preventDefault()
    setInviting(true); setInviteMsg(null)
    try {
      const res = await api.post('/api/v1/team/invite', { business_id: businessId, email: email.trim(), role })
      setInviteMsg({ type: 'success', text: res.status === 'invited'
        ? 'Invitation envoyée par email.'
        : 'Personne rattachée — elle doit accepter depuis son compte.' })
      setEmail(''); setRole('viewer')
      await load()
    } catch (err) {
      setInviteMsg({ type: 'error', text: err.message })
    } finally {
      setInviting(false)
    }
  }

  async function handleRoleChange(memberId, newRole) {
    try {
      await api.put(`/api/v1/team/${memberId}/role`, { business_id: businessId, role: newRole })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleRemove(id, label) {
    if (!confirm(`Retirer ${label} de l'équipe ?`)) return
    try {
      await api.delete(`/api/v1/team/${id}?business_id=${businessId}`)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) {
    return (
      <Section title="Équipe" description="Invitez des collaborateurs et gérez leurs rôles.">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </Section>
    )
  }

  if (error && !data) {
    return (
      <Section title="Équipe" description="Invitez des collaborateurs et gérez leurs rôles.">
        <p className="text-sm text-danger">{error}</p>
      </Section>
    )
  }

  const rows = [
    ...(data.owner ? [{ ...data.owner, kind: 'owner' }] : []),
    ...data.members,
    ...data.invitations,
  ]

  return (
    <Section title="Équipe" description="Invitez des collaborateurs et gérez leurs rôles.">
      <div className="space-y-5">

        {/* Liste des membres */}
        <div className="divide-y divide-border -mt-2">
          {rows.map(row => {
            const label = row.email || 'Invité'
            const isOwnerRow = row.kind === 'owner'
            const isMember = row.kind === 'member'
            const displayName = [row.firstname, row.lastname].filter(Boolean).join(' ')
            return (
              <div key={row.id || 'owner'} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {displayName || label}
                  </p>
                  {displayName && <p className="text-xs text-text-secondary truncate">{label}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={row.status} expired={row.expired} />
                  {canManage && isMember ? (
                    <select
                      value={row.role}
                      onChange={e => handleRoleChange(row.id, e.target.value)}
                      className="h-8 px-2 rounded-lg border border-border text-xs text-text-primary bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/30"
                    >
                      {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{ROLE_LABELS[o.value]}</option>)}
                    </select>
                  ) : (
                    <Badge variant={isOwnerRow ? 'accent' : 'neutral'}>{ROLE_LABELS[row.role] || row.role}</Badge>
                  )}
                  {canManage && !isOwnerRow && (
                    <button
                      onClick={() => handleRemove(row.id, label)}
                      className="p-1.5 text-text-secondary hover:text-danger transition-colors"
                      title="Retirer"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Formulaire d'invitation — réservé aux gestionnaires */}
        {canManage ? (
          <form onSubmit={handleInvite} className="border-t border-border pt-5 space-y-3">
            <p className="text-sm font-medium text-text-primary flex items-center gap-1.5">
              <UserPlus size={15} className="text-accent" /> Inviter un collaborateur
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
              <Input
                type="email"
                value={email}
                onChange={e => { setInviteMsg(null); setEmail(e.target.value) }}
                placeholder="collaborateur@email.com"
                required
              />
              <div className="min-w-[160px]">
                <Select value={role} onChange={e => setRole(e.target.value)}>
                  {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{ROLE_LABELS[o.value]}</option>)}
                </Select>
              </div>
            </div>
            <p className="text-xs text-text-tertiary">{ROLE_OPTIONS.find(o => o.value === role)?.label}</p>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={inviting || !email.trim()}>
                <Mail size={15} /> {inviting ? 'Envoi…' : 'Envoyer l\'invitation'}
              </Button>
              {inviteMsg && (
                <span className={`flex items-center gap-1.5 text-sm ${inviteMsg.type === 'success' ? 'text-success' : 'text-danger'}`}>
                  {inviteMsg.type === 'success' && <Check size={14} />}
                  {inviteMsg.text}
                </span>
              )}
            </div>
          </form>
        ) : (
          <p className="text-xs text-text-secondary border-t border-border pt-4">
            Seuls le propriétaire et les administrateurs peuvent gérer l'équipe.
          </p>
        )}

        {error && data && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Section>
  )
}
