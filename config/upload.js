const cloudinary = require('cloudinary').v2;
const multer     = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = multer.memoryStorage();

const imageFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/') || file.originalname.match(/\.(jpg|jpeg|png|webp)$/i)) {
    cb(null, true);
  } else {
    cb(new Error('Format image non supporté.'));
  }
};

const audioFilter = (req, file, cb) => {
  const allowed = ['audio/mpeg','audio/mp3','audio/wav','audio/wave','audio/x-wav','application/octet-stream'];
  if (allowed.includes(file.mimetype) || file.originalname.match(/\.(mp3|wav)$/i)) {
    cb(null, true);
  } else {
    cb(new Error('Format audio non supporté.'));
  }
};

async function uploadImageToCloud(buffer, folder = 'fozila/covers') {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (error, result) => error ? reject(error) : resolve(result.secure_url)
    ).end(buffer);
  });
}

async function uploadAudioToCloud(buffer, filename, folder = 'fozila/music') {
  return new Promise((resolve, reject) => {
    // Sans format: 'mp3' → pas de reencodage → beaucoup plus rapide !
    cloudinary.uploader.upload_stream(
      { 
        folder,
        resource_type: 'video',
        use_filename: true,
        unique_filename: true,
      },
      (error, result) => error ? reject(error) : resolve(result.secure_url)
    ).end(buffer);
  });
}

const uploadCover = multer({ storage, fileFilter: imageFilter, limits: { fileSize: 5242880 } });
const uploadAudio = multer({ storage, fileFilter: audioFilter, limits: { fileSize: 104857600 } });

module.exports = { uploadCover, uploadAudio, uploadImageToCloud, uploadAudioToCloud };
