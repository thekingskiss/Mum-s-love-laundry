const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const AVATAR_DIR = path.join(__dirname, '..', 'uploads', 'avatars');
const EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

function badImage(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function detectImageType(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

function cloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const configured = [cloudName, apiKey, apiSecret].filter(Boolean).length;
  if (configured === 0) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cloudinary must be configured for avatar uploads in production.');
    }
    return null;
  }
  if (configured !== 3) throw new Error('Set all three CLOUDINARY_* variables together.');
  return { cloudName, apiKey, apiSecret };
}

function signature(fields, apiSecret) {
  const canonical = Object.keys(fields)
    .filter((key) => !['file', 'api_key', 'signature'].includes(key) && fields[key] !== undefined && fields[key] !== null && fields[key] !== '')
    .sort()
    .map((key) => key + '=' + fields[key])
    .join('&');
  return crypto.createHash('sha1').update(canonical + apiSecret).digest('hex');
}

async function cloudinaryRequest(action, config, fields) {
  if (typeof fetch !== 'function') throw new Error('Cloudinary avatar uploads require Node.js 18 or later.');
  const timestamp = Math.floor(Date.now() / 1000);
  const signedFields = { ...fields, timestamp };
  const bodyFields = { ...signedFields, api_key: config.apiKey, signature: signature(signedFields, config.apiSecret) };
  const body = new URLSearchParams(Object.fromEntries(
    Object.entries(bodyFields).map(([key, value]) => [key, String(value)])
  ));
  const endpoint = 'https://api.cloudinary.com/v1_1/' + encodeURIComponent(config.cloudName) + '/image/' + action;
  const response = await fetch(endpoint, { method: 'POST', body, signal: AbortSignal.timeout(30000) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) {
    const error = new Error('Cloudinary avatar ' + action + ' failed.');
    error.status = 502;
    throw error;
  }
  return payload;
}

async function storeAvatar(userId, file) {
  if (!file || !Buffer.isBuffer(file.buffer)) throw badImage('No image file was uploaded.');
  const actualType = detectImageType(file.buffer);
  if (!actualType || actualType !== file.mimetype || !EXTENSIONS[actualType]) {
    throw badImage('The uploaded file contents do not match a supported JPEG, PNG, or WebP image.');
  }

  const cloud = cloudinaryConfig();
  if (cloud) {
    const publicId = 'mums-love-laundry/avatars/user-' + userId + '-' + crypto.randomUUID();
    const payload = await cloudinaryRequest('upload', cloud, {
      file: 'data:' + actualType + ';base64,' + file.buffer.toString('base64'),
      public_id: publicId,
    });
    if (!payload.secure_url) throw new Error('Cloudinary did not return a secure avatar URL.');
    return payload.secure_url;
  }

  await fs.promises.mkdir(AVATAR_DIR, { recursive: true });
  const filename = 'user-' + userId + '-' + crypto.randomUUID() + '.' + EXTENSIONS[actualType];
  await fs.promises.writeFile(path.join(AVATAR_DIR, filename), file.buffer, { flag: 'wx' });
  return '/uploads/avatars/' + filename;
}

function localAvatarPath(url) {
  const match = /^\/uploads\/avatars\/([A-Za-z0-9_.-]+)$/.exec(url || '');
  if (!match) return null;
  const resolved = path.resolve(AVATAR_DIR, match[1]);
  return path.dirname(resolved) === path.resolve(AVATAR_DIR) ? resolved : null;
}

async function deleteAvatar(url) {
  const localPath = localAvatarPath(url);
  if (localPath) {
    await fs.promises.unlink(localPath).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
    return;
  }

  if (typeof url !== 'string') return;
  let parsed;
  try { parsed = new URL(url); } catch { return; }
  if (parsed.hostname !== 'res.cloudinary.com' || !parsed.pathname.includes('/image/upload/')) return;

  const config = cloudinaryConfig();
  if (!config) return;
  let publicId = parsed.pathname.split('/image/upload/')[1];
  const parts = publicId.split('/');
  if (parts[0] && /^v\d+$/.test(parts[0])) parts.shift();
  publicId = decodeURIComponent(parts.join('/')).replace(/\.[^.]+$/, '');
  if (publicId) await cloudinaryRequest('destroy', config, { public_id: publicId });
}

module.exports = { detectImageType, storeAvatar, deleteAvatar };