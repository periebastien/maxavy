const config = require('../modules/reviews/reviews.config')
const {
  failStuckJobs, pollRunningJobs, enqueueDueLocations,
  reconcileCompetitorTracking, enqueueDueCompetitors,
} = require('../modules/reviews/reviews.service')

// Synchro des avis via DataForSEO (remplace l'API GMB). Boucle unique setInterval, même schéma que le cron
// geogrid : la cadence par fiche vient du plan (module_quotas.reviews.interval_minutes), le tick ne fait que
// (1) nettoyer les jobs bloqués, (2) ramasser les tâches prêtes, (3) enqueue les fiches dues (étalées).
// pollRunningJobs et enqueueDueLocations ne touchent le réseau que s'il y a du travail → quasi gratuit à vide.
let ticking = false

async function tick() {
  if (ticking) {
    console.log('[cron][reviews] tick précédent encore en cours → saut')
    return
  }
  ticking = true
  try {
    const stuck = await failStuckJobs(config.syncTimeoutMinutes)
    const polled = await pollRunningJobs(config.concurrency)
    const enqueued = await enqueueDueLocations(config.batchSize)
    // Concurrents (module « Suivi des avis de la concurrence ») — réconciliation AVANT enqueue pour que
    // l'ajout d'un concurrent parte en backfill dès ce tick (AVIS_CONCURRENTS_FR.md §4). Poll déjà unifié
    // ci-dessus (pollRunningJobs traite les deux types de jobs).
    const reconciled = await reconcileCompetitorTracking()
    const enqueuedCompetitors = await enqueueDueCompetitors(config.batchSize)

    if (enqueued.enqueued || enqueued.failed || polled.done || stuck.failed
        || reconciled.created || reconciled.removed || enqueuedCompetitors.enqueued || enqueuedCompetitors.failed) {
      console.log(
        `[cron][reviews] fiches enqueue=${enqueued.enqueued} ignorées=${enqueued.skipped} échouées=${enqueued.failed} ` +
        `| jobs rafraîchis=${polled.polled} terminés=${polled.done} | timeout=${stuck.failed} ` +
        `| concurrents +${reconciled.created}/-${reconciled.removed} enqueue=${enqueuedCompetitors.enqueued} ` +
        `ignorés=${enqueuedCompetitors.skipped} échoués=${enqueuedCompetitors.failed}`
      )
    }
  } catch (err) {
    console.error('[cron][reviews] erreur tick :', err.message)
  } finally {
    ticking = false
  }
}

function startSyncReviewsJob() {
  setInterval(tick, config.tickSeconds * 1000)
  console.log(
    `[cron] Job sync avis (DataForSEO) démarré (tick ${config.tickSeconds}s, lot ${config.batchSize}, ` +
    `concurrence ${config.concurrency}, timeout ${config.syncTimeoutMinutes}min)`
  )
}

module.exports = { startSyncReviewsJob }
