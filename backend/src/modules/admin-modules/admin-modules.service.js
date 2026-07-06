const BusinessModule = require('../../models/BusinessModule')
const Business = require('../../models/Business')

// Catalogue statique des modules connus (session 32). Reflète les dossiers réels sous
// backend/src/modules/ qui correspondent à des modules métier activables (pas auth/businesses/
// locations/credits/stripe/google/places/plans-admin/customers/invitations/campaigns/tags —
// ce sont des briques transverses, pas des modules au sens `business_modules`).
// ⚠️ Aucun de ces modules ne consulte encore `business_modules` pour décider s'il est actif —
// le gating réel passe par `plans.module_quotas`. Ce catalogue sert uniquement au CRUD Super Admin.
const MODULE_CATALOG = [
  { key: 'rank_tracking', label: 'Suivi de positionnement (geogrid)' },
  { key: 'reviews', label: 'Avis Google' },
  { key: 'widgets', label: 'Widgets' },
]

function assertKnownModule(moduleKey) {
  if (!MODULE_CATALOG.some(m => m.key === moduleKey)) {
    throw { status: 400, message: `module_key inconnu : ${moduleKey}` }
  }
}

async function listBusinesses() {
  const businesses = await Business.findAll({
    attributes: ['id', 'name'],
    order: [['name', 'ASC']],
  })
  return businesses.map(b => ({ id: b.id, name: b.name }))
}

async function listForBusiness(businessId) {
  if (!businessId) throw { status: 400, message: 'business_id est requis' }

  const business = await Business.findByPk(businessId, { attributes: ['id'] })
  if (!business) throw { status: 404, message: 'Entreprise introuvable' }

  const rows = await BusinessModule.findAll({ where: { business_id: businessId } })
  const byKey = new Map(rows.map(r => [r.module_key, r]))

  return MODULE_CATALOG.map(({ key, label }) => {
    const row = byKey.get(key)
    return {
      module_key: key,
      label,
      enabled: row?.enabled ?? false,
      activated_at: row?.activated_at ?? null,
      settings: row?.settings ?? {},
    }
  })
}

async function upsert(businessId, moduleKey, body) {
  if (!businessId) throw { status: 400, message: 'business_id est requis' }
  assertKnownModule(moduleKey)

  if (body?.enabled === undefined) {
    throw { status: 400, message: 'enabled est requis' }
  }
  const enabled = !!body.enabled

  if (body.settings !== undefined && (typeof body.settings !== 'object' || body.settings === null || Array.isArray(body.settings))) {
    throw { status: 400, message: 'settings doit être un objet' }
  }

  const business = await Business.findByPk(businessId, { attributes: ['id'] })
  if (!business) throw { status: 404, message: 'Entreprise introuvable' }

  let row = await BusinessModule.findOne({ where: { business_id: businessId, module_key: moduleKey } })

  if (!row) {
    row = await BusinessModule.create({
      business_id: businessId,
      module_key: moduleKey,
      enabled,
      settings: body.settings ?? {},
      activated_at: enabled ? new Date() : null,
    })
  } else {
    const wasEnabled = row.enabled
    row.enabled = enabled
    if (body.settings !== undefined) row.settings = body.settings
    if (enabled && !wasEnabled) row.activated_at = new Date()
    await row.save()
  }

  return {
    module_key: row.module_key,
    enabled: row.enabled,
    activated_at: row.activated_at,
    settings: row.settings,
  }
}

module.exports = { MODULE_CATALOG, listBusinesses, listForBusiness, upsert }
