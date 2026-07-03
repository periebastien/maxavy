// Paramètres de cadence du cron geogrid (G3) + résilience (retry/étalement/circuit-breaker).
// Réglables via .env — si une variable manque ou est invalide, on retombe sur le défaut ci-dessous
// (l'app tourne quand même). Voir GEOGRID_DESIGN_FR.md §6, GEOGRID_REFONTE_FR.md §7 et .env.example.

function posInt(name, def) {
  const v = parseInt(process.env[name], 10)
  return Number.isInteger(v) && v > 0 ? v : def
}

// Liste d'entiers positifs "10,30,90" → [10,30,90]. Vide/invalide → défaut. Sert aux paliers de backoff.
function posIntList(name, def) {
  const raw = process.env[name]
  if (!raw) return def
  const parts = raw.split(',').map(s => parseInt(s.trim(), 10)).filter(n => Number.isInteger(n) && n > 0)
  return parts.length ? parts : def
}

module.exports = {
  tickSeconds: posInt('GEOGRID_TICK_SECONDS', 90),         // fréquence de la boucle (poll + lancement)
  batchSize: posInt('GEOGRID_BATCH_SIZE', 20),             // mots-clés/reprises dus traités par tick au maximum
  concurrency: posInt('GEOGRID_CONCURRENCY', 20),          // scans lancés/rafraîchis en parallèle au maximum
  scanTimeoutMinutes: posInt('GEOGRID_SCAN_TIMEOUT_MINUTES', 15), // au-delà, un scan non terminé → échec ou reprise

  // ── Résilience (GEOGRID_REFONTE_FR.md §7) ──
  maxScanAttempts: posInt('GEOGRID_MAX_SCAN_ATTEMPTS', 3),        // reprises max d'un scan (Level A) avant échec définitif
  maxRunAttempts: posInt('GEOGRID_MAX_RUN_ATTEMPTS', 2),          // reprises max d'un run entier (Level C)
  scanBackoffMinutes: posIntList('GEOGRID_RETRY_BACKOFF_SCAN', [10, 30, 90]), // paliers de backoff scan
  runBackoffMinutes: posIntList('GEOGRID_RETRY_BACKOFF_RUN', [30, 120]),      // paliers de backoff run
  retryJitterMinutes: posInt('GEOGRID_RETRY_JITTER_MINUTES', 5),  // fenêtre de jitter déterministe anti-rafale
  recoveryWindowMinutes: posInt('GEOGRID_RECOVERY_WINDOW_MINUTES', 360), // durée max de re-poll gratuit d'un scan partiel (Level B)
  maxPointsInFlight: posInt('GEOGRID_MAX_POINTS_IN_FLIGHT', 800), // plafond global de points non résolus (protège les 1000 de tasks_ready)
  breakerThreshold: posInt('GEOGRID_BREAKER_THRESHOLD', 10),      // échecs transport consécutifs → circuit ouvert
  breakerCooldownMinutes: posInt('GEOGRID_BREAKER_COOLDOWN_MINUTES', 10), // durée de pause quand le circuit est ouvert
}
