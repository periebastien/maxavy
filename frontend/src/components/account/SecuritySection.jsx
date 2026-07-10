import { useState } from 'react'
import { Check, ShieldCheck } from 'lucide-react'
import Input from '../common/Input'
import Button from '../common/Button'
import { useAuth } from '../../contexts/AuthContext'
import api from '../../lib/api'

export default function SecuritySection({ Section }) {
  const { user } = useAuth()
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const isGoogleOnly = user?.auth_provider === 'google'

  function set(field) {
    return e => {
      setSuccess(false)
      setErrors(errs => ({ ...errs, [field]: '', form: '' }))
      setForm(f => ({ ...f, [field]: e.target.value }))
    }
  }

  function validate() {
    const errs = {}
    if (!form.current_password) errs.current_password = 'Mot de passe actuel requis.'
    if (form.new_password.length < 8) errs.new_password = 'Le nouveau mot de passe doit contenir au moins 8 caractères.'
    if (form.new_password && form.new_password === form.current_password) {
      errs.new_password = 'Le nouveau mot de passe doit être différent de l\'actuel.'
    }
    if (form.confirm_password !== form.new_password) errs.confirm_password = 'La confirmation ne correspond pas.'
    return errs
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setLoading(true); setSuccess(false)
    try {
      await api.put('/api/v1/auth/me/password', {
        current_password: form.current_password,
        new_password:      form.new_password,
      })
      setForm({ current_password: '', new_password: '', confirm_password: '' })
      setSuccess(true)
      setTimeout(() => setSuccess(false), 4000)
    } catch (err) {
      if (err.status === 401) {
        setErrors({ current_password: 'Mot de passe actuel incorrect.' })
      } else {
        setErrors({ form: err.message })
      }
    } finally {
      setLoading(false)
    }
  }

  if (isGoogleOnly) {
    return (
      <Section title="Sécurité" description="Gestion du mot de passe.">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-surface border border-border">
          <div className="w-9 h-9 bg-accent-light rounded-lg flex items-center justify-center shrink-0">
            <ShieldCheck size={17} className="text-accent" />
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">Connexion gérée par Google</p>
            <p className="text-xs text-text-secondary">Votre compte est connecté via Google, aucun mot de passe local n'est requis.</p>
          </div>
        </div>
      </Section>
    )
  }

  return (
    <Section title="Sécurité" description="Modifiez votre mot de passe.">
      <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
        <Input
          label="Mot de passe actuel"
          type="password"
          value={form.current_password}
          onChange={set('current_password')}
          error={errors.current_password}
          autoComplete="current-password"
        />
        <Input
          label="Nouveau mot de passe"
          type="password"
          value={form.new_password}
          onChange={set('new_password')}
          error={errors.new_password}
          autoComplete="new-password"
        />
        <Input
          label="Confirmer le nouveau mot de passe"
          type="password"
          value={form.confirm_password}
          onChange={set('confirm_password')}
          error={errors.confirm_password}
          autoComplete="new-password"
        />

        {errors.form && <p className="text-sm text-danger">{errors.form}</p>}

        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" disabled={loading}>
            {loading ? 'Modification…' : 'Changer le mot de passe'}
          </Button>
          {success && (
            <span className="flex items-center gap-1.5 text-sm text-success">
              <Check size={15} /> Mot de passe modifié
            </span>
          )}
        </div>
      </form>
    </Section>
  )
}
