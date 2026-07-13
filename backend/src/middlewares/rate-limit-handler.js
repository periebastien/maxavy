// Handler JSON partagé pour express-rate-limit — la réponse par défaut est du texte brut, que le front
// tente de parser en JSON (res.json()) → "Unexpected token... is not valid JSON" au lieu d'un message lisible.
function jsonRateLimitHandler(req, res) {
  res.status(429).json({ message: 'Trop de requêtes, réessayez dans quelques minutes.' })
}

module.exports = { jsonRateLimitHandler }
