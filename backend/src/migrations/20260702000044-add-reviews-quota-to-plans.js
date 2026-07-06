'use strict'

// Gating par plan de la synchro d'avis (même mécanique que module_quotas.rank_tracking). ADDITIF : n'ajoute
// que la clé `reviews`, ne touche à rien d'autre. Gratuit = pas de clé → synchro désactivée (getReviewsQuota
// renvoie {enabled:false}). interval_minutes pilote la cadence (détection « fiche due »). Standard queue,
// profondeur/backfill techniques (config .env, pas différenciateur commercial). Éditable en Super Admin.
//   Starter : quotidien (1440) · Pro : toutes les 6h / 4×j (360) · Agence : toutes les heures (60)

const QUOTAS = {
  Starter: { enabled: true, interval_minutes: 1440 },
  Pro:     { enabled: true, interval_minutes: 360 },
  Agence:  { enabled: true, interval_minutes: 60 },
}

module.exports = {
  async up(queryInterface) {
    for (const [planName, val] of Object.entries(QUOTAS)) {
      await queryInterface.sequelize.query(
        `UPDATE plans
         SET module_quotas = jsonb_set(COALESCE(module_quotas, '{}'::jsonb), '{reviews}', :val::jsonb, true)
         WHERE name = :planName`,
        { replacements: { planName, val: JSON.stringify(val) } }
      )
    }
  },

  async down(queryInterface) {
    for (const planName of Object.keys(QUOTAS)) {
      await queryInterface.sequelize.query(
        `UPDATE plans SET module_quotas = module_quotas - 'reviews' WHERE name = :planName`,
        { replacements: { planName } }
      )
    }
  },
}
