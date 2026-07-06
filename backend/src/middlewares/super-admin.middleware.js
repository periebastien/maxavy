// Restreint l'accès aux routes Super Admin. À utiliser après authMiddleware (req.user déjà peuplé
// depuis le JWT, qui contient `role` — voir auth.service.js). Un seul rôle superadmin en base (User.role).
function superAdminMiddleware(req, res, next) {
  if (req.user?.role !== 'superadmin') {
    return res.status(403).json({ message: 'Accès réservé au Super Admin' })
  }
  next()
}

module.exports = { superAdminMiddleware }
