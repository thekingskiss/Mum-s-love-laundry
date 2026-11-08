import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { classifyFile, checkFiles, MAX_FILES } = require('../services/messageAttachments');

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const PDF = Buffer.from('%PDF-1.7\n%%EOF');
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0]);
const MP3 = Buffer.from('ID3\u0003\u0000\u0000\u0000\u0000\u0000\u0000');
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypmp42'), Buffer.alloc(8)]);
const WEBM = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42]);

const file = (originalname, buffer, mimetype = 'application/octet-stream') => ({ originalname, buffer, mimetype });

describe('classifyFile', () => {
  it.each([
    ['photo.png', PNG, 'image'],
    ['photo.JPG', JPEG, 'image'],
    ['song.mp3', MP3, 'audio'],
    ['note.m4a', MP4, 'audio'],
    ['clip.mp4', MP4, 'video'],
    ['receipt.pdf', PDF, 'document'],
    ['letter.docx', ZIP, 'document'],
    ['sheet.xlsx', ZIP, 'document'],
    ['notes.txt', Buffer.from('plain text'), 'document'],
  ])('accepts %s as %s', (name, buffer, kind) => {
    expect(classifyFile(file(name, buffer)).kind).toBe(kind);
  });

  it('tells an audio-only webm voice note from a webm video using the declared type', () => {
    expect(classifyFile(file('voice.webm', WEBM, 'audio/webm;codecs=opus'))).toMatchObject({ kind: 'audio', mime: 'audio/webm' });
    expect(classifyFile(file('clip.webm', WEBM, 'video/webm'))).toMatchObject({ kind: 'video', mime: 'video/webm' });
  });

  it('rejects types that are not on the allow-list, including scriptable ones', () => {
    for (const name of ['page.html', 'logo.svg', 'run.exe', 'script.js', 'noextension']) {
      expect(() => classifyFile(file(name, Buffer.from('<script>alert(1)</script>')))).toThrow(/not a supported file type/);
    }
  });

  it('rejects a file whose contents do not match its extension', () => {
    expect(() => classifyFile(file('fake.png', Buffer.from('not an image at all')))).toThrow(/does not look like a real \.png/);
    expect(() => classifyFile(file('fake.pdf', PNG))).toThrow(/does not look like a real \.pdf/);
  });

  it('rejects binary data posing as a text file', () => {
    expect(() => classifyFile(file('data.txt', Buffer.from([0x41, 0x00, 0x42])))).toThrow(/does not look like/);
  });

  it('rejects empty files', () => {
    expect(() => classifyFile(file('empty.png', Buffer.alloc(0)))).toThrow(/empty/);
  });

  it('keeps only the base name of a path-like filename', () => {
    expect(classifyFile(file('..\\..\\evil/../photo.png', PNG)).name).toBe('photo.png');
  });

  it('marks validation errors as 400s', () => {
    try {
      classifyFile(file('x.exe', PNG));
    } catch (err) {
      expect(err.status).toBe(400);
    }
  });
});

describe('checkFiles', () => {
  it('rejects more than the maximum number of files', () => {
    const files = Array.from({ length: MAX_FILES + 1 }, (_, i) => file(`p${i}.png`, PNG));
    expect(() => checkFiles(files)).toThrow(/up to/);
  });

  it('rejects a set that is too large together', () => {
    const big = Buffer.concat([PNG, Buffer.alloc(11 * 1024 * 1024)]);
    expect(() => checkFiles([file('a.png', big), file('b.png', big)])).toThrow(/too large together/);
  });
});
