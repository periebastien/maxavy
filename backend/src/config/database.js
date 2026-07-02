const { Sequelize } = require('sequelize')

// Pool relevé de 5 (défaut Sequelize) à 20 pour absorber le lancement parallèle du cron geogrid
// (GEOGRID_CONCURRENCY scans en parallèle, chacun ~5 requêtes). Réglable via DB_POOL_MAX.
const poolMax = parseInt(process.env.DB_POOL_MAX, 10)

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: Number.isInteger(poolMax) && poolMax > 0 ? poolMax : 20,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  dialectOptions: {
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  }
})

module.exports = sequelize
