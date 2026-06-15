const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../config/db');
const { requireAuth } = require('../middleware/auth');

function genToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, isAdmin: !!user.is_admin },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { nom, prenom, phone, password } = req.body;
  if (!nom || !prenom || !phone || !password)
    return res.status(400).json({ error: 'Tous les champs sont requis.' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Mot de passe trop court (min. 6 caractères).' });
  if (!/^[\d\s+\-()]{8,15}$/.test(phone.trim()))
    return res.status(400).json({ error: 'Numéro de téléphone invalide.' });

  const name = (nom.trim() + ' ' + prenom.trim());
  const existing = db.get('SELECT id FROM users WHERE phone = ?', [phone.trim()]);
  if (existing) return res.status(409).json({ error: 'Ce numéro est déjà utilisé.' });

  const hash  = bcrypt.hashSync(password, 12);
  const email = `user_${Date.now()}@foliza.local`;
  db.run('INSERT INTO users (name, email, phone, password) VALUES (?, ?, ?, ?)',
    [name, email, phone.trim(), hash]);

  const user  = db.get('SELECT * FROM users WHERE phone = ?', [phone.trim()]);
  const token = genToken(user);
  res.status(201).json({
    message: 'Compte créé avec succès.', token,
    user: { id: user.id, name: user.name, phone: user.phone, isAdmin: false }
  });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { nom, prenom, password } = req.body;
  if (!nom || !prenom || !password)
    return res.status(400).json({ error: 'Nom, prénom et mot de passe requis.' });

  const name = (nom.trim() + ' ' + prenom.trim());

  // ── VÉRIFIER SI C'EST L'ADMIN ──
  const adminNom    = process.env.ADMIN_NOM    || 'admin';
  const adminPrenom = process.env.ADMIN_PRENOM || 'foliza';
  const adminPwd    = process.env.ADMIN_PASSWORD;

  if (nom.trim().toLowerCase() === adminNom.toLowerCase() &&
      prenom.trim().toLowerCase() === adminPrenom.toLowerCase()) {
    if (password !== adminPwd)
      return res.status(401).json({ error: 'Mot de passe incorrect.' });

    let admin = db.get('SELECT * FROM users WHERE is_admin = 1');
    if (!admin) {
      const hash = bcrypt.hashSync(adminPwd, 12);
      db.run('INSERT INTO users (name, email, password, is_admin) VALUES (?, ?, ?, 1)',
        [name, process.env.ADMIN_EMAIL || 'admin@foliza.local', hash]);
      admin = db.get('SELECT * FROM users WHERE is_admin = 1');
    }
    const token = genToken(admin);
    return res.json({
      message: `Bienvenue ${admin.name} !`, token,
      user: { id: admin.id, name: admin.name, isAdmin: true }
    });
  }

  // ── CONNEXION UTILISATEUR NORMAL ──
  const user = db.get('SELECT * FROM users WHERE LOWER(name) = LOWER(?)', [name]);
  if (!user) return res.status(401).json({ error: 'Nom ou prénom introuvable.' });

  if (!bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Mot de passe incorrect.' });

  const token = genToken(user);
  res.json({
    message: `Bienvenue ${user.name} !`, token,
    user: { id: user.id, name: user.name, phone: user.phone, isAdmin: false }
  });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  const user = db.get('SELECT id,name,phone,is_admin,created_at FROM users WHERE id = ?', [req.user.id]);
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
