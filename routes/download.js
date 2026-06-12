const router = require('express').Router();
const db     = require('../config/db');
const https  = require('https');
const http   = require('http');

// Vérifier le token
function verifyToken(token) {
  if (!token || token.length < 10) return null;
  return db.get(`SELECT * FROM purchases WHERE download_token=? AND status='completed'`, [token]);
}

// Streamer une URL Cloudinary vers le client
function streamFromUrl(url, res, fileName, isDownload) {
  const proto = url.startsWith('https') ? https : http;
  proto.get(url, (cloudRes) => {
    const contentType = cloudRes.headers['content-type'] || 'audio/mpeg';
    if (isDownload) {
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    }
    res.setHeader('Content-Type', contentType);
    if (cloudRes.headers['content-length']) {
      res.setHeader('Content-Length', cloudRes.headers['content-length']);
    }
    cloudRes.pipe(res);
  }).on('error', (e) => {
    if (!res.headersSent) res.status(500).json({ error: 'Erreur streaming: ' + e.message });
  });
}

function safeName(title) {
  return (title || 'Fozila').replace(/[^a-zA-Z0-9\s\-_]/g, '').trim().replace(/\s+/g, '_');
}

// GET /api/download/:token
router.get('/:token', (req, res) => {
  const purchase = verifyToken(req.params.token);
  if (!purchase) return res.status(403).json({ error: 'Token invalide.' });

  const table = purchase.item_type === 'album' ? 'albums' : 'singles';
  const item  = db.get(`SELECT title, file_path FROM ${table} WHERE id=?`, [purchase.item_id]);
  if (!item || !item.file_path)
    return res.status(404).json({ error: 'Fichier non encore disponible.' });

  const isStream   = req.query.dl === '0';
  const fileName   = `Fozila_${safeName(item.title)}.mp3`;
  streamFromUrl(item.file_path, res, fileName, !isStream);
});

// GET /api/download/:token/tracks
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

// GET /api/download/:token/track/:trackId
router.get('/:token/track/:trackId', (req, res) => {
  const purchase = verifyToken(req.params.token);
  if (!purchase) return res.status(403).json({ error: 'Token invalide.' });

  const track = db.get(
    'SELECT * FROM tracks WHERE id=? AND album_id=?',
    [req.params.trackId, purchase.item_id]
  );
  if (!track || !track.file_path) return res.status(404).json({ error: 'Track introuvable.' });

  const isStream = req.query.dl === '0';
  const num      = String(track.track_num).padStart(2, '0');
  const fileName = `${num}_${safeName(track.title)}.mp3`;
  streamFromUrl(track.file_path, res, fileName, !isStream);
});

module.exports = router;
