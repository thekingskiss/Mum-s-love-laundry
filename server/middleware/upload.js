const multer = require('multer');
const { MAX_FILES, MAX_FILE_BYTES } = require('../services/messageAttachments');

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      const error = new Error('Only JPEG, PNG, or WebP images are allowed.');
      error.status = 400;
      return cb(error);
    }
    cb(null, true);
  },
});

// Files attached to admin messages. Type checking happens in
// services/messageAttachments (it needs the file contents, which multer's
// fileFilter can't see), so only the size/count limits live here.
const uploadMessageFiles = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES },
}).array('attachments', MAX_FILES);

// Turns multer's own errors into the same 400s the rest of the API returns.
function messageUploads(req, res, next) {
  uploadMessageFiles(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const message = {
        LIMIT_FILE_SIZE: `Each attachment must be ${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB or smaller.`,
        LIMIT_FILE_COUNT: `You can attach up to ${MAX_FILES} files per message.`,
        LIMIT_UNEXPECTED_FILE: `You can attach up to ${MAX_FILES} files per message.`,
      }[err.code] || 'The attachments could not be read.';
      const error = new Error(message);
      error.status = 400;
      return next(error);
    }
    return next(err);
  });
}

module.exports = { uploadAvatar, messageUploads };