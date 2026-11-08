import { describe, expect, it } from 'vitest';
import { addFiles, fileKind, formatBytes, MAX_FILES, MAX_FILE_BYTES } from './messageFiles';

const file = (name, size = 100, type = '') => ({ name, size, type });

describe('fileKind', () => {
  it('sorts files by extension', () => {
    expect(fileKind('a.PNG')).toBe('image');
    expect(fileKind('a.mp3')).toBe('audio');
    expect(fileKind('a.mp4')).toBe('video');
    expect(fileKind('a.pdf')).toBe('document');
    expect(fileKind('a.docx')).toBe('document');
  });

  it('uses the declared type to tell webm audio from webm video', () => {
    expect(fileKind('voice.webm', 'audio/webm')).toBe('audio');
    expect(fileKind('clip.webm', 'video/webm')).toBe('video');
  });

  it('returns null for unsupported types', () => {
    expect(fileKind('page.html')).toBeNull();
    expect(fileKind('logo.svg')).toBeNull();
    expect(fileKind('noextension')).toBeNull();
  });
});

describe('formatBytes', () => {
  it('formats sizes for people', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

describe('addFiles', () => {
  it('adds valid files', () => {
    const { files, error } = addFiles([], [file('a.png'), file('b.pdf')]);
    expect(files).toHaveLength(2);
    expect(error).toBe('');
  });

  it('leaves out unsupported, empty and oversize files and says why', () => {
    const { files, error } = addFiles([], [file('a.html'), file('b.png', 0), file('c.mp4', MAX_FILE_BYTES + 1), file('ok.png')]);
    expect(files.map((f) => f.name)).toEqual(['ok.png']);
    expect(error).toMatch(/a\.html/);
    expect(error).toMatch(/b\.png/);
    expect(error).toMatch(/c\.mp4/);
  });

  it('stops at the file-count limit', () => {
    const existing = Array.from({ length: MAX_FILES }, (_, i) => file(`p${i}.png`));
    const { files, error } = addFiles(existing, [file('extra.png')]);
    expect(files).toHaveLength(MAX_FILES);
    expect(error).toMatch(/up to/);
  });

  it('stops at the combined-size limit', () => {
    const big = 11 * 1024 * 1024;
    const { files, error } = addFiles([file('a.mp4', big)], [file('b.mp4', big)]);
    expect(files).toHaveLength(1);
    expect(error).toMatch(/in total/);
  });
});
