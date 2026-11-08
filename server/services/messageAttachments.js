const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { cloudinaryConfig, cloudinaryRequest } = require('./avatarStorage');

const MESSAGE_DIR = path.join(__dirname, '..', 'uploads', 'messages');

const MAX_FILES = 5;
const MAX_FILE_BYTES = 15 * 1024 * 1024;
// Email providers commonly reject messages over ~25MB once encoded, so keep the
// whole message comfortably under that.
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;

function badFile(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

const startsWith = (buf, bytes, offset = 0) =>
  buf.length >= offset + bytes.length && bytes.every((b, i) => buf[offset + i] === b);
const ascii = (buf, start, end) => buf.subarray(start, end).toString('latin1');

const SIGNATURES = {
  jpeg: (b) => startsWith(b, [0xff, 0xd8, 0xff]),
  png: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  gif: (b) => ascii(b, 0, 4) === 'GIF8',
  webp: (b) => ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP',
  mp3: (b) => ascii(b, 0, 3) === 'ID3' || (b.length > 2 && b[0] === 0xff && (b[1] & 0xe0) === 0xe0),
  wav: (b) => ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WAVE',
  ogg: (b) => ascii(b, 0, 4) === 'OggS',
  mp4: (b) => ascii(b, 4, 8) === 'ftyp',
  webm: (b) => startsWith(b, [0x1a, 0x45, 0xdf, 0xa3]),
  pdf: (b) => ascii(b, 0, 5) === '%PDF-',
  zip: (b) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]),
  ole: (b) => startsWith(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  // Plain text has no signature; reject anything with NUL bytes (binary).
  text: (b) => !b.subarray(0, 2048).includes(0),
};

