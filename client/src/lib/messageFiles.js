// Rules for files attached to a message. These mirror the server's limits
// (server/services/messageAttachments.js), which are the ones that actually
// enforce them; checking here just saves a round trip.
export const MAX_FILES = 5;
export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 20 * 1024 * 1024;

const EXTENSION_KINDS = {
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
  audio: ['mp3', 'm4a', 'wav', 'ogg'],
  video: ['mp4', 'mov'],
  document: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv'],
};

// webm can hold either; the browser's declared type decides.
export const ACCEPT = [
  ...Object.values(EXTENSION_KINDS).flat(),
  'webm',
].map((ext) => `.${ext}`).join(',');

export function extensionOf(name) {
  const dot = String(name || '').lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

/** 'image' | 'audio' | 'video' | 'document' | null (unsupported). */
export function fileKind(name, type = '') {
  const ext = extensionOf(name);
  if (ext === 'webm') return String(type).startsWith('audio/') ? 'audio' : 'video';
  for (const [kind, extensions] of Object.entries(EXTENSION_KINDS)) {
    if (extensions.includes(ext)) return kind;
  }
  return null;
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Adds `incoming` files to the `existing` list if they fit the rules.
 * Returns { files, error } — `error` explains anything that was left out.
 */
export function addFiles(existing, incoming) {
  const files = [...existing];
  const problems = [];
  let total = files.reduce((sum, f) => sum + f.size, 0);

  for (const file of incoming) {
    if (!fileKind(file.name, file.type)) {
      problems.push(`"${file.name}" is not a supported file type.`);
    } else if (file.size === 0) {
      problems.push(`"${file.name}" is empty.`);
    } else if (file.size > MAX_FILE_BYTES) {
      problems.push(`"${file.name}" is over ${formatBytes(MAX_FILE_BYTES)}.`);
    } else if (files.length >= MAX_FILES) {
      problems.push(`You can attach up to ${MAX_FILES} files.`);
    } else if (total + file.size > MAX_TOTAL_BYTES) {
      problems.push(`"${file.name}" would take the message over ${formatBytes(MAX_TOTAL_BYTES)} in total.`);
    } else {
      files.push(file);
      total += file.size;
    }
  }
  return { files, error: [...new Set(problems)].join(' ') };
}
