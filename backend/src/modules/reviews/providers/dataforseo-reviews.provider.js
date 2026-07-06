// Provider DataForSEO — Business Data / Google Reviews (asynchrone, task_post → tasks_ready → task_get).
// Remplace l'API GMB (quota bloqué) pour la LECTURE des avis. Endpoint DISTINCT du geogrid
// (serp/google/maps) : son `tasks_ready` ne renvoie que les tâches d'avis → aucune collision de poll.
// 1 tâche = 1 localisation (identifiée par son place_id Google). Voir docs.dataforseo.com/v3/business_data-google-reviews.
// NB : DataForSEO est en LECTURE SEULE — il ne publie pas de réponse aux avis sur Google.

const BASE_URL = 'https://api.dataforseo.com/v3/business_data/google/reviews'
const REQUEST_TIMEOUT_MS = 20000

const { schedule } = require('../../../services/dataforseo-gate')

function authHeader() {
  const login = process.env.DATAFORSEO_LOGIN
  const password = process.env.DATAFORSEO_PASSWORD
  if (!login || !password) throw { status: 500, message: 'DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD manquants' }
  return `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`
}

async function request(path, options = {}) {
  // Portail global partagé (geogrid + avis) : borne les requêtes simultanées et le débit/min vers DataForSEO.
  const kind = path.includes('tasks_ready') ? 'tasks_ready' : 'default'
  let res
  try {
    res = await schedule(() => fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: authHeader(), ...(options.headers || {}) },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }), kind)
  } catch (err) {
    throw { status: 502, message: `DataForSEO injoignable : ${err.message}` }
  }
  const data = await res.json()
  if (data.status_code !== 20000) {
    throw { status: 502, message: `DataForSEO : ${data.status_message || 'erreur inconnue'}` }
  }
  return data
}

// Soumet une tâche d'avis pour une fiche. `tag` = review_sync_job.id (corrélation au retour via tasks_ready).
// Facturation par tranche de 10 avis (`depth`), donc depth multiple de 10. priority 1 = standard (~45 min,
// $0.00075/10 avis), 2 = priority (~1 min, ×2). Retourne { taskId, ok, statusMessage, cost }.
async function submitTask({ tag, placeId, keyword, lat, lng, depth, sortBy = 'newest', priority = 1, languageCode = 'fr' }) {
  const entry = { tag, priority, depth, sort_by: sortBy, language_code: languageCode }
  if (placeId) entry.place_id = placeId
  else if (keyword) entry.keyword = keyword
  else throw { status: 400, message: 'place_id ou keyword requis pour la tâche DataForSEO' }
  // DataForSEO exige un champ de localisation MÊME avec place_id (la doc dit l'inverse à tort → 40501
  // « Invalid Field: location_name » sinon). On passe les coordonnées de la fiche : universel, pas de
  // mapping pays à maintenir. Vérifié en réel (task_post → 20100 Task Created).
  if (lat != null && lng != null) entry.location_coordinate = `${lat},${lng}`

  const data = await request('/task_post', { method: 'POST', body: JSON.stringify([entry]) })
  const task = data.tasks?.[0]
  return {
    taskId: task?.id || null,
    ok: task?.status_code === 20100,
    statusMessage: task?.status_message,
    cost: task?.cost || 0,
  }
}

// Tâches d'avis prêtes côté DataForSEO (propre à cet endpoint). Corrélation par `tag` (= job.id).
async function getReadyTaskIds() {
  const data = await request('/tasks_ready')
  const items = data.tasks?.[0]?.result || []
  return items.map(it => ({ taskId: it.id, tag: it.tag }))
}

// Résultat d'une tâche prête. null si pas encore disponible (défensif — on filtre via getReadyTaskIds avant).
// Mapping des champs d'avis → modèle Review (voir reviews.service upsert).
async function getTaskResult(taskId) {
  const data = await request(`/task_get/${taskId}`)
  const task = data.tasks?.[0]
  if (!task || task.status_code !== 20000) return null
  const result = task.result?.[0]
  if (!result) return null
  const items = (result.items || []).map(it => ({
    reviewId:       it.review_id,
    authorName:     it.profile_name || null,
    authorImageUrl: it.profile_image_url || null,
    rating:         it.rating?.value ?? null,
    text:           it.review_text || null,
    publishedAt:    it.timestamp || null,       // UTC
    ownerAnswer:    it.owner_answer || null,
    ownerTimestamp: it.owner_timestamp || null, // UTC
  }))
  return { items, reviewsCount: result.reviews_count ?? items.length }
}

module.exports = { submitTask, getReadyTaskIds, getTaskResult }
