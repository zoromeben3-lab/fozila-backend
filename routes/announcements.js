const router = require('express').Router();
const db     = require('../config/db');
const { requireAdmin } = require('../middleware/auth');

router.get('/', (req, res) => {
  res.json(db.all('SELECT * FROM announcements WHERE is_active=1 ORDER BY id DESC').map(r => r.content));
});
router.post('/', requireAdmin, (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Contenu requis.' });
  db.run('INSERT INTO announcements (content) VALUES (?)', [content.trim()]);
  res.status(201).json({ message: 'Annonce créée.', id: db.lastInsertRowid() });
});
router.put('/:id', requireAdmin, (req, res) => {
  const { content, is_active } = req.body;
  const row = db.get('SELECT * FROM announcements WHERE id=?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Annonce introuvable.' });
  db.run('UPDATE announcements SET content=?,is_active=? WHERE id=?',
    [content||row.content, is_active!==undefined?(is_active?1:0):row.is_active, row.id]);
  res.json({ message: 'Annonce mise à jour.' });
});
router.delete('/:id', requireAdmin, (req, res) => {
  db.run('UPDATE announcements SET is_active=0 WHERE id=?', [req.params.id]);
  res.json({ message: 'Annonce désactivée.' });
});

module.exports = router;
