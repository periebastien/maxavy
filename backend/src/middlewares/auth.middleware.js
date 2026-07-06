const jwt = require('jsonwebtoken')

function authMiddleware(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token manquant' })
  }
  try {
    req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET, { algorithms: ['HS256'] })
    next()
  } catch {
    res.status(401).json({ message: 'Token invalide ou expiré' })
  }
}

module.exports = { authMiddleware }
