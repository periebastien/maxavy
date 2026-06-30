// Lien de dépôt d'avis Google pour une fiche (place_id).
// Ouvre directement la boîte de dialogue « écrire un avis » sur Google.
export function googleReviewUrl(placeId) {
  if (!placeId) return null
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`
}
