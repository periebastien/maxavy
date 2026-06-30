import { useState, useEffect } from 'react'

// Avatar d'entité (entreprise ou localisation) :
// - affiche `src` (favicon/logo) s'il est fourni et se charge sans erreur,
// - sinon retombe sur l'initiale du nom dans une pastille violet pâle.
// `shape` : 'rounded' (carré arrondi, défaut) ou 'circle'.
export default function EntityAvatar({ name = '', src = null, size = 32, shape = 'rounded', className = '' }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => { setFailed(false) }, [src])

  const radius  = shape === 'circle' ? 'rounded-full' : 'rounded-lg'
  const style   = { width: size, height: size }
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?'

  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        onError={() => setFailed(true)}
        style={style}
        className={`${radius} object-contain bg-white border border-border shrink-0 ${className}`}
      />
    )
  }
  return (
    <div
      style={style}
      className={`${radius} bg-accent-light flex items-center justify-center text-accent font-bold shrink-0 ${className}`}
    >
      <span style={{ fontSize: Math.round(size * 0.42) }}>{initial}</span>
    </div>
  )
}
