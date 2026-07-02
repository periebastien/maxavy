// Sélectionne l'implémentation RankProvider via RANK_PROVIDER (.env). Interface commune :
// submitTasks(tasks) / getReadyTaskIds() / getTaskResult(taskId) — voir dataforseo.provider.js.
// Basculer de fournisseur (SerpApi, Oxylabs...) = ajouter un fichier ici, zéro refonte du service.

const providers = {
  dataforseo: () => require('./dataforseo.provider'),
}

const name = process.env.RANK_PROVIDER || 'dataforseo'
const load = providers[name]
if (!load) throw new Error(`RANK_PROVIDER inconnu : ${name}`)

module.exports = load()
