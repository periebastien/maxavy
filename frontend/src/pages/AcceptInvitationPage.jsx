import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Button from '../components/common/Button'
import Input from '../components/common/Input'
import api from '../lib/api'

const ROLE_LABELS = { admin: 'Administrateur', editor: 'Éditeur', viewer: 'Lecteur' }

export default function AcceptInvitationPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [preview, setPreview]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [loadError, setLoadError] = useState('')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [firstname, setFirstname] = useState('')
  const [lastname, setLastname]   = useState('')
  const [error, setError]       = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) { setLoading(false); setLoadError('Lien invalide.'); return }
    api.get(`/api/v1/team/invite/preview?token=${encodeURIComponent(token)}`)
      .then(setPreview)
      .catch(err => setLoadError(err.message))
      .finally(() => setLoading(false))
  }, [token])

  const isLoggedIn = !!localStorage.getItem('token')

  async function handleAccept(e) {
    e?.preventDefault()
    setError('')
    if (preview.needs_account) {
      if (password.length < 8) { setError('Le mot de passe doit contenir au moins 8 caractères'); return }
      if (password !== confirm) { setError('Les mots de passe ne correspondent pas'); return }
    }
    setSubmitting(true)
    try {
      const body = { token }
      if (preview.needs_account) Object.assign(body, { password, firstname, lastname })
      const res = await api.post('/api/v1/team/accept', body)
      // Connexion : on stocke le token renvoyé et on recharge pour réhydrater tous les contextes.
      if (res.token) {
        localStorage.setItem('token', res.token)
        if (res.business_id) localStorage.setItem('active_business_id', res.business_id)
      }
      window.location.href = '/dashboard'
    } catch (err) {
      // Compte existant mais non connecté → on l'oriente vers la connexion.
      if (err.status === 409) {
        setError('Un compte existe déjà pour cet email. Connectez-vous, puis rouvrez ce lien pour accepter.')
      } else {
        setError(err.message)
      }
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-page flex items-center justify-center p-4">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-bg-page flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-text-secondary text-sm mb-2">{loadError}</p>
          <Link to="/login" className="text-accent text-sm hover:underline">Retour à la connexion</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-page flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-accent rounded-xl mb-3">
            <span className="text-white font-bold text-lg">L</span>
          </div>
          <h1 className="text-xl font-bold text-text-primary">Rejoindre {preview.business_name}</h1>
          <p className="text-text-secondary text-sm mt-1">
            Invitation en tant que <strong>{ROLE_LABELS[preview.role] || preview.role}</strong>
          </p>
          <p className="text-text-tertiary text-xs mt-1">{preview.email}</p>
        </div>

        <div className="bg-white border border-border rounded-xl p-6 shadow-sm">
          <form onSubmit={handleAccept} className="space-y-4">
            {preview.needs_account ? (
              <>
                <p className="text-sm text-text-secondary">Créez votre compte pour rejoindre l'équipe.</p>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Prénom" value={firstname} onChange={e => setFirstname(e.target.value)} placeholder="Prénom" />
                  <Input label="Nom" value={lastname} onChange={e => setLastname(e.target.value)} placeholder="Nom" />
                </div>
                <Input
                  label="Mot de passe"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
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
              </>
            ) : (
              <p className="text-sm text-text-secondary">
                {isLoggedIn
                  ? 'Cliquez pour accepter l\'invitation avec votre compte connecté.'
                  : 'Un compte existe déjà pour cet email. Connectez-vous d\'abord, puis rouvrez ce lien.'}
              </p>
            )}

            {error && (
              <div className="text-sm text-danger bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            {preview.needs_account || isLoggedIn ? (
              <Button type="submit" className="w-full justify-center" disabled={submitting}>
                {submitting ? 'Traitement…' : 'Accepter l\'invitation'}
              </Button>
            ) : (
              <Link to={`/login?next=${encodeURIComponent(`/invitation?token=${token}`)}`}>
                <Button type="button" className="w-full justify-center">Se connecter</Button>
              </Link>
            )}
          </form>
        </div>

        <p className="text-center text-sm text-text-secondary mt-6">
          <Link to="/login" className="text-accent font-medium hover:underline">← Retour à la connexion</Link>
        </p>
      </div>
    </div>
  )
}
