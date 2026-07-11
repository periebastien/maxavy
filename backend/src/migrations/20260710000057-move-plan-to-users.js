'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'plan_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'plans', key: 'id' },
      onDelete: 'SET NULL',
    })
    await queryInterface.addColumn('users', 'stripe_customer_id', {
      type: Sequelize.STRING,
      allowNull: true,
    })
    await queryInterface.addColumn('users', 'stripe_subscription_id', {
      type: Sequelize.STRING,
      allowNull: true,
    })
    await queryInterface.addColumn('users', 'credit_balance', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    })

    await queryInterface.sequelize.query(`
      UPDATE users u
      SET plan_id = ranked.plan_id
      FROM (
        SELECT DISTINCT ON (b.owner_id) b.owner_id, b.plan_id
        FROM businesses b
        JOIN plans p ON p.id = b.plan_id
        WHERE b.plan_id IS NOT NULL
        ORDER BY b.owner_id, p.price DESC
      ) ranked
      WHERE u.id = ranked.owner_id
    `)

    await queryInterface.sequelize.query(`
      UPDATE users u
      SET credit_balance = COALESCE(sub.total, 0)
      FROM (
        SELECT owner_id, SUM(credit_balance) AS total
        FROM businesses
        GROUP BY owner_id
      ) sub
      WHERE u.id = sub.owner_id
    `)
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'plan_id')
    await queryInterface.removeColumn('users', 'stripe_customer_id')
    await queryInterface.removeColumn('users', 'stripe_subscription_id')
    await queryInterface.removeColumn('users', 'credit_balance')
  },
}
