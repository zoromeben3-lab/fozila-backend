const router = require('express').Router();
const db     = require('../config/db');
const { requireAdmin } = require('../middleware/auth');
const { uploadCover, uploadAudio } = require('../config/upload');

// GET /api/singles
router.get('/', (req, res) => {
  const { genre, featured, q } = req.query;
  let sql = 'SELECT * FROM singles WHERE is_active = 1 AND live = 1';
  const params = [];
  if (genre && genre !== 'all') { sql += ' AND genre = ?'; params.push(genre); }
  if (featured === 'true') sql += ' AND featured = 1';
  if (q) { sql += ' AND (title LIKE ? OR genre LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
  sql += ' ORDER BY sales DESC';
  res.json(db.all(sql, params));
});

// GET /api/singles/:id
router.get('/:id', (req, res) => {
  const single = db.get('SELECT * FROM singles WHERE id = ? AND is_active = 1', [req.params.id]);
  if (!single) return res.status(404).json({ error: 'Single introuvable.' });
  res.json(single);
});

// POST /api/singles (admin)
router.post('/', requireAdmin, (req, res) => {
  uploadCover.single('cover')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    const { title, artist, genre, price, duration, emoji, grad, featured, live } = req.body;
    if (!title || !genre || !price) return res.status(400).json({ error: 'Titre, genre et prix requis.' });
    const cover_path = req.file ? `/uploads/covers/${req.file.filename}` : '';
    db.run(
      `INSERT INTO singles (title,artist,genre,price,duration,emoji,grad,featured,live,cover_path) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [title.trim(), artist?.trim()||'Artiste Fozila', genre.trim(), parseInt(price),
       duration||'3:30', emoji||'🎵', grad||'linear-gradient(135deg,#1a0533,#7c3aed)',
       featured?1:0, live!==undefined?(live?1:0):1, cover_path]
    );
    res.status(201).json({ message: 'Single créé.', single: db.get('SELECT * FROM singles WHERE id = ?', [db.lastInsertRowid()]) });
  });
});

// PUT /api/singles/:id (admin)
router.put('/:id', requireAdmin, (req, res) => {
  uploadCover.single('cover')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    const single = db.get('SELECT * FROM singles WHERE id = ?', [req.params.id]);
    if (!single) return res.status(404).json({ error: 'Single introuvable.' });
    const { title, artist, genre, price, duration, emoji, grad, featured, live, is_active } = req.body;
    const cover_path = req.file ? `/uploads/covers/${req.file.filename}` : single.cover_path;
    db.run(
      `UPDATE singles SET title=?,artist=?,genre=?,price=?,duration=?,emoji=?,grad=?,featured=?,live=?,cover_path=?,is_active=? WHERE id=?`,
      [title?.trim()||single.title, artist?.trim()||single.artist, genre?.trim()||single.genre,
       parseInt(price)||single.price, duration||single.duration, emoji||single.emoji, grad||single.grad,
       featured!==undefined?(featured?1:0):single.featured, live!==undefined?(live?1:0):single.live,
       cover_path, is_active!==undefined?(is_active?1:0):single.is_active, single.id]
    );
    res.json({ message: 'Single mis à jour.', single: db.get('SELECT * FROM singles WHERE id = ?', [single.id]) });
  });
});

// PUT /api/singles/:id/audio (admin)
router.put('/:id/audio', requireAdmin, (req, res) => {
  uploadAudio.single('audio')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    const single = db.get('SELECT * FROM singles WHERE id = ?', [req.params.id]);
    if (!single) return res.status(404).json({ error: 'Single introuvable.' });
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier audio reçu.' });
    const file_path = `/uploads/music/${req.file.filename}`;
    db.run('UPDATE singles SET file_path = ? WHERE id = ?', [file_path, single.id]);
    res.json({ message: 'Fichier audio uploadé.', file_path });
  });
});

// DELETE /api/singles/:id (admin)
router.delete('/:id', requireAdmin, (req, res) => {
  const single = db.get('SELECT * FROM singles WHERE id = ?', [req.params.id]);
  if (!single) return res.status(404).json({ error: 'Single introuvable.' });
  db.run('UPDATE singles SET is_active = 0 WHERE id = ?', [single.id]);
  res.json({ message: 'Single supprimé.' });
});

module.exports = router;
