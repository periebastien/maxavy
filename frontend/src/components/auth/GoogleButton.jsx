import { GoogleLogin } from '@react-oauth/google'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export default function GoogleButton({ onError }) {
  const { loginWithGoogle } = useAuth()
  const navigate = useNavigate()

  async function handleSuccess(credentialResponse) {
    try {
      await loginWithGoogle(credentialResponse.credential)
      navigate('/dashboard')
    } catch (err) {
      onError?.(err.message)
    }
  }

  return (
    <div className="flex justify-center">
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={() => onError?.('Connexion Google annulée')}
        theme="outline"
        size="large"
        text="continue_with"
        shape="rectangular"
        width="368"
      />
    </div>
  )
}
