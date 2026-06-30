import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Button from '../components/common/Button'
import Input from '../components/common/Input'
import GoogleButton from '../components/auth/GoogleButton'

export default function RegisterPage() {
  const [form, setForm]       = useState({ firstname: '', lastname: '', email: '', password: '' })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const { register, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  if (isAuthenticated) {
    navigate('/dashboard', { replace: true })
    return null
  }

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (form.password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères')
      return
    }
    setError('')
    setLoading(true)
    try {
      await register(form)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-page flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-accent rounded-xl mb-3">
            <span className="text-white font-bold text-lg">L</span>
          </div>
          <h1 className="text-xl font-bold text-text-primary">Locagain</h1>
          <p className="text-text-secondary text-sm mt-1">Créez votre compte</p>
        </div>

        <div className="bg-white border border-border rounded-xl p-6 shadow-sm space-y-4">
          <GoogleButton onError={setError} />

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-text-tertiary">ou</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Prénom"
                type="text"
                value={form.firstname}
                onChange={set('firstname')}
                placeholder="Jean"
                required
              />
              <Input
                label="Nom"
                type="text"
                value={form.lastname}
                onChange={set('lastname')}
                placeholder="Dupont"
                required
              />
            </div>
            <Input
              label="Adresse email"
              type="email"
              value={form.email}
              onChange={set('email')}
              placeholder="vous@exemple.com"
              autoComplete="email"
              required
            />
            <Input
              label="Mot de passe"
              type="password"
              value={form.password}
              onChange={set('password')}
              placeholder="8 caractères minimum"
              autoComplete="new-password"
              required
            />

            {error && (
              <div className="text-sm text-danger bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full justify-center" disabled={loading}>
              {loading ? 'Création...' : 'Créer mon compte'}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-text-secondary mt-6">
          Déjà un compte ?{' '}
          <Link to="/login" className="text-accent font-medium hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  )
}
