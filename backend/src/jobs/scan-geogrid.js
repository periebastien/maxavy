const config = require('../modules/rank-tracking/rank-tracking.config')
const {
  runDueConfigs, refreshRunningScans, closeFinishedRuns, failStuckScans,
  relaunchDueRetryScans, relaunchDueRetryRuns, isCircuitOpen, pointsInFlight,
} = require('../modules/rank-tracking/scan.service')

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
    // 1) nettoyer/récupérer les scans bloqués, 2) faire avancer ceux en cours, 3) clôturer les rapports
    // terminés — ces 3 passes tournent TOUJOURS (elles drainent l'existant, ne créent pas de charge neuve).
    const stuck = await failStuckScans(config.scanTimeoutMinutes)
    const polled = await refreshRunningScans(config.concurrency)
    const closedRuns = await closeFinishedRuns()

    // 4) LANCEMENT de travail neuf (reprises + nouveaux rapports) : soumis à deux portes anti-surcharge —
    // circuit-breaker ouvert (panne DataForSEO en série) ou trop de points en vol (protège tasks_ready).
    // Si l'une bloque, on saute le lancement ce tick ; le drain se poursuit aux ticks suivants.
    let launched = { launched: 0, skipped: 0, failed: 0 }
    let retryScans = { relaunched: 0, cancelled: 0 }
    let retryRuns = { relaunched: 0, cancelled: 0 }
    let gate = null
    if (isCircuitOpen()) gate = 'circuit-ouvert'
    else if ((await pointsInFlight()) >= config.maxPointsInFlight) gate = 'points-en-vol-satures'
    if (!gate) {
      retryScans = await relaunchDueRetryScans(config.batchSize, config.concurrency)
      retryRuns = await relaunchDueRetryRuns(config.batchSize, config.concurrency)
      launched = await runDueConfigs(config.batchSize, config.concurrency)
    }

    if (launched.launched || launched.failed || polled.done || stuck.failed || stuck.recovering ||
        closedRuns.closed || closedRuns.retried || retryScans.relaunched || retryRuns.relaunched || gate) {
      console.log(
        `[cron][geogrid] rapports lancés=${launched.launched} ignorés=${launched.skipped} échoués=${launched.failed} ` +
        `| reprises scans=${retryScans.relaunched} (annulées=${retryScans.cancelled}) runs=${retryRuns.relaunched} ` +
        `| scans rafraîchis=${polled.refreshed} terminés=${polled.done} récup=${stuck.recovering} ` +
        `| rapports clôturés=${closedRuns.closed} replanifiés=${closedRuns.retried} | timeout=${stuck.failed}` +
        (gate ? ` | LANCEMENT EN PAUSE (${gate})` : '')
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
