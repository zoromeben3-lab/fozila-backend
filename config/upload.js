// ══════════════════════════════════════════════════
//  FOZILA — Configuration upload fichiers (Multer v2)
// ══════════════════════════════════════════════════

const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

// Créer les dossiers si absents
['./uploads/music', './uploads/covers'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ── Stockage fichiers audio ──
const audioStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, './uploads/music'),
  filename:    (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  }
});

// ── Stockage covers ──
const coverStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, './uploads/covers'),
  filename:    (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const name = `cover-${Date.now()}${ext}`;
    cb(null, name);
  }
});

// ── Filtres MIME ──
const audioFilter = (req, file, cb) => {
  // Accepter MP3, WAV, et aussi application/octet-stream (certains navigateurs Windows)
  const allowedMime = ['audio/mpeg','audio/mp3','audio/wav','audio/wave','audio/x-wav','application/octet-stream'];
  const allowedExt  = /\.(mp3|wav|MP3|WAV)$/;
  if (allowedMime.includes(file.mimetype) || allowedExt.test(file.originalname)) {
    cb(null, true);
  } else {
    console.log('Fichier rejeté:', file.mimetype, file.originalname);
    cb(new Error(`Format non supporté: ${file.mimetype}. Utilisez MP3 ou WAV.`));
  }
};

const imageFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/') || file.originalname.match(/\.(jpg|jpeg|png|webp)$/i)) {
    cb(null, true);
  } else {
    cb(new Error('Format image non supporté. Utilisez JPG, PNG ou WebP.'));
  }
};

// ── Exportation ──
const uploadAudio = multer({
  storage:    audioStorage,
  fileFilter: audioFilter,
  limits:     { fileSize: 104857600 } // 100 Mo
});

const uploadCover = multer({
  storage:    coverStorage,
  fileFilter: imageFilter,
  limits:     { fileSize: 5242880 } // 5 Mo
});

module.exports = { uploadAudio, uploadCover };
