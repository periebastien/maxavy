import { useEffect } from 'react'

// Ferme un menu quand on clique en dehors de `ref`.
// `active` évite d'attacher l'écouteur quand le menu est déjà fermé.
export function useClickOutside(ref, handler, active = true) {
  useEffect(() => {
    if (!active) return
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) handler()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [ref, handler, active])
}
