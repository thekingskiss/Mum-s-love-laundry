require('dotenv').config();

const fs = require('fs');
const path = require('path');
const pool = require('./config/db');
const { detectImageType, storeAvatar, deleteAvatar } = require('./services/avatarStorage');

const avatarDir = path.join(__dirname, 'uploads', 'avatars');
const typeByExtension = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

async function migrateAvatars() {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error('Set all CLOUDINARY_* values in server/.env before migrating local avatars.');
  }

  const result = await pool.query(
    "SELECT id, avatar_url FROM users WHERE avatar_url LIKE '/uploads/avatars/%' ORDER BY id"
  );
  let migrated = 0;
  let failed = 0;

  for (const user of result.rows) {
    const match = /^\/uploads\/avatars\/([A-Za-z0-9_.-]+)$/.exec(user.avatar_url);
    if (!match) {
      console.error('[avatar-migration] Refusing unexpected avatar path for user ' + user.id + '.');
      failed += 1;
      continue;
    }

    const filename = match[1];
    const extension = path.extname(filename).slice(1).toLowerCase();
    const mimetype = typeByExtension[extension];
    const localPath = path.resolve(avatarDir, filename);
    if (!mimetype || path.dirname(localPath) !== path.resolve(avatarDir)) {
      console.error('[avatar-migration] Refusing unsupported avatar file for user ' + user.id + '.');
      failed += 1;
      continue;
    }

    let cloudUrl;
    let databaseUpdated = false;
    try {
      const buffer = await fs.promises.readFile(localPath);
      if (buffer.length > 2 * 1024 * 1024) throw new Error('Image exceeds the 2MB upload limit.');
      if (detectImageType(buffer) !== mimetype) {
        throw new Error('File signature does not match its extension.');
      }
      cloudUrl = await storeAvatar(user.id, { buffer, mimetype });
      if (!/^https:\/\/res\.cloudinary\.com\//.test(cloudUrl)) {
        throw new Error('Upload did not return a Cloudinary URL.');
      }

      const updated = await pool.query(
        'UPDATE users SET avatar_url = $1 WHERE id = $2 AND avatar_url = $3',
        [cloudUrl, user.id, user.avatar_url]
      );
      if (updated.rowCount === 0) {
        await deleteAvatar(cloudUrl);
        console.log('[avatar-migration] User ' + user.id + ' changed avatar during upload; left local file in place.');
        continue;
      }
      databaseUpdated = true;
      migrated += 1;
      await fs.promises.unlink(localPath).catch((error) => {
        console.error('[avatar-migration] Cloud copy saved, but local cleanup failed for user ' + user.id + ':', error.message);
      });
      console.log('[avatar-migration] Migrated avatar for user ' + user.id + '.');
    } catch (error) {
      if (cloudUrl && !databaseUpdated) console.error('[avatar-migration] Cloud image may need cleanup after the database update failed.');
      console.error('[avatar-migration] User ' + user.id + ' failed:', error.message);
      failed += 1;
    }
  }

  console.log('[avatar-migration] Completed. Migrated: ' + migrated + '; failed: ' + failed + '.');
  if (failed) process.exitCode = 1;
}

migrateAvatars()
  .catch((error) => {
    console.error('[avatar-migration] Failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());