// Paramètres de cadence du cron geogrid (G3). Réglables via .env — si une variable manque
// ou est invalide, on retombe sur le défaut ci-dessous (l'app tourne quand même).
// Voir GEOGRID_DESIGN_FR.md §6 et .env.example.

function posInt(name, def) {
  const v = parseInt(process.env[name], 10)
  return Number.isInteger(v) && v > 0 ? v : def
}

module.exports = {
  tickSeconds: posInt('GEOGRID_TICK_SECONDS', 90),         // fréquence de la boucle (poll + lancement)
  batchSize: posInt('GEOGRID_BATCH_SIZE', 20),             // mots-clés dus traités par tick au maximum
  concurrency: posInt('GEOGRID_CONCURRENCY', 20),          // scans lancés/rafraîchis en parallèle au maximum
  scanTimeoutMinutes: posInt('GEOGRID_SCAN_TIMEOUT_MINUTES', 15), // au-delà, un scan non terminé → failed
}
