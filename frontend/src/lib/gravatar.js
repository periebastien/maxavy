// Calcule l'URL Gravatar d'un email via SHA-256 (Web Crypto — pas de dépendance).
// d=404 : Gravatar renvoie 404 si aucun avatar → EntityAvatar retombe sur l'initiale.
export async function gravatarUrl(email, size = 56) {
  if (!email) return null
  try {
    const normalized = email.trim().toLowerCase()
    const buf  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized))
    const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
    return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=404`
  } catch {
    return null
  }
}
