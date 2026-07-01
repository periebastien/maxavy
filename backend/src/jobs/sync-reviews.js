const cron = require('node-cron')
const { syncAll } = require('../modules/reviews/reviews.service')

function startSyncReviewsJob() {
  // Tous les jours à 3h00
  cron.schedule('0 3 * * *', async () => {
    console.log('[cron] Sync avis Google démarré')
    try {
      const results = await syncAll()
      const ok  = results.filter(r => r.synced).length
      const err = results.filter(r => r.error).length
      console.log(`[cron] Sync avis terminé — ${ok} OK, ${err} erreurs`)
    } catch (err) {
      console.error('[cron] Sync avis erreur globale :', err.message)
    }
  })

  console.log('[cron] Job sync avis Google démarré (quotidien 3h)')
}

module.exports = { startSyncReviewsJob }
