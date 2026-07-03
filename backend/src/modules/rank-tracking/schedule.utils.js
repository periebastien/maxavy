// Calcul du prochain déclenchement d'une config geogrid (next_run_at), fuseau-aware — GEOGRID_REFONTE_FR.md §7, §16.
// run_day_of_week suit la convention JS Date.getDay() : 0 = dimanche ... 6 = samedi.
// run_day_of_month est clampé au dernier jour du mois si le mois cible en compte moins (29/30/31).

const { DateTime } = require('luxon')

const DEFAULT_HOUR = 4
const DEFAULT_DOW = 1 // lundi

function clampToMonthDay(dt, day) {
  return dt.set({ day: Math.min(day, dt.daysInMonth) })
}

// fromDate : instant à partir duquel chercher la PROCHAINE occurrence strictement postérieure.
// Toujours appelé avec l'ancre du planning (next_run_at courant), pas "now", pour ne jamais dériver
// si un tick est en retard — cf. GEOGRID_REFONTE_FR.md §7 (mêmes principes anti-dérive que last_scanned_at en G3).
function computeNextRunAt(config, timezone, fromDate = new Date()) {
  const tz = timezone || 'Europe/Paris'
  const hour = Number.isInteger(config.run_hour) ? config.run_hour : DEFAULT_HOUR
  const now = DateTime.fromJSDate(fromDate, { zone: tz })

  if (config.frequency === 'daily') {
    let next = now.set({ hour, minute: 0, second: 0, millisecond: 0 })
    if (next <= now) next = next.plus({ days: 1 })
    return next.toUTC().toJSDate()
  }

  if (config.frequency === 'weekly') {
    const targetDow = Number.isInteger(config.run_day_of_week) ? config.run_day_of_week : DEFAULT_DOW
    const luxonTarget = targetDow === 0 ? 7 : targetDow // Luxon : 1 (lundi) - 7 (dimanche)
    let next = now.set({ hour, minute: 0, second: 0, millisecond: 0 })
    const diff = (luxonTarget - next.weekday + 7) % 7
    next = next.plus({ days: diff })
    if (next <= now) next = next.plus({ weeks: 1 })
    return next.toUTC().toJSDate()
  }

  // monthly
  const targetDom = Number.isInteger(config.run_day_of_month) ? config.run_day_of_month : 1
  let next = clampToMonthDay(now.set({ hour, minute: 0, second: 0, millisecond: 0 }), targetDom)
  if (next <= now) {
    next = clampToMonthDay(now.plus({ months: 1 }).set({ hour, minute: 0, second: 0, millisecond: 0 }), targetDom)
  }
  return next.toUTC().toJSDate()
}

// Comme computeNextRunAt, mais SAUTE toutes les occurrences déjà passées jusqu'à la première strictement
// future. Sert au rattrapage après une longue coupure du backend : sans ce saut, un next_run_at très en
// retard resterait dans le passé après un simple +1 période → le cron relancerait un rapport de rattrapage
// à CHAQUE tick (rafale facturable). Ici on ne garde qu'UN rapport de rattrapage (le tick courant) puis on
// cale next_run_at sur le prochain créneau réel. Garde-fou à 600 itérations (bien au-delà de tout cas réel).
function computeNextRunAtSkipping(config, timezone, fromDate = new Date()) {
  const now = new Date()
  let next = computeNextRunAt(config, timezone, fromDate)
  let guard = 0
  while (next <= now && guard++ < 600) next = computeNextRunAt(config, timezone, next)
  return next
}

function isValidTimezone(tz) {
  return typeof tz === 'string' && tz.length > 0 && DateTime.local().setZone(tz).isValid
}

module.exports = { computeNextRunAt, computeNextRunAtSkipping, isValidTimezone }
