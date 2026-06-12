const router         = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const db             = require('../config/db');
const { requireAuth } = require('../middleware/auth');

router.post('/', requireAuth, (req, res) => {
  const { item_id, item_type, pay_method, pay_ref } = req.body;
  if (!item_id || !item_type) return res.status(400).json({ error: 'item_id et item_type requis.' });
  if (!['album','single'].includes(item_type)) return res.status(400).json({ error: 'item_type invalide.' });

  const table = item_type === 'album' ? 'albums' : 'singles';
  const item  = db.get(`SELECT * FROM ${table} WHERE id = ? AND is_active = 1`, [item_id]);
  if (!item) return res.status(404).json({ error: 'Article introuvable.' });

  const already = db.get(
    `SELECT id FROM purchases WHERE user_id=? AND item_id=? AND item_type=? AND status='completed'`,
    [req.user.id, item_id, item_type]
  );
  if (already) return res.status(409).json({ error: 'Vous avez déjà acheté cet article.' });

  const download_token = uuidv4();
  db.run(
    `INSERT INTO purchases (user_id,item_id,item_type,amount,pay_method,pay_ref,status,download_token) VALUES (?,?,?,?,?,?,'completed',?)`,
    [req.user.id, item_id, item_type, item.price, pay_method||'orange_money', pay_ref||'', download_token]
  );
  db.run(`UPDATE ${table} SET sales = sales + 1 WHERE id = ?`, [item_id]);

  res.status(201).json({ message: 'Achat enregistré.', download_token, amount: item.price, title: item.title });
});

router.get('/my', requireAuth, (req, res) => {
  const purchases = db.all(
    `SELECT * FROM purchases WHERE user_id=? AND status='completed' ORDER BY purchased_at DESC`,
    [req.user.id]
  );
  const enriched = purchases.map(p => {
    const table = p.item_type === 'album' ? 'albums' : 'singles';
    const item  = db.get(`SELECT id,title,emoji,grad,price FROM ${table} WHERE id=?`, [p.item_id]);
    return { ...p, item };
  });
  res.json(enriched);
});

router.get('/has/:type/:id', requireAuth, (req, res) => {
  const { type, id } = req.params;
  if (!['album','single'].includes(type)) return res.status(400).json({ error: 'Type invalide.' });
  const purchase = db.get(
    `SELECT id,download_token FROM purchases WHERE user_id=? AND item_id=? AND item_type=? AND status='completed'`,
    [req.user.id, id, type]
  );
  res.json({ owned: !!purchase, download_token: purchase?.download_token || null });
});

module.exports = router;
