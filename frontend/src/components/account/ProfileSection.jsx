import { useState, useEffect } from 'react'
import { Check } from 'lucide-react'
import Input from '../common/Input'
import Button from '../common/Button'
import EntityAvatar from '../common/EntityAvatar'
import { gravatarUrl } from '../../lib/gravatar'
import { useAuth } from '../../contexts/AuthContext'
import api from '../../lib/api'

export default function ProfileSection({ Section }) {
  const { user, setUser } = useAuth()
  const [avatarSrc, setAvatarSrc] = useState(null)
  const [form, setForm]       = useState({ firstname: '', lastname: '', phone: '' })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError]     = useState('')

  const isGoogleAvatar = user?.auth_provider === 'google' && !!user?.avatar_url

  useEffect(() => {
    if (!user) return
    setForm({
      firstname: user.firstname || '',
      lastname:  user.lastname  || '',
      phone:     user.phone     || '',
    })
    if (isGoogleAvatar) {
      setAvatarSrc(user.avatar_url)
    } else {
      gravatarUrl(user.email, 72).then(setAvatarSrc)
    }
  }, [user?.id, user?.avatar_url])

  const displayName = `${form.firstname || ''} ${form.lastname || ''}`.trim() || user?.email || 'Utilisateur'

  function set(field) {
    return e => { setSuccess(false); setForm(f => ({ ...f, [field]: e.target.value })) }
  }

  async function handleSave(e) {
    e.preventDefault()
    setLoading(true); setError(''); setSuccess(false)
    try {
      const updated = await api.patch('/api/v1/auth/me', {
        firstname: form.firstname.trim(),
        lastname:  form.lastname.trim(),
        phone:     form.phone.trim() || null,
      })
      setUser(updated)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  return (
    <Section title="Profil" description="Vos informations personnelles.">
      <div className="flex items-center gap-4 mb-6">
        <EntityAvatar name={displayName} src={avatarSrc} size={56} shape="circle" />
        <p className="text-xs text-text-secondary">
          {isGoogleAvatar
            ? 'Photo de profil fournie par votre compte Google.'
            : (
              <>
                Avatar fourni par{' '}
                <a href="https://gravatar.com" target="_blank" rel="noreferrer" className="text-accent hover:underline">
                  Gravatar
                </a>
                , associé à votre adresse email.
              </>
            )}
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <Input label="Email" value={user.email || ''} disabled readOnly className="bg-surface text-text-secondary cursor-not-allowed" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Prénom" value={form.firstname} onChange={set('firstname')} placeholder="Jean" />
          <Input label="Nom" value={form.lastname} onChange={set('lastname')} placeholder="Dupont" />
        </div>
        <Input label="Téléphone" type="tel" value={form.phone} onChange={set('phone')} placeholder="06 12 34 56 78" />

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" disabled={loading}>
            {loading ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
          {success && (
            <span className="flex items-center gap-1.5 text-sm text-success">
              <Check size={15} /> Modifications enregistrées
            </span>
          )}
        </div>
      </form>
    </Section>
  )
}
