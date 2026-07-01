const router         = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const db             = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const nodemailer     = require('nodemailer');

// ── NOTIFICATION EMAIL ──
async function sendOrderNotification(purchase, user, item) {
  const adminEmail = process.env.ADMIN_EMAIL_NOTIF;
  const gmailUser  = process.env.GMAIL_USER;
  const gmailPass  = process.env.GMAIL_PASS;

  console.log('📧 GMAIL_USER:', gmailUser);
  console.log('📧 GMAIL_PASS exists:', !!gmailPass);
  console.log('📧 ADMIN_EMAIL_NOTIF:', adminEmail);

  if (!adminEmail || !gmailUser || !gmailPass) {
    console.error('❌ Variables email manquantes');
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailUser, pass: gmailPass },
  });

  try {
    await transporter.sendMail({
      from: `"Fôliza" <${gmailUser}>`,
      to: adminEmail,
      subject: `🎵 Nouvelle commande en attente — ${user.name}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f0f0f;color:#f0f0f0;border-radius:12px;overflow:hidden;">
          <div style="background:#7C3AED;padding:24px;text-align:center;">
            <h1 style="margin:0;font-size:24px;color:#fff;">Fôliza</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Nouvelle commande en attente de validation</p>
          </div>
          <div style="padding:28px;">
            <h2 style="color:#A78BFA;font-size:18px;margin-bottom:20px;">Détails de la commande</h2>
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:8px 0;color:#888;font-size:14px;">👤 Client</td><td style="padding:8px 0;font-weight:bold;">${user.name}</td></tr>
              <tr><td style="padding:8px 0;color:#888;font-size:14px;">📱 Téléphone</td><td style="padding:8px 0;">${user.phone || 'Non renseigné'}</td></tr>
              <tr><td style="padding:8px 0;color:#888;font-size:14px;">🎵 Article</td><td style="padding:8px 0;">${item.title} (${purchase.item_type === 'album' ? 'Album' : 'Single'})</td></tr>
              <tr><td style="padding:8px 0;color:#888;font-size:14px;">💰 Montant</td><td style="padding:8px 0;color:#A78BFA;font-weight:bold;">${Number(item.price).toLocaleString('fr-FR')} FCFA</td></tr>
              <tr><td style="padding:8px 0;color:#888;font-size:14px;">🧾 N° de dépôt</td><td style="padding:8px 0;font-family:monospace;background:#1a1a1a;padding:4px 8px;border-radius:4px;">${purchase.pay_ref}</td></tr>
              <tr><td style="padding:8px 0;color:#888;font-size:14px;">🕐 Date</td><td style="padding:8px 0;">${new Date().toLocaleString('fr-FR')}</td></tr>
            </table>
            <div style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:16px;margin-top:24px;">
              <p style="margin:0 0 12px;font-weight:bold;color:#f0a500;">⚠️ Ce que vous devez faire :</p>
              <ol style="margin:0;padding-left:20px;color:#ccc;font-size:14px;line-height:1.8;">
                <li>Vérifiez votre <strong>Orange Money</strong> — avez-vous reçu <strong>${Number(item.price).toLocaleString('fr-FR')} FCFA</strong> ?</li>
                <li>Le numéro de dépôt fourni est : <strong style="color:#A78BFA;">${purchase.pay_ref}</strong></li>
                <li>Si le paiement est confirmé → <strong style="color:#22c55e;">Validez</strong> la commande</li>
                <li>Si vous n'avez rien reçu → <strong style="color:#ef4444;">Rejetez</strong> la commande</li>
              </ol>
            </div>
            <div style="text-align:center;margin-top:24px;">
              <a href="https://xn--fliza-6ta.com/admin.html" style="display:inline-block;background:#7C3AED;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">👉 Accéder au dashboard admin</a>
            </div>
          </div>
          <div style="padding:16px;text-align:center;border-top:1px solid #222;color:#555;font-size:12px;">
            Cet email est envoyé automatiquement par Fôliza à chaque nouvelle commande.
          </div>
        </div>
      `,
    });
    console.log('✅ Email notification envoyé à', adminEmail);
  } catch(err) {
    console.error('❌ Erreur envoi email:', err.message);
  }
}

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

  const already = db.get(
    `SELECT id FROM purchases WHERE user_id=? AND item_id=? AND item_type=? AND status='completed'`,
    [req.user.id, item_id, item_type]
  );
  if (already) return res.status(409).json({ error: 'Vous avez déjà acheté cet article.' });

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

  const userInfo = db.get('SELECT * FROM users WHERE id=?', [req.user.id]);
  const purchaseData = { item_id, item_type, pay_method: pay_method||'orange_money', pay_ref: pay_ref.trim() };
  sendOrderNotification(purchaseData, userInfo, item).catch(console.error);

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

// GET /api/purchases/my/tickets — tous mes tickets
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
