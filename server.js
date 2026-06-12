require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const db      = require('./config/db');

const app  = express();
const PORT = process.env.PORT || 3000;

async function startServer() {
  await db.getDb();
  console.log('✅ Base de données connectée.');

  // CORS — autoriser le frontend Render + localhost
  app.use(cors({
    origin: [
      'https://fozila-frontend-xk23.onrender.com',
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ],
    methods: ['GET','POST','PUT','DELETE'],
    allowedHeaders: ['Content-Type','Authorization']
  }));

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

  app.use('/api/auth',          require('./routes/auth'));
  app.use('/api/albums',        require('./routes/albums'));
  app.use('/api/singles',       require('./routes/singles'));
  app.use('/api/purchases',     require('./routes/purchases'));
  app.use('/api/download',      require('./routes/download'));
  app.use('/api/admin',         require('./routes/admin'));
  app.use('/api/announcements', require('./routes/announcements'));

  app.get('/api/health', (req, res) => res.json({ status: 'OK', app: 'Fozila API', version: '1.0.0' }));
  app.use('/api/*', (req, res) => res.status(404).json({ error: 'Route API introuvable.' }));

  app.use((err, req, res, next) => {
    console.error('Erreur :', err.message);
    res.status(500).json({ error: err.message || 'Erreur serveur.' });
  });

  app.listen(PORT, () => {
    console.log(`\n🎵 Fozila API démarrée`);
    console.log(`   ➜  http://localhost:${PORT}/api/health\n`);
  });
}

startServer().catch(err => { console.error('❌ Erreur démarrage :', err); process.exit(1); });
