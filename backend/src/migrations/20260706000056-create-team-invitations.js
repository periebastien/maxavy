'use strict'

// Session 30 — Gestion équipe. Table des invitations en attente d'un invité qui n'a PAS
// encore de compte User (la table `team_members` exige un user_id NOT NULL, donc on ne peut
// pas y stocker un invité inconnu). Additive : n'altère aucune table existante.
//   - email : chiffré AES-256-GCM (donnée personnelle, comme customers.email)
//   - email_hash : SHA-256 déterministe de l'email normalisé → permet de retrouver une invitation
//                  par email sans déchiffrer toute la table (lookup à l'acceptation / à l'inscription)
//   - token_hash : SHA-256 du token d'invitation (jamais le token en clair en base)

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('team_invitations', {
      id:          { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      business_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'businesses', key: 'id' }, onDelete: 'CASCADE' },
      email:       { type: Sequelize.TEXT, allowNull: false },
      email_hash:  { type: Sequelize.STRING, allowNull: false },
      role:        { type: Sequelize.ENUM('admin', 'editor', 'viewer'), allowNull: false, defaultValue: 'viewer' },
      token_hash:  { type: Sequelize.STRING, allowNull: false },
      status:      { type: Sequelize.ENUM('pending', 'accepted', 'revoked'), allowNull: false, defaultValue: 'pending' },
      invited_by:  { type: Sequelize.UUID, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      expires_at:  { type: Sequelize.DATE, allowNull: false },
      created_at:  { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    })

    await queryInterface.addIndex('team_invitations', ['business_id'])
    await queryInterface.addIndex('team_invitations', ['token_hash'])
    await queryInterface.addIndex('team_invitations', ['email_hash'])
  },

  async down(queryInterface) {
    await queryInterface.dropTable('team_invitations')
    // Nettoyage des types ENUM Postgres créés par createTable
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_team_invitations_role";')
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_team_invitations_status";')
  },
}
