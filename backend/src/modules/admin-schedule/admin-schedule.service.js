const { DateTime } = require('luxon')
const GeogridConfig = require('../../models/GeogridConfig')
const Business = require('../../models/Business')
const Location = require('../../models/Location')
const { computeNextRunAt } = require('../rank-tracking/schedule.utils')

// Vue cross-tenant (Super Admin) : liste tous les rapports geogrid (positionnement + hitmap,
// même config/run — cf. GeogridMap.jsx) prévus ce mois-ci à partir de maintenant.
const MAX_OCCURRENCES_PER_CONFIG = 60 // garde-fou (configs daily sur un mois plein)

async function listGeogridMonth() {
  const configs = await GeogridConfig.findAll({ where: { active: true } })
  if (!configs.length) return []

  const businessIds = [...new Set(configs.map(c => c.business_id))]
  const locationIds = [...new Set(configs.map(c => c.location_id))]
  const [businesses, locations] = await Promise.all([
    Business.findAll({ where: { id: businessIds } }),
    Location.findAll({ where: { id: locationIds } }),
  ])
  const businessById = new Map(businesses.map(b => [b.id, b]))
  const locationById = new Map(locations.map(l => [l.id, l]))

  const now = new Date()
  const items = []

  for (const config of configs) {
    const tz = config.timezone || 'Europe/Paris'
    const endOfMonth = DateTime.fromJSDate(now, { zone: tz }).endOf('month')

    let cursor = config.next_run_at && config.next_run_at > now
      ? config.next_run_at
      : computeNextRunAt(config, tz, now)

    let guard = 0
    while (cursor && DateTime.fromJSDate(cursor, { zone: tz }) <= endOfMonth && guard++ < MAX_OCCURRENCES_PER_CONFIG) {
      items.push({
        business_name: businessById.get(config.business_id)?.name || '—',
        location_name: locationById.get(config.location_id)?.name || '—',
        frequency: config.frequency,
        scheduled_for: cursor,
      })
      cursor = computeNextRunAt(config, tz, cursor)
    }
  }

  items.sort((a, b) => new Date(a.scheduled_for) - new Date(b.scheduled_for))
  return items
}

module.exports = { listGeogridMonth }
