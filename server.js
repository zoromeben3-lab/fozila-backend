require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const path    = require('path');
const db      = require('./config/db');

const app  = express();
const PORT = process.env.PORT || 3000;

async function startServer() {
  await db.getDb();
  console.log('✅ Base de données connectée.');

  // ── SÉCURITÉ : en-têtes HTTP (Helmet) ──
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc:    ["'self'"],
        scriptSrc:     ["'self'", "'unsafe-inline'"],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc:      ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc:       ["'self'", "https://fonts.gstatic.com"],
        imgSrc:        ["'self'", "data:", "https:"],
        mediaSrc:      ["'self'", "https:"],
        connectSrc:    ["'self'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));
  app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // CORS
  app.use(cors({
    origin: '*',
    methods: ['GET','POST','PUT','DELETE'],
    allowedHeaders: ['Content-Type','Authorization']
  }));

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Fichiers uploadés
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

  // Frontend statique depuis /public avec bons headers
  const FRONTEND_PATH = path.join(__dirname, 'public');
  app.use(express.static(FRONTEND_PATH, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('sw.js')) {
        res.setHeader('Content-Type', 'application/javascript');
        res.setHeader('Cache-Control', 'no-cache');
      }
      if (filePath.endsWith('manifest.json')) {
        res.setHeader('Content-Type', 'application/manifest+json');
        res.setHeader('Cache-Control', 'no-cache');
      }
    }
  }));

  // Routes API
  app.use('/api/auth',          require('./routes/auth'));
  app.use('/api/albums',        require('./routes/albums'));
  app.use('/api/singles',       require('./routes/singles'));
  app.use('/api/purchases',     require('./routes/purchases'));
  app.use('/api/download',      require('./routes/download'));
  app.use('/api/admin',         require('./routes/admin'));
  app.use('/api/announcements', require('./routes/announcements'));

  app.get('/api/health', (req, res) => res.json({ status: 'OK', app: 'Fozila API', version: '1.0.0' }));
  app.use('/api/*', (req, res) => res.status(404).json({ error: 'Route API introuvable.' }));

  // Toutes les autres routes → index.html
  app.get('*', (req, res) => {
    res.sendFile(path.join(FRONTEND_PATH, 'index.html'));
  });

  app.use((err, req, res, next) => {
    console.error('Erreur :', err.message);
    res.status(500).json({ error: err.message || 'Erreur serveur.' });
  });

  app.listen(PORT, () => {
    console.log(`\n🎵 Fozila API démarrée`);
    console.log(`   ➜  http://localhost:${PORT}\n`);
  });
}

startServer().catch(err => { console.error('❌ Erreur démarrage :', err); process.exit(1); });
