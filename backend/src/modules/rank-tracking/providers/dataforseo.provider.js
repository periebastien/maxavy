// Provider DataForSEO — Google Maps SERP API (queue Priority, asynchrone).
// task_post accepte jusqu'à 100 tâches/appel ; tasks_ready liste les tâches prêtes (corrélées par `tag`,
// on y met l'id du geogrid_point) ; task_get/advanced/{id} renvoie le classement local réel (Local Finder).
// Voir GEOGRID_DESIGN_FR.md §3. Aucun proxy à gérer ici — DataForSEO s'en charge.

const BASE_URL = 'https://api.dataforseo.com/v3/serp/google/maps'
const MAX_TASKS_PER_CALL = 100
const REQUEST_TIMEOUT_MS = 20000
// Priority queue (vs Standard) : ~1 min de délai moyen au lieu de ~5 min, $0.0012/tâche au lieu de $0.0006
// (vérifié en réel 2026-07-01). Choisi pour fiabiliser le cron de poll (G3) — résultats prêts plus vite
// et de façon plus prévisible, ce qui réduit le temps où des tâches s'accumulent dans tasks_ready
// (plafonné à 1000 chez DataForSEO).
const TASK_PRIORITY = 2

function authHeader() {
  const login = process.env.DATAFORSEO_LOGIN
  const password = process.env.DATAFORSEO_PASSWORD
  if (!login || !password) throw { status: 500, message: 'DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD manquants' }
  return `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`
}

async function request(path, options = {}) {
  let res
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: authHeader(), ...(options.headers || {}) },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (err) {
    throw { status: 502, message: `DataForSEO injoignable : ${err.message}` }
  }
  const data = await res.json()
  if (data.status_code !== 20000) {
    throw { status: 502, message: `DataForSEO : ${data.status_message || 'erreur inconnue'}` }
  }
  return data
}

// tasks: [{ tag, keyword, lat, lng, zoom? }] — tag = notre geogrid_point.id, pour corréler la réponse.
// Retourne [{ tag, taskId, ok, statusMessage, cost }] — ok=false pour une tâche individuellement rejetée
// (le point restera sans provider_task_id, il ne sera simplement jamais résolu).
async function submitTasks(tasks) {
  const chunks = []
  for (let i = 0; i < tasks.length; i += MAX_TASKS_PER_CALL) chunks.push(tasks.slice(i, i + MAX_TASKS_PER_CALL))

  const submitted = []
  for (const chunk of chunks) {
    const payload = chunk.map(t => ({
      tag: t.tag,
      priority: TASK_PRIORITY,
      keyword: t.keyword,
      location_coordinate: `${t.lat},${t.lng},${t.zoom || 14}z`,
      language_code: t.languageCode || 'fr',
      device: 'desktop',
      os: 'windows',
      depth: 20,
    }))
    const data = await request('/task_post', { method: 'POST', body: JSON.stringify(payload) })
    for (const task of data.tasks || []) {
      submitted.push({
        tag: task.data?.tag,
        taskId: task.id,
        ok: task.status_code === 20100,
        statusMessage: task.status_message,
        cost: task.cost || 0,
      })
    }
  }
  return submitted
}

// Liste des tâches prêtes côté DataForSEO (globale au compte, scoping fait par l'appelant via provider_task_id/tag).
async function getReadyTaskIds() {
  const data = await request('/tasks_ready')
  const items = data.tasks?.[0]?.result || []
  return items.map(it => ({ taskId: it.id, tag: it.tag }))
}

// Résultat d'une tâche prête. Retourne null si pas encore disponible (ne devrait pas arriver si on a
// filtré via getReadyTaskIds() avant, mais reste défensif).
async function getTaskResult(taskId) {
  const data = await request(`/task_get/advanced/${taskId}`)
  const task = data.tasks?.[0]
  if (!task || task.status_code !== 20000) return null
  const result = task.result?.[0]
  if (!result) return null
  return {
    items: (result.items || []).map(it => ({
      placeId: it.place_id,
      rank: it.rank_absolute,
      name: it.title,
      rating: it.rating?.value ?? null,
      reviewCount: it.rating?.votes_count ?? null,
    })),
  }
}

module.exports = { submitTasks, getReadyTaskIds, getTaskResult }
