const CreditCost = require('../models/CreditCost')

const TTL_MS = 60 * 1000

const DEFAULT_COSTS = {
  invitation_email: 1,
  invitation_sms: 5,
  invitation_whatsapp: 5,
  geogrid_point: 2,
}

let cache = null
let cachedAt = 0

async function loadCache() {
  const rows = await CreditCost.findAll()
  const map = {}
  for (const row of rows) map[row.action_key] = row.cost
  cache = map
  cachedAt = Date.now()
  return cache
}

async function getCost(actionKey) {
  if (!cache || Date.now() - cachedAt > TTL_MS) {
    try {
      await loadCache()
    } catch {
      return DEFAULT_COSTS[actionKey] ?? 0
    }
  }
  if (cache[actionKey] != null) return cache[actionKey]
  return DEFAULT_COSTS[actionKey] ?? 0
}

function invalidateCache() {
  cache = null
  cachedAt = 0
}

module.exports = { getCost, invalidateCache }
