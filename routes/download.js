const router = require('express').Router();
const db     = require('../config/db');
const path   = require('path');
const fs     = require('fs');

// ── Vérifier le token ──
function verifyToken(token) {
  if (!token || token.length < 10) return null;
  return db.get(
    `SELECT * FROM purchases WHERE download_token=? AND status='completed'`,
    [token]
  );
}

// ── Envoyer un fichier audio ──
function sendAudio(req, res, filePath, fileName) {
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Fichier audio introuvable sur le serveur.' });
  }

  const stat     = fs.statSync(filePath);
  const ext      = path.extname(filePath).toLowerCase();
  const mime     = ext === '.wav' ? 'audio/wav' : 'audio/mpeg';
  const isStream = req.query.dl === '0'; // ?dl=0 = streaming, sinon téléchargement

  if (!isStream) {
    // ── TÉLÉCHARGEMENT ──
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Length', stat.size);
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  // ── STREAMING avec support Range ──
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', mime);

  const range = req.headers.range;
  if (range) {
    const parts  = range.replace(/bytes=/, '').split('-');
    const start  = parseInt(parts[0], 10);
    const end    = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    const chunk  = end - start + 1;

    res.writeHead(206, {
      'Content-Range':  `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges':  'bytes',
      'Content-Length': chunk,
      'Content-Type':   mime,
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': stat.size,
      'Content-Type':   mime,
      'Accept-Ranges':  'bytes',
    });
    fs.createReadStream(filePath).pipe(res);
  }
}

// ── Nom de fichier sécurisé ──
function safeName(title) {
  return title.replace(/[^a-zA-Z0-9\s\-_]/g, '').trim().replace(/\s+/g, '_') || 'Fozila';
}

// ────────────────────────────────────────────
// GET /api/download/:token — single ou album
// ────────────────────────────────────────────
router.get('/:token', (req, res) => {
  const purchase = verifyToken(req.params.token);
  if (!purchase) return res.status(403).json({ error: 'Token invalide ou achat introuvable.' });

  const table = purchase.item_type === 'album' ? 'albums' : 'singles';
  const item  = db.get(`SELECT title, file_path FROM ${table} WHERE id=?`, [purchase.item_id]);

  if (!item || !item.file_path)
    return res.status(404).json({ error: 'Fichier non encore disponible. Contactez le support.' });

  const filePath = path.join(__dirname, '..', item.file_path);
  const ext      = path.extname(filePath);
  const fileName = `Fozila_${safeName(item.title)}${ext}`;

  sendAudio(req, res, filePath, fileName);
});

// ────────────────────────────────────────────
// GET /api/download/:token/tracks — liste des titres
// ────────────────────────────────────────────
router.get('/:token/tracks', (req, res) => {
  const purchase = verifyToken(req.params.token);
  if (!purchase) return res.status(403).json({ error: 'Token invalide.' });
  if (purchase.item_type !== 'album') return res.status(400).json({ error: 'Pas un album.' });

  const tracks = db.all(
    'SELECT id, title, track_num, file_path FROM tracks WHERE album_id=? ORDER BY track_num ASC',
    [purchase.item_id]
  );
  res.json(tracks);
});

// ────────────────────────────────────────────
// GET /api/download/:token/track/:trackId — titre spécifique
// ────────────────────────────────────────────
router.get('/:token/track/:trackId', (req, res) => {
  const purchase = verifyToken(req.params.token);
  if (!purchase) return res.status(403).json({ error: 'Token invalide.' });
  if (purchase.item_type !== 'album')
    return res.status(400).json({ error: 'Ce token est pour un single.' });

  const track = db.get(
    'SELECT * FROM tracks WHERE id=? AND album_id=?',
    [req.params.trackId, purchase.item_id]
  );

  if (!track || !track.file_path)
    return res.status(404).json({ error: 'Track introuvable ou sans fichier audio.' });

  const filePath = path.join(__dirname, '..', track.file_path);
  const num      = String(track.track_num).padStart(2, '0');
  const fileName = `${num}_${safeName(track.title)}${path.extname(filePath)}`;

  sendAudio(req, res, filePath, fileName);
});

module.exports = router;
