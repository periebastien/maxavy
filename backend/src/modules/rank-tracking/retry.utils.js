// Backoff + jitter déterministe pour la résilience du cron geogrid (retry + étalement).
// GEOGRID_REFONTE_FR.md §7. Objectif : quand beaucoup de configs tombent au même créneau et échouent au
// même instant (blip réseau / panne DataForSEO), leurs reprises NE repartent PAS en rafale synchronisée —
// chaque scan/run recule d'un délai propre, dérivé de son UUID. Aucune dépendance ajoutée.

// hashOffset : offset stable dérivé d'un UUID, borné à [0, mod[. Copie volontaire du même helper de la
// synchro d'avis (reviews.service.js) — le dupliquer évite un couplage inter-modules pour 3 lignes.
function hashOffset(id, mod) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) >>> 0
  return mod > 0 ? h % mod : 0
}

// Palier de base (minutes) pour une tentative donnée (1-based), plafonné au dernier palier de la liste.
// Ex. base=[10,30,90] → tentative 1=10min, 2=30min, 3=90min, 4+=90min.
function baseMinutes(list, attempt) {
  if (!list.length) return 0
  return list[Math.min(attempt, list.length) - 1]
}

// Délai avant la prochaine tentative, en millisecondes : palier de base + jitter déterministe borné à
// jitterMinutes, propre à l'id. attempt est 1-based (la Nᵉ reprise).
function computeBackoffMs(baseList, attempt, id, jitterMinutes) {
  const base = baseMinutes(baseList, attempt) * 60 * 1000
  const jitter = jitterMinutes > 0 ? hashOffset(id, jitterMinutes * 60 * 1000) : 0
  return base + jitter
}

module.exports = { hashOffset, baseMinutes, computeBackoffMs }
