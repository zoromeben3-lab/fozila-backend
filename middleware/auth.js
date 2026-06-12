// ══════════════════════════════════════════════════
//  FOZILA — Middleware Auth JWT
// ══════════════════════════════════════════════════

const jwt = require('jsonwebtoken');

// Vérifie que l'utilisateur est connecté
function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer <token>"

  if (!token) {
    return res.status(401).json({ error: 'Token manquant. Connectez-vous.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token invalide ou expiré.' });
  }
}

// Vérifie que l'utilisateur est admin
function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
    }
    next();
  });
}

module.exports = { requireAuth, requireAdmin };
