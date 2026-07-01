'use strict'
const { v4: uuidv4 } = require('uuid')

const now = new Date()

const plans = [
  {
    id:              uuidv4(),
    name:            'Gratuit',
    description:     'Découvrez l\'outil sans engagement',
    price:           0,
    monthly_credits: 50,
    features:        JSON.stringify([
      '50 crédits / mois',
      '1 localisation',
      'Page de collecte d\'avis',
      'QR Code',
      'Import CSV clients',
    ]),
    active:     true,
    sort_order: 1,
    created_at: now,
    updated_at: now,
  },
  {
    id:              uuidv4(),
    name:            'Starter',
    description:     'Pour les indépendants et TPE',
    price:           29.00,
    monthly_credits: 200,
    features:        JSON.stringify([
      '200 crédits / mois',
      '3 localisations',
      'Invitations email',
      'Campagnes d\'invitations',
      'Sync avis Google',
      'Support email',
    ]),
    active:     true,
    sort_order: 2,
    created_at: now,
    updated_at: now,
  },
  {
    id:              uuidv4(),
    name:            'Pro',
    description:     'Pour les PME multi-établissements',
    price:           50.00,
    monthly_credits: 500,
    features:        JSON.stringify([
      '500 crédits / mois',
      'Localisations illimitées',
      'Invitations email & SMS',
      'Campagnes avancées',
      'Sync avis Google',
      'Widgets avis',
      'Support prioritaire',
    ]),
    active:     true,
    sort_order: 3,
    created_at: now,
    updated_at: now,
  },
  {
    id:              uuidv4(),
    name:            'Agence',
    description:     'Pour les agences gérant plusieurs clients',
    price:           90.00,
    monthly_credits: 2000,
    features:        JSON.stringify([
      '2000 crédits / mois',
      'Localisations illimitées',
      'Multi-entreprises',
      'Invitations email & SMS',
      'Campagnes avancées',
      'Sync avis Google',
      'Widgets avis',
      'Gestion d\'équipe',
      'Support dédié',
    ]),
    active:     true,
    sort_order: 4,
    created_at: now,
    updated_at: now,
  },
]

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('plans', plans)
  },
  async down(queryInterface) {
    await queryInterface.bulkDelete('plans', null, {})
  }
}
