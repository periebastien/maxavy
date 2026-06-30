import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Button from '../components/common/Button'
import Input from '../components/common/Input'
import api from '../lib/api'

export default function ResetPasswordPage() {
  const [searchParams]        = useSearchParams()
  const token                 = searchParams.get('token')
  const [password, setPass]   = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError]     = useState('')
  const [done, setDone]       = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate              = useNavigate()

  if (!token) {
    return (
      <div className="min-h-screen bg-bg-page flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-text-secondary text-sm">Lien invalide.</p>
          <Link to="/login" className="text-accent text-sm hover:underline">Retour à la connexion</Link>
        </div>
      </div>
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères')
      return
    }
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas')
      return
    }
    setError('')
    setLoading(true)
    try {
      await api.post('/api/v1/auth/reset-password', { token, password })
      setDone(true)
      setTimeout(() => navigate('/login'), 3000)
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
          <h1 className="text-xl font-bold text-text-primary">Nouveau mot de passe</h1>
          <p className="text-text-secondary text-sm mt-1">Choisissez un mot de passe sécurisé</p>
        </div>

        <div className="bg-white border border-border rounded-xl p-6 shadow-sm">
          {done ? (
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center mx-auto">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <p className="text-sm font-medium text-text-primary">Mot de passe mis à jour !</p>
              <p className="text-xs text-text-secondary">Redirection vers la connexion…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Nouveau mot de passe"
                type="password"
                value={password}
                onChange={e => setPass(e.target.value)}
                placeholder="8 caractères minimum"
                autoComplete="new-password"
                required
              />
              <Input
                label="Confirmer le mot de passe"
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                required
              />
              {error && (
                <div className="text-sm text-danger bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full justify-center" disabled={loading}>
                {loading ? 'Enregistrement...' : 'Enregistrer le mot de passe'}
              </Button>
            </form>
          )}
        </div>

        {!done && (
          <p className="text-center text-sm text-text-secondary mt-6">
            <Link to="/login" className="text-accent font-medium hover:underline">
              ← Retour à la connexion
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
