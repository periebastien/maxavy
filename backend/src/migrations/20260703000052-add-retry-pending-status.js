'use strict'

// Ajoute le statut 'retry_pending' aux enums de statut scan + run. Distinct de 'failed' : un scan/run en
// attente de reprise ne doit PAS être considéré comme terminé (closeFinishedRuns ne clôt pas un run tant
// qu'il reste des scans retry_pending) ni notifié en échec. ADD VALUE est non réversible proprement en
// Postgres → down no-op (philosophie strictement additive, cf. G5). PG 16 : IF NOT EXISTS supporté.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query("ALTER TYPE enum_geogrid_scans_status ADD VALUE IF NOT EXISTS 'retry_pending'")
    await queryInterface.sequelize.query("ALTER TYPE enum_geogrid_runs_status ADD VALUE IF NOT EXISTS 'retry_pending'")
  },
  async down() {
    // ADD VALUE non réversible proprement en Postgres (nécessiterait de recréer le type). No-op assumé.
  },
}
