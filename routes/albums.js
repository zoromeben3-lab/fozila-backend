const router = require('express').Router();
const db     = require('../config/db');
const path   = require('path');
const { requireAdmin } = require('../middleware/auth');
const { uploadAudio, uploadCover } = require('../config/upload');

// GET /api/albums
router.get('/', (req, res) => {
  const { genre, sort, q } = req.query;
  let sql = 'SELECT * FROM albums WHERE is_active = 1';
  const params = [];
  if (genre && genre !== 'all') { sql += ' AND genre = ?'; params.push(genre); }
  if (q) {
    sql += ' AND (title LIKE ? OR genre LIKE ? OR artist LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const sortMap = { 'price-asc':'price ASC','price-desc':'price DESC','popular':'sales DESC','newest':'year DESC' };
  sql += ` ORDER BY ${sortMap[sort] || 'id ASC'}`;
  res.json(db.all(sql, params));
});

// GET /api/albums/:id
router.get('/:id', (req, res) => {
  const album = db.get('SELECT * FROM albums WHERE id = ? AND is_active = 1', [req.params.id]);
  if (!album) return res.status(404).json({ error: 'Album introuvable.' });
  res.json(album);
});

// GET /api/albums/:id/tracks
router.get('/:id/tracks', (req, res) => {
  const tracks = db.all('SELECT * FROM tracks WHERE album_id = ? ORDER BY track_num ASC', [req.params.id]);
  res.json(tracks);
});

// POST /api/albums (admin) — créer un album avec cover optionnelle
router.post('/', requireAdmin, (req, res) => {
  uploadCover.single('cover')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });

    const { title, artist, genre, tracks, year, price, emoji, grad, tag, featured, description } = req.body;
    if (!title || !genre || !price || !year)
      return res.status(400).json({ error: 'Titre, genre, prix et année requis.' });

    const cover_path = req.file ? `/uploads/covers/${req.file.filename}` : '';

    db.run(
      `INSERT INTO albums (title,artist,genre,tracks,year,price,emoji,grad,tag,featured,description,cover_path)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [title.trim(), artist?.trim()||'Artiste Fozila', genre.trim(),
       parseInt(tracks)||1, parseInt(year), parseInt(price),
       emoji||'🎵', grad||'linear-gradient(135deg,#1a0533,#4c1d95)',
       tag||'', featured?1:0, description||'', cover_path]
    );
    const album = db.get('SELECT * FROM albums WHERE id = ?', [db.lastInsertRowid()]);
    res.status(201).json({ message: 'Album créé.', album });
  });
});

// PUT /api/albums/:id (admin) — modifier un album
router.put('/:id', requireAdmin, (req, res) => {
  uploadCover.single('cover')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });

    const album = db.get('SELECT * FROM albums WHERE id = ?', [req.params.id]);
    if (!album) return res.status(404).json({ error: 'Album introuvable.' });

    const { title, artist, genre, tracks, year, price, emoji, grad, tag, featured, description, is_active } = req.body;
    const cover_path = req.file ? `/uploads/covers/${req.file.filename}` : album.cover_path;

    db.run(
      `UPDATE albums SET title=?,artist=?,genre=?,tracks=?,year=?,price=?,emoji=?,grad=?,tag=?,featured=?,description=?,cover_path=?,is_active=? WHERE id=?`,
      [title?.trim()||album.title, artist?.trim()||album.artist, genre?.trim()||album.genre,
       parseInt(tracks)||album.tracks, parseInt(year)||album.year, parseInt(price)||album.price,
       emoji||album.emoji, grad||album.grad, tag??album.tag,
       featured!==undefined?(featured?1:0):album.featured,
       description??album.description, cover_path,
       is_active!==undefined?(is_active?1:0):album.is_active, album.id]
    );
    res.json({ message: 'Album mis à jour.', album: db.get('SELECT * FROM albums WHERE id = ?', [album.id]) });
  });
});

// PUT /api/albums/:id/audio (admin) — upload plusieurs MP3
router.put('/:id/audio', requireAdmin, (req, res) => {
  uploadAudio.array('audio', 30)(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });

    const album = db.get('SELECT * FROM albums WHERE id = ?', [req.params.id]);
    if (!album) return res.status(404).json({ error: 'Album introuvable.' });

    const files = req.files;
    if (!files || files.length === 0)
      return res.status(400).json({ error: 'Aucun fichier audio reçu.' });

    let count = db.get('SELECT COUNT(*) as c FROM tracks WHERE album_id = ?', [album.id]).c;
    const uploaded = [];

    files.forEach((file, i) => {
      const file_path    = `/uploads/music/${file.filename}`;
      const originalName = file.originalname.replace(/\.[^/.]+$/, '');
      const track_num    = count + i + 1;

      db.run(
        'INSERT INTO tracks (album_id, title, track_num, file_path) VALUES (?, ?, ?, ?)',
        [album.id, originalName, track_num, file_path]
      );
      uploaded.push({ track_num, title: originalName, file_path });
    });

    // Mettre à jour file_path de l'album avec le premier fichier
    if (!album.file_path && uploaded.length > 0) {
      db.run('UPDATE albums SET file_path = ? WHERE id = ?', [uploaded[0].file_path, album.id]);
    }

    // Mettre à jour le nombre de titres dans l'album
    const totalTracks = db.get('SELECT COUNT(*) as c FROM tracks WHERE album_id = ?', [album.id]).c;
    db.run('UPDATE albums SET tracks = ? WHERE id = ?', [totalTracks, album.id]);

    res.json({ message: `${files.length} fichier(s) uploadé(s).`, tracks: uploaded, total: totalTracks });
  });
});

// DELETE /api/albums/:id (admin)
router.delete('/:id', requireAdmin, (req, res) => {
  const album = db.get('SELECT * FROM albums WHERE id = ?', [req.params.id]);
  if (!album) return res.status(404).json({ error: 'Album introuvable.' });
  db.run('UPDATE albums SET is_active = 0 WHERE id = ?', [album.id]);
  res.json({ message: 'Album supprimé.' });
});

module.exports = router;
