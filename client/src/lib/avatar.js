const API_ORIGIN = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

/** Avatar URLs are stored as API-relative paths for local uploads and absolute for Cloudinary. */
export function avatarSrc(url) {
  if (!url) return null;
  return url.startsWith('http') ? url : `${API_ORIGIN}${url}`;
}

/** Uploaded message attachments are stored the same way as avatars. */
export const assetSrc = avatarSrc;

export function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
