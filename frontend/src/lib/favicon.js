// Dérive l'URL du favicon d'un site web — sert de logo pour une entreprise ou une localisation.
// Renvoie null si l'URL est absente/invalide → le composant <EntityAvatar> retombe alors sur l'initiale.
// Service : Google s2 favicons (fiable, gratuit, pas de clé). En prod : autoriser ce domaine dans la CSP (img-src).
export function faviconUrl(websiteUrl, size = 64) {
  if (!websiteUrl) return null
  try {
    const normalized = /^https?:\/\//i.test(websiteUrl) ? websiteUrl : `https://${websiteUrl}`
    const { hostname } = new URL(normalized)
    if (!hostname) return null
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=${size}`
  } catch {
    return null
  }
}
