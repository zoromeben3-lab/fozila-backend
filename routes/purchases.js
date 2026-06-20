const router         = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const db             = require('../config/db');
const { requireAuth } = require('../middleware/auth');

// ── MIGRATION: ajouter colonne ticket_number si elle n'existe pas ──
try {
  db.run("ALTER TABLE purchases ADD COLUMN ticket_number TEXT DEFAULT ''");
  console.log('✅ Colonne ticket_number ajoutée à purchases');
} catch(e) {
  // Colonne déjà existante - OK
}

// POST /api/purchases — créer une demande d'achat (en attente de validation)
router.post('/', requireAuth, (req, res) => {
  const { item_id, item_type, pay_method, pay_ref } = req.body;
  if (!item_id || !item_type) return res.status(400).json({ error: 'item_id et item_type requis.' });
  if (!['album','single'].includes(item_type)) return res.status(400).json({ error: 'item_type invalide.' });
  if (!pay_ref || !pay_ref.trim()) return res.status(400).json({ error: 'Le numéro de dépôt (ID de transaction) est requis.' });

  const table = item_type === 'album' ? 'albums' : 'singles';
  const item  = db.get(`SELECT * FROM ${table} WHERE id = ? AND is_active = 1`, [item_id]);
  if (!item) return res.status(404).json({ error: 'Article introuvable.' });

  // Déjà acheté (complété) ?
  const already = db.get(
    `SELECT id FROM purchases WHERE user_id=? AND item_id=? AND item_type=? AND status='completed'`,
    [req.user.id, item_id, item_type]
  );
  if (already) return res.status(409).json({ error: 'Vous avez déjà acheté cet article.' });

  // Déjà une demande en attente pour ce même article ?
  const pendingExisting = db.get(
    `SELECT id FROM purchases WHERE user_id=? AND item_id=? AND item_type=? AND status='pending'`,
    [req.user.id, item_id, item_type]
  );
  if (pendingExisting) return res.status(409).json({ error: 'Une demande est déjà en attente de validation pour cet article.' });

  db.run(
    `INSERT INTO purchases (user_id,item_id,item_type,amount,pay_method,pay_ref,status,download_token)
     VALUES (?,?,?,?,?,?,'pending','')`,
    [req.user.id, item_id, item_type, item.price, pay_method||'orange_money', pay_ref.trim()]
  );

  res.status(201).json({
    message: 'Demande envoyée. Elle sera validée dès que le paiement sera confirmé.',
    amount: item.price,
    title: item.title,
    status: 'pending'
  });
});

// GET /api/purchases/my — mes achats validés
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

// GET /api/purchases/my/pending — mes demandes en attente
router.get('/my/pending', requireAuth, (req, res) => {
  const purchases = db.all(
    `SELECT * FROM purchases WHERE user_id=? AND status='pending' ORDER BY purchased_at DESC`,
    [req.user.id]
  );
  const enriched = purchases.map(p => {
    const table = p.item_type === 'album' ? 'albums' : 'singles';
    const item  = db.get(`SELECT id,title,emoji,grad,price FROM ${table} WHERE id=?`, [p.item_id]);
    return { ...p, item };
  });
  res.json(enriched);
});

// GET /api/purchases/my/tickets — tous mes tickets (achats validés)
router.get('/my/tickets', requireAuth, (req, res) => {
  const tickets = db.all(
    `SELECT ticket_number, item_id, item_type, purchased_at FROM purchases WHERE user_id=? AND status='completed' AND ticket_number != '' ORDER BY purchased_at DESC`,
    [req.user.id]
  );
  res.json(tickets);
});

router.get('/has/:type/:id', requireAuth, (req, res) => {
  const { type, id } = req.params;
  if (!['album','single'].includes(type)) return res.status(400).json({ error: 'Type invalide.' });
  const purchase = db.get(
    `SELECT id,download_token FROM purchases WHERE user_id=? AND item_id=? AND item_type=? AND status='completed'`,
    [req.user.id, id, type]
  );
  const pending = db.get(
    `SELECT id FROM purchases WHERE user_id=? AND item_id=? AND item_type=? AND status='pending'`,
    [req.user.id, id, type]
  );
  res.json({ owned: !!purchase, pending: !!pending, download_token: purchase?.download_token || null });
});

module.exports = router;
