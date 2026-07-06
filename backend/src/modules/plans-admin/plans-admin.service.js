const Plan = require('../../models/Plan')

const ALLOWED_FREQUENCIES = ['monthly', 'weekly', 'daily'] // cf. schedule.utils.js computeNextRunAt
const ALLOWED_SHAPES = ['square', 'circle'] // cf. geogrid.utils.js buildGrid
const ALLOWED_SPACINGS = [250, 500, 750, 1000, 1500, 2000] // cf. GeogridConfigPage.jsx SPACING_OPTIONS — l'espacement ne change pas le nombre de points, seulement l'échelle géographique

// Bornes raisonnables — évite une saisie Super Admin absurde (grille énorme, quota 0/négatif, etc.).
const BOUNDS = {
  max_grid_size: { min: 3, max: 21, odd: true },
  max_competitors: { min: 0, max: 50 },
  max_keywords: { min: 0, max: 200 },
}

function validateRankTracking(input) {
  if (input == null || typeof input !== 'object' || Array.isArray(input)) {
    throw { status: 400, message: 'rank_tracking doit être un objet' }
  }

  const out = {}

  if (input.enabled !== undefined) {
    out.enabled = !!input.enabled
  }

  for (const key of ['max_grid_size', 'max_competitors', 'max_keywords']) {
    if (input[key] === undefined) continue
    const n = Number(input[key])
    const b = BOUNDS[key]
    if (!Number.isInteger(n) || n < b.min || n > b.max) {
      throw { status: 400, message: `${key} doit être un entier entre ${b.min} et ${b.max}` }
    }
    if (b.odd && n % 2 === 0) {
      throw { status: 400, message: `${key} doit être impair` }
    }
    out[key] = n
  }

  if (input.grid_spacing_m !== undefined) {
    const n = Number(input.grid_spacing_m)
    if (!ALLOWED_SPACINGS.includes(n)) {
      throw { status: 400, message: `grid_spacing_m invalide (autorisés : ${ALLOWED_SPACINGS.join(', ')})` }
    }
    out.grid_spacing_m = n
  }

  if (input.allowed_frequencies !== undefined) {
    if (!Array.isArray(input.allowed_frequencies) || input.allowed_frequencies.length === 0) {
      throw { status: 400, message: 'allowed_frequencies doit être un tableau non vide' }
    }
    for (const f of input.allowed_frequencies) {
      if (!ALLOWED_FREQUENCIES.includes(f)) {
        throw { status: 400, message: `Fréquence invalide : ${f} (autorisées : ${ALLOWED_FREQUENCIES.join(', ')})` }
      }
    }
    out.allowed_frequencies = [...new Set(input.allowed_frequencies)]
  }

  if (input.allowed_shapes !== undefined) {
    if (!Array.isArray(input.allowed_shapes) || input.allowed_shapes.length === 0) {
      throw { status: 400, message: 'allowed_shapes doit être un tableau non vide' }
    }
    for (const s of input.allowed_shapes) {
      if (!ALLOWED_SHAPES.includes(s)) {
        throw { status: 400, message: `Forme invalide : ${s} (autorisées : ${ALLOWED_SHAPES.join(', ')})` }
      }
    }
    out.allowed_shapes = [...new Set(input.allowed_shapes)]
  }

  // Legacy (encore lues par rank-tracking.service.js en repli) — éditables aussi pour cohérence,
  // mais non requises (cutover complet différé, cf. CLAUDE.md G6).
  if (input.frequency !== undefined) {
    if (!ALLOWED_FREQUENCIES.includes(input.frequency)) {
      throw { status: 400, message: 'frequency invalide' }
    }
    out.frequency = input.frequency
  }
  if (input.grid_size !== undefined) {
    const n = Number(input.grid_size)
    if (!Number.isInteger(n) || n < 3 || n % 2 === 0) throw { status: 400, message: 'grid_size invalide' }
    out.grid_size = n
  }

  return out
}

