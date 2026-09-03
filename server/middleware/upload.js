const path = require('path');
const fs = require('fs');
const multer = require('multer');

const AVATAR_DIR = path.join(__dirname, '..', 'uploads', 'avatars');
fs.mkdirSync(AVATAR_DIR, { recursive: true });

const ALLOWED_MIME_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, AVATAR_DIR),
  filename: (req, file, cb) => {
    const ext = ALLOWED_MIME_TYPES[file.mimetype] || path.extname(file.originalname);
    cb(null, `user-${req.user.id}-${Date.now()}${ext}`);
  },
});

const uploadAvatar = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES[file.mimetype]) {
      return cb(new Error('Only JPEG, PNG, or WebP images are allowed.'));
    }
    cb(null, true);
  },
});

module.exports = { uploadAvatar, AVATAR_DIR };
