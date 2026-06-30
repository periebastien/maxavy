async function search(req, res) {
  const { q } = req.query
  if (!q || q.trim().length < 2) return res.json([])

  try {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q)}&type=establishment&language=fr&key=${process.env.GOOGLE_API_KEY}`
    const response = await fetch(url, {
      headers: { Referer: process.env.APP_URL || 'http://localhost:5173' }
    })
    const data = await response.json()

    const results = (data.results || []).slice(0, 6).map(p => ({
      place_id:      p.place_id,
      name:          p.name,
      address:       p.formatted_address,
      rating:        p.rating || null,
      total_ratings: p.user_ratings_total || 0,
    }))

    res.json(results)
  } catch {
    res.status(500).json({ message: 'Erreur recherche Google Places' })
  }
}

module.exports = { search }