function validateGeneral(input, { partial } = { partial: false }) {
  const out = {}

  if (!partial || input.name !== undefined) {
    if (typeof input.name !== 'string' || !input.name.trim()) {
      throw { status: 400, message: 'name est requis' }
    }
    out.name = input.name.trim()
  }

  if (input.description !== undefined) {
    if (input.description !== null && typeof input.description !== 'string') {
      throw { status: 400, message: 'description doit être une chaîne' }
    }
    out.description = input.description ?? null
  }

  if (!partial || input.price !== undefined) {
    const n = Number(input.price)
    if (input.price === undefined || Number.isNaN(n) || n < 0) {
      throw { status: 400, message: 'price doit être un nombre >= 0' }
    }
    out.price = n
  }

  if (!partial || input.monthly_credits !== undefined) {
    const n = Number(input.monthly_credits)
    if (input.monthly_credits === undefined || !Number.isInteger(n) || n < 0) {
      throw { status: 400, message: 'monthly_credits doit être un entier >= 0' }
    }
    out.monthly_credits = n
  }

  for (const key of ['max_businesses', 'max_locations']) {
    if (input[key] === undefined) continue
    if (input[key] === null) { out[key] = null; continue } // NULL = illimité
    const n = Number(input[key])
    if (!Number.isInteger(n) || n < 1) {
      throw { status: 400, message: `${key} doit être un entier >= 1, ou null pour illimité` }
    }
    out[key] = n
  }

  if (input.features !== undefined) {
    if (!Array.isArray(input.features) || input.features.some(f => typeof f !== 'string')) {
      throw { status: 400, message: 'features doit être un tableau de chaînes' }
    }
    out.features = input.features
  }

  if (input.stripe_product_id !== undefined) {
    if (input.stripe_product_id !== null && typeof input.stripe_product_id !== 'string') {
      throw { status: 400, message: 'stripe_product_id doit être une chaîne' }
    }
    out.stripe_product_id = input.stripe_product_id ?? null
  }

  if (input.stripe_price_id !== undefined) {
    if (input.stripe_price_id !== null && typeof input.stripe_price_id !== 'string') {
      throw { status: 400, message: 'stripe_price_id doit être une chaîne' }
    }
    out.stripe_price_id = input.stripe_price_id ?? null
  }

  if (input.stripe_price_id_yearly !== undefined) {
    if (input.stripe_price_id_yearly !== null && typeof input.stripe_price_id_yearly !== 'string') {
      throw { status: 400, message: 'stripe_price_id_yearly doit être une chaîne' }
    }
    out.stripe_price_id_yearly = input.stripe_price_id_yearly ?? null
  }

  if (input.active !== undefined) {
    out.active = !!input.active
  }

  if (input.sort_order !== undefined) {
    const n = Number(input.sort_order)
    if (!Number.isInteger(n)) {
      throw { status: 400, message: 'sort_order doit être un entier' }
    }
    out.sort_order = n
  }

  return out
}

async function list() {
  const plans = await Plan.findAll({ order: [['sort_order', 'ASC']] })
  return plans.map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.price,
    monthly_credits: p.monthly_credits,
    max_businesses: p.max_businesses,
    max_locations: p.max_locations,
    features: p.features || [],
    stripe_product_id: p.stripe_product_id,
    stripe_price_id: p.stripe_price_id,
    stripe_price_id_yearly: p.stripe_price_id_yearly,
    active: p.active,
    sort_order: p.sort_order,
    rank_tracking: p.module_quotas?.rank_tracking || null,
    reviews: p.module_quotas?.reviews || null,
  }))
}

async function getOne(planId) {
  const plan = await Plan.findByPk(planId)
  if (!plan) throw { status: 404, message: 'Plan introuvable' }
  return plan
}

async function create(data) {
  const validated = validateGeneral(data, { partial: false })
  const plan = await Plan.create(validated)
  return plan
}

async function update(planId, data) {
  const plan = await getOne(planId)
  const validated = validateGeneral(data, { partial: true })
  Object.assign(plan, validated)
  await plan.save()
  return plan
}

async function updateRankTracking(planId, body) {
  const plan = await getOne(planId)
  const validated = validateRankTracking(body)
  const current = plan.module_quotas?.rank_tracking || {}
  const merged = { ...current, ...validated }

  // Cohérence : le plafond doit rester atteignable par les défauts (pas de contrôle strict ici,
  // simple garde-fou — defaultGridSize/defaultFrequency dans rank-tracking.service.js gèrent déjà le repli).
  plan.module_quotas = { ...plan.module_quotas, rank_tracking: merged }
  plan.changed('module_quotas', true) // JSONB : forcer la détection du changement (Sequelize ne diff pas en profondeur)
  await plan.save()
  return merged
}

module.exports = { list, getOne, create, update, updateRankTracking }
