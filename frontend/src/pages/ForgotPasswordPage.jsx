import { useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../components/common/Button'
import Input from '../components/common/Input'
import api from '../lib/api'

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState('')
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/api/v1/auth/forgot-password', { email })
      setSent(true)
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
          <h1 className="text-xl font-bold text-text-primary">Mot de passe oublié</h1>
          <p className="text-text-secondary text-sm mt-1">
            Entrez votre email pour recevoir un lien de réinitialisation
          </p>
        </div>

        <div className="bg-white border border-border rounded-xl p-6 shadow-sm">
          {sent ? (
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center mx-auto">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
                </svg>
              </div>
              <p className="text-sm font-medium text-text-primary">Email envoyé !</p>
              <p className="text-xs text-text-secondary">
                Si un compte existe avec <strong>{email}</strong>, vous recevrez un lien valable 1 heure.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Adresse email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                autoComplete="email"
                required
              />
              {error && (
                <div className="text-sm text-danger bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full justify-center" disabled={loading}>
                {loading ? 'Envoi...' : 'Envoyer le lien'}
              </Button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-text-secondary mt-6">
          <Link to="/login" className="text-accent font-medium hover:underline">
            ← Retour à la connexion
          </Link>
        </p>
      </div>
    </div>
  )
}
