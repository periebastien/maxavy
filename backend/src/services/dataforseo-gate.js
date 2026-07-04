// Portail global partagé pour TOUS les appels HTTP DataForSEO — crons geogrid ET avis, même compte donc
// mêmes limites. Borne (1) les requêtes SIMULTANÉES (sémaphore, évite les rafales qui font timeouter) et
// (2) le débit par minute (fenêtre glissante, sous les 2000/min du compte), avec un sous-plafond dédié à
// `tasks_ready` (limite serrée côté DataForSEO). Singleton : l'état au niveau module est partagé par les
// deux providers dans le même process → la charge combinée reste bornée. Sans dépendance externe.
// Réglages : DATAFORSEO_MAX_CONCURRENCY / DATAFORSEO_MAX_PER_MINUTE / DATAFORSEO_TASKS_READY_PER_MINUTE.

function posInt(name, def) {
  const v = parseInt(process.env[name], 10)
  return Number.isInteger(v) && v > 0 ? v : def
}

const MAX_CONCURRENT = posInt('DATAFORSEO_MAX_CONCURRENCY', 12)
const MAX_PER_MIN = posInt('DATAFORSEO_MAX_PER_MINUTE', 1500)
const TASKS_READY_PER_MIN = posInt('DATAFORSEO_TASKS_READY_PER_MINUTE', 50)
const WINDOW_MS = 60 * 1000

let active = 0
const queue = []            // { kind, resolve } en attente d'un créneau, FIFO
const starts = []           // timestamps de démarrage (< 60 s) — tous appels confondus
const tasksReadyStarts = [] // idem, uniquement kind='tasks_ready'
let timer = null

function prune(arr, now) { while (arr.length && now - arr[0] >= WINDOW_MS) arr.shift() }

// Délai (ms) avant qu'un créneau de DÉBIT se libère pour `kind` (0 = tout de suite).
function rateDelay(kind, now) {
  prune(starts, now); prune(tasksReadyStarts, now)
  let d = 0
  if (starts.length >= MAX_PER_MIN) d = Math.max(d, WINDOW_MS - (now - starts[0]))
  if (kind === 'tasks_ready' && tasksReadyStarts.length >= TASKS_READY_PER_MIN) {
    d = Math.max(d, WINDOW_MS - (now - tasksReadyStarts[0]))
  }
  return d
}

// Démarre autant de requêtes en attente que les créneaux (concurrence + débit) le permettent.
function pump() {
  if (timer) { clearTimeout(timer); timer = null }
  while (queue.length && active < MAX_CONCURRENT) {
    const now = Date.now()
    const delay = rateDelay(queue[0].kind, now)
    if (delay > 0) { timer = setTimeout(pump, delay + 5); return } // débit atteint → replanifier
    const { kind, resolve } = queue.shift()
    active++
    starts.push(now)
    if (kind === 'tasks_ready') tasksReadyStarts.push(now)
    resolve()
  }
}

function acquire(kind) {
  return new Promise(resolve => { queue.push({ kind, resolve }); pump() })
}

// Exécute fn() sous le portail. `kind` = 'tasks_ready' | 'default'. Le créneau est libéré quoi qu'il arrive
// (succès OU échec) → un timeout ne bloque jamais le portail. fn() doit créer le fetch (et son AbortSignal)
// À L'INTÉRIEUR pour que le timeout ne compte que l'exécution réelle, pas l'attente en file.
async function schedule(fn, kind = 'default') {
  await acquire(kind)
  try { return await fn() }
  finally { active--; pump() }
}

// Exposé pour les tests / le monitoring.
function stats() {
  const now = Date.now()
  prune(starts, now); prune(tasksReadyStarts, now)
  return { active, queued: queue.length, lastMinute: starts.length, lastMinuteTasksReady: tasksReadyStarts.length }
}

module.exports = { schedule, stats, limits: { MAX_CONCURRENT, MAX_PER_MIN, TASKS_READY_PER_MIN } }
