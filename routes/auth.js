const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../config/db');
const { requireAuth } = require('../middleware/auth');

function genToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, phone: user.phone, isAdmin: !!user.is_admin },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { name, phone, password } = req.body;
  if (!name || !phone || !password)
    return res.status(400).json({ error: 'Nom, numéro de téléphone et mot de passe requis.' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Mot de passe trop court (min. 6 caractères).' });
  if (!/^[\d\s+\-()]{8,15}$/.test(phone.trim()))
    return res.status(400).json({ error: 'Numéro de téléphone invalide.' });

  const existing = db.get('SELECT id FROM users WHERE phone = ?', [phone.trim()]);
  if (existing) return res.status(409).json({ error: 'Ce numéro est déjà utilisé.' });

  const hash  = bcrypt.hashSync(password, 12);
  const email = `user_${Date.now()}@foliza.local`;
  db.run('INSERT INTO users (name, email, phone, password) VALUES (?, ?, ?, ?)',
    [name.trim(), email, phone.trim(), hash]);

  const user  = db.get('SELECT * FROM users WHERE phone = ?', [phone.trim()]);
  const token = genToken(user);
  res.status(201).json({
    message: 'Compte créé avec succès.', token,
    user: { id: user.id, name: user.name, phone: user.phone, isAdmin: false }
  });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { name, phone, password, email } = req.body;

  // ── CONNEXION ADMIN PAR EMAIL ──
  if (email) {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPwd   = process.env.ADMIN_PASSWORD;

    if (email.toLowerCase().trim() === adminEmail && password === adminPwd) {
      let admin = db.get('SELECT * FROM users WHERE email = ?', [adminEmail]);
      if (!admin) {
        // Créer l'admin s'il n'existe pas encore
        const hash = bcrypt.hashSync(adminPwd, 12);
        db.run('INSERT INTO users (name, email, password, is_admin) VALUES (?, ?, ?, 1)',
          [process.env.ADMIN_NAME || 'Administrateur', adminEmail, hash]);
        admin = db.get('SELECT * FROM users WHERE email = ?', [adminEmail]);
      }
      const token = genToken(admin);
      return res.json({
        message: `Bienvenue ${admin.name} !`, token,
        user: { id: admin.id, name: admin.name, email: admin.email, isAdmin: true }
      });
    }
    return res.status(401).json({ error: 'Email ou mot de passe admin incorrect.' });
  }

  // ── CONNEXION UTILISATEUR PAR TÉLÉPHONE ──
  if (!phone || !password)
    return res.status(400).json({ error: 'Numéro de téléphone et mot de passe requis.' });

  const user = db.get('SELECT * FROM users WHERE phone = ?', [phone.trim()]);
  if (!user) return res.status(401).json({ error: 'Numéro de téléphone introuvable.' });

  if (name && user.name.toLowerCase() !== name.trim().toLowerCase())
    return res.status(401).json({ error: 'Nom incorrect.' });

  if (!bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Mot de passe incorrect.' });

  const token = genToken(user);
  res.json({
    message: `Bienvenue ${user.name} !`, token,
    user: { id: user.id, name: user.name, phone: user.phone, isAdmin: !!user.is_admin }
  });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  const user = db.get('SELECT id,name,email,phone,is_admin,created_at FROM users WHERE id = ?', [req.user.id]);
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