// The allow-list. Only extensions listed here are ever stored or served, which
// also keeps scriptable types (html, svg, js) from being hosted on our origin.
// `kind: null` means the type is ambiguous (webm) and is decided by the mime
// type the browser declared.
const TYPES = {
  jpg: { kind: 'image', mime: 'image/jpeg', sig: 'jpeg' },
  jpeg: { kind: 'image', mime: 'image/jpeg', sig: 'jpeg' },
  png: { kind: 'image', mime: 'image/png', sig: 'png' },
  gif: { kind: 'image', mime: 'image/gif', sig: 'gif' },
  webp: { kind: 'image', mime: 'image/webp', sig: 'webp' },
  mp3: { kind: 'audio', mime: 'audio/mpeg', sig: 'mp3' },
  m4a: { kind: 'audio', mime: 'audio/mp4', sig: 'mp4' },
  wav: { kind: 'audio', mime: 'audio/wav', sig: 'wav' },
  ogg: { kind: 'audio', mime: 'audio/ogg', sig: 'ogg' },
  mp4: { kind: 'video', mime: 'video/mp4', sig: 'mp4' },
  mov: { kind: 'video', mime: 'video/quicktime', sig: 'mp4' },
  webm: { kind: null, mime: null, sig: 'webm' },
  pdf: { kind: 'document', mime: 'application/pdf', sig: 'pdf' },
  doc: { kind: 'document', mime: 'application/msword', sig: 'ole' },
  xls: { kind: 'document', mime: 'application/vnd.ms-excel', sig: 'ole' },
  ppt: { kind: 'document', mime: 'application/vnd.ms-powerpoint', sig: 'ole' },
  docx: { kind: 'document', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', sig: 'zip' },
  xlsx: { kind: 'document', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', sig: 'zip' },
  pptx: { kind: 'document', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', sig: 'zip' },
  txt: { kind: 'document', mime: 'text/plain', sig: 'text' },
  csv: { kind: 'document', mime: 'text/csv', sig: 'text' },
};

const SUPPORTED_EXTENSIONS = Object.keys(TYPES);

// Multer decodes multipart filenames as latin1, which garbles non-ASCII names.
function readableName(originalname) {
  let name = String(originalname || '');
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  if (!decoded.includes('�')) name = decoded;
  // Keep only the base name and drop control characters and path separators.
  name = path.basename(name.replace(/\\/g, '/'));
  name = Array.from(name)
    .filter((ch) => ch.charCodeAt(0) > 0x1f && ch.charCodeAt(0) !== 0x7f && !'<>:"|?*'.includes(ch))
    .join('')
    .trim();
  if (name.length > 120) {
    const ext = path.extname(name);
    name = name.slice(0, 120 - ext.length) + ext;
  }
  return name || 'attachment';
}

/**
 * Checks one uploaded file against the allow-list and its real contents.
 * Returns { kind, mime, ext, name } or throws a 400.
 */
function classifyFile(file) {
  if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    throw badFile('One of the attachments is empty.');
  }
  const name = readableName(file.originalname);
  const ext = path.extname(name).slice(1).toLowerCase();
  const type = TYPES[ext];
  if (!type) {
    throw badFile(`"${name}" is not a supported file type. Allowed: images, audio, video, PDF, Office documents, and text files.`);
  }
  if (!SIGNATURES[type.sig](file.buffer)) {
    throw badFile(`"${name}" does not look like a real .${ext} file.`);
  }

  let { kind, mime } = type;
  if (kind === null) {
    // webm container: audio-only recordings vs. video, per what the browser said.
    const declared = String(file.mimetype || '').split(';')[0].trim().toLowerCase();
    kind = declared.startsWith('audio/') ? 'audio' : 'video';
    mime = kind === 'audio' ? 'audio/webm' : 'video/webm';
  }
  return { kind, mime, ext, name };
}

function checkFiles(files) {
  if (files.length > MAX_FILES) throw badFile(`You can attach up to ${MAX_FILES} files per message.`);
  const total = files.reduce((sum, f) => sum + (f.buffer ? f.buffer.length : 0), 0);
  if (total > MAX_TOTAL_BYTES) {
    throw badFile(`Attachments are too large together (limit ${Math.round(MAX_TOTAL_BYTES / 1024 / 1024)}MB per message).`);
  }
  return files.map((file) => ({ file, ...classifyFile(file) }));
}

const CLOUDINARY_RESOURCE = { image: 'image', audio: 'video', video: 'video', document: 'raw' };

async function storeOne({ file, kind, mime, ext, name }) {
  const id = crypto.randomUUID();
  const cloud = cloudinaryConfig();

  let url;
  if (cloud) {
    const resourceType = CLOUDINARY_RESOURCE[kind];
    // Raw files keep their extension in the public id; image/video get theirs from the format.
    const publicId = 'mums-love-laundry/messages/' + id + (resourceType === 'raw' ? '.' + ext : '');
    const payload = await cloudinaryRequest(
      'upload',
      cloud,
      { file: 'data:' + mime + ';base64,' + file.buffer.toString('base64'), public_id: publicId },
      resourceType
    );
    if (!payload.secure_url) throw new Error('Cloudinary did not return a secure URL for the attachment.');
    url = payload.secure_url;
  } else {
    await fs.promises.mkdir(MESSAGE_DIR, { recursive: true });
    const filename = id + '.' + ext;
    await fs.promises.writeFile(path.join(MESSAGE_DIR, filename), file.buffer, { flag: 'wx' });
    url = '/uploads/messages/' + filename;
  }
  return { kind, name, mime, size: file.buffer.length, url };
}

/**
 * Validates and stores the uploaded files.
 * Returns { attachments, emailAttachments }: `attachments` is the metadata saved
 * with the message; `emailAttachments` is in nodemailer's shape.
 * Validation of every file happens before any file is stored.
 */
async function prepareAttachments(files = [], { store = true } = {}) {
  if (!files.length) return { attachments: [], emailAttachments: [] };
  const checked = checkFiles(files);
  const attachments = [];
  // Email-only messages leave no in-app record, so there is nothing to store.
  if (store) for (const item of checked) attachments.push(await storeOne(item));
  const emailAttachments = checked.map(({ file, name, mime }) => ({
    filename: name,
    content: file.buffer,
    contentType: mime,
  }));
  return { attachments, emailAttachments };
}

module.exports = {
  MAX_FILES,
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
  SUPPORTED_EXTENSIONS,
  classifyFile,
  checkFiles,
  prepareAttachments,
};
