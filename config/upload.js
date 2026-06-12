// ══════════════════════════════════════════════════
//  FOZILA — Upload via Cloudinary
//  Images + Audio stockés dans le cloud
// ══════════════════════════════════════════════════

const cloudinary   = require('cloudinary').v2;
const multer       = require('multer');
const path         = require('path');
const fs           = require('fs');

// Configuration Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Stockage temporaire en mémoire (pas sur disque)
const storage = multer.memoryStorage();

// Filtre images
const imageFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/') || file.originalname.match(/\.(jpg|jpeg|png|webp)$/i)) {
    cb(null, true);
  } else {
    cb(new Error('Format image non supporté.'));
  }
};

// Filtre audio
const audioFilter = (req, file, cb) => {
  const allowed = ['audio/mpeg','audio/mp3','audio/wav','audio/wave','audio/x-wav','application/octet-stream'];
  if (allowed.includes(file.mimetype) || file.originalname.match(/\.(mp3|wav)$/i)) {
    cb(null, true);
  } else {
    cb(new Error('Format audio non supporté.'));
  }
};

// Uploader une image vers Cloudinary
async function uploadImageToCloud(buffer, folder = 'fozila/covers') {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

// Uploader un audio vers Cloudinary
async function uploadAudioToCloud(buffer, filename, folder = 'fozila/music') {
  return new Promise((resolve, reject) => {
    const publicId = folder + '/' + Date.now() + '-' + Math.random().toString(36).slice(2);
    const stream = cloudinary.uploader.upload_stream(
      { 
        folder,
        resource_type: 'video', // Cloudinary utilise 'video' pour l'audio
        public_id: publicId,
        format: 'mp3'
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

const uploadCover = multer({ storage, fileFilter: imageFilter, limits: { fileSize: 5242880 } });
const uploadAudio = multer({ storage, fileFilter: audioFilter, limits: { fileSize: 104857600 } });

module.exports = { uploadCover, uploadAudio, uploadImageToCloud, uploadAudioToCloud };
