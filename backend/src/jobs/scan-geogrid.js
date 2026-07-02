const config = require('../modules/rank-tracking/rank-tracking.config')
const { runDueConfigs, refreshRunningScans, closeFinishedRuns, failStuckScans } = require('../modules/rank-tracking/scan.service')

// Boucle unique du geogrid (voir GEOGRID_DESIGN_FR.md §6). setInterval et non node-cron :
// un intervalle de 90 s n'est pas exprimable en cron (le champ secondes plafonne à 59).
// Garde anti-chevauchement : si un tick déborde son intervalle, on saute le suivant.
let ticking = false

async function tick() {
  if (ticking) {
    console.log('[cron][geogrid] tick précédent encore en cours → saut')
    return
  }
  ticking = true
  try {
    // 1) nettoyer les scans bloqués, 2) faire avancer ceux en cours, 3) clôturer les rapports terminés,
    // 4) lancer les nouveaux rapports dus (dans cet ordre pour ne pas re-scruter un run tout juste lancé)
    const stuck = await failStuckScans(config.scanTimeoutMinutes)
    const polled = await refreshRunningScans(config.concurrency)
    const closedRuns = await closeFinishedRuns()
    const launched = await runDueConfigs(config.batchSize, config.concurrency)

    if (launched.launched || launched.failed || polled.done || stuck.failed || closedRuns.closed) {
      console.log(
        `[cron][geogrid] rapports lancés=${launched.launched} ignorés=${launched.skipped} échoués=${launched.failed} ` +
        `| scans rafraîchis=${polled.refreshed} terminés=${polled.done} | rapports clôturés=${closedRuns.closed} | timeout=${stuck.failed}`
      )
    }
  } catch (err) {
    console.error('[cron][geogrid] erreur tick :', err.message)
  } finally {
    ticking = false
  }
}

function startScanGeogridJob() {
  setInterval(tick, config.tickSeconds * 1000)
  console.log(
    `[cron] Job geogrid démarré (tick ${config.tickSeconds}s, lot ${config.batchSize}, ` +
    `concurrence ${config.concurrency}, timeout ${config.scanTimeoutMinutes}min)`
  )
}

module.exports = { startScanGeogridJob }
