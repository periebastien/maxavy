// Paramètres de la synchro d'avis DataForSEO (cron sync-reviews). Réglables via .env — valeur invalide
// → repli sur le défaut. La CADENCE (fréquence par fiche) n'est PAS ici : elle vient du plan
// (module_quotas.reviews.interval_minutes). Ici, seuls les réglages techniques.

function posInt(name, def) {
  const v = parseInt(process.env[name], 10)
  return Number.isInteger(v) && v > 0 ? v : def
}

module.exports = {
  tickSeconds: posInt('REVIEWS_TICK_SECONDS', 60),            // fréquence de la boucle (poll + enqueue des dues)
  batchSize: posInt('REVIEWS_BATCH_SIZE', 20),               // fiches dues enqueue par tick au maximum (étalement)
  concurrency: posInt('REVIEWS_CONCURRENCY', 10),            // jobs soumis/rafraîchis en parallèle au maximum
  syncTimeoutMinutes: posInt('REVIEWS_SYNC_TIMEOUT_MINUTES', 90), // > 45 min (délai max de la file standard)
  // ⚠️ DataForSEO facture sur le depth DEMANDÉ (par tranche de 10), pas sur les avis réellement retournés.
  // Incrémental à 10 = $0.00075/synchro (standard). Backfill à 200 = $0.015 one-shot/fiche (couvre les 200
  // avis les plus récents via sort_by=newest ; monter REVIEWS_BACKFILL_DEPTH si besoin de plus d'historique).
  syncDepth: posInt('REVIEWS_SYNC_DEPTH', 10),              // avis récupérés en incrémental (sort_by=newest)
  backfillDepth: posInt('REVIEWS_BACKFILL_DEPTH', 200),     // avis au 1er passage (historique), une seule fois
  sortBy: process.env.REVIEWS_SORT_BY || 'newest',
  // File standard par défaut (~45 min, $0.00075/10 avis) ; 'priority' = ~1 min, ×2 (utile si cadence < 45 min)
  priority: (process.env.REVIEWS_QUEUE || 'standard') === 'priority' ? 2 : 1,
  // Cadence de synchro des avis CONCURRENTS (module « Suivi des avis de la concurrence ») — fixe pour
  // tous les plans, indépendante de `module_quotas.reviews.interval_minutes` (AVIS_CONCURRENTS_FR.md §2.4).
  competitorIntervalMinutes: posInt('REVIEWS_COMPETITOR_INTERVAL_MINUTES', 1440),
}
