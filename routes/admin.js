const router = require('express').Router();
const db     = require('../config/db');
const { requireAdmin } = require('../middleware/auth');

router.use(requireAdmin);

router.get('/stats', (req, res) => {
  const users     = db.get('SELECT COUNT(*) as c FROM users WHERE is_admin=0').c;
  const albums    = db.get('SELECT COUNT(*) as c FROM albums WHERE is_active=1').c;
  const singles   = db.get('SELECT COUNT(*) as c FROM singles WHERE is_active=1 AND live=1').c;
  const revenue   = db.get(`SELECT COALESCE(SUM(amount),0) as t FROM purchases WHERE status='completed'`).t;
  const purchases = db.get(`SELECT COUNT(*) as c FROM purchases WHERE status='completed'`).c;
  const topAlbums  = db.all('SELECT id,title,emoji,grad,sales,price FROM albums WHERE is_active=1 ORDER BY sales DESC LIMIT 5');
  const topSingles = db.all('SELECT id,title,emoji,grad,sales,price FROM singles WHERE is_active=1 AND live=1 ORDER BY sales DESC LIMIT 5');
  const recent     = db.all(`SELECT p.*,u.name as user_name FROM purchases p JOIN users u ON p.user_id=u.id WHERE p.status='completed' ORDER BY p.purchased_at DESC LIMIT 10`);
  res.json({ stats: { users, albums, singles, revenue, purchases }, topAlbums, topSingles, recentPurchases: recent });
});

router.get('/users', (req, res) => {
  res.json(db.all(`SELECT u.id,u.name,u.email,u.is_admin,u.created_at, COUNT(p.id) as purchase_count, COALESCE(SUM(p.amount),0) as total_spent FROM users u LEFT JOIN purchases p ON p.user_id=u.id AND p.status='completed' GROUP BY u.id ORDER BY u.created_at DESC`));
});

router.get('/purchases', (req, res) => {
  res.json(db.all(`SELECT p.*,u.name as user_name,u.email as user_email FROM purchases p JOIN users u ON p.user_id=u.id ORDER BY p.purchased_at DESC`));
});

router.get('/withdrawals', (req, res) => {
  res.json(db.all('SELECT * FROM withdrawals ORDER BY created_at DESC'));
});

router.post('/withdrawals', (req, res) => {
  const { amount, method, phone, note } = req.body;
  if (!amount || !method || !phone) return res.status(400).json({ error: 'Montant, méthode et numéro requis.' });
  db.run('INSERT INTO withdrawals (amount,method,phone,note) VALUES (?,?,?,?)', [parseInt(amount), method.trim(), phone.trim(), note||'']);
  res.status(201).json({ message: 'Demande créée.', id: db.lastInsertRowid() });
});

router.put('/withdrawals/:id', (req, res) => {
  const { status, note } = req.body;
  const w = db.get('SELECT * FROM withdrawals WHERE id=?', [req.params.id]);
  if (!w) return res.status(404).json({ error: 'Retrait introuvable.' });
  if (!['pending','paid','rejected'].includes(status)) return res.status(400).json({ error: 'Statut invalide.' });
  db.run('UPDATE withdrawals SET status=?,note=? WHERE id=?', [status, note||w.note, w.id]);
  res.json({ message: 'Statut mis à jour.', status });
});

module.exports = router;
