const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../config/db');
const { requireAuth } = require('../middleware/auth');

function genToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, isAdmin: !!user.is_admin },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Nom, email et mot de passe requis.' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Mot de passe trop court (min. 6 caractères).' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'Email invalide.' });

  const existing = db.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
  if (existing) return res.status(409).json({ error: 'Cet email est déjà utilisé.' });

  const hash = bcrypt.hashSync(password, 12);
  db.run('INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
    [name.trim(), email.toLowerCase().trim(), hash]);

  const user  = db.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
  const token = genToken(user);
  res.status(201).json({
    message: 'Compte créé avec succès.', token,
    user: { id: user.id, name: user.name, email: user.email, isAdmin: false }
  });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email et mot de passe requis.' });

  const user = db.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
  if (!user) return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });

  if (!bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });

  const token = genToken(user);
  res.json({
    message: `Bienvenue ${user.name} !`, token,
    user: { id: user.id, name: user.name, email: user.email, isAdmin: !!user.is_admin }
  });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  const user = db.get('SELECT id,name,email,is_admin,created_at FROM users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });
  res.json({ ...user, isAdmin: !!user.is_admin });
});

// PUT /api/auth/me
router.put('/me', requireAuth, (req, res) => {
  const { name, password } = req.body;
  const user = db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });

  const newName = name?.trim() || user.name;
  let newHash   = user.password;
  if (password) {
    if (password.length < 6) return res.status(400).json({ error: 'Mot de passe trop court.' });
    newHash = bcrypt.hashSync(password, 12);
  }
  db.run('UPDATE users SET name = ?, password = ? WHERE id = ?', [newName, newHash, user.id]);
  res.json({ message: 'Profil mis à jour.', name: newName });
});

module.exports = router;
