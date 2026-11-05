import { describe, it, expect, vi, afterEach } from 'vitest';
import { logger, requestLogger } from '../utils/logger';

function capture(stream) {
  const lines = [];
  vi.spyOn(process[stream], 'write').mockImplementation((chunk) => {
    lines.push(String(chunk));
    return true;
  });
  return lines;
}

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.LOG_LEVEL;
  delete process.env.LOG_FORMAT;
});

describe('logger', () => {
  it('writes one JSON line per event in json format', () => {
    process.env.LOG_FORMAT = 'json';
    const lines = capture('stdout');
    logger.info('hello', { orderId: 7 });
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toMatchObject({ level: 'info', msg: 'hello', orderId: 7 });
  });

  it('sends errors and warnings to stderr and keeps the stack of an Error', () => {
    process.env.LOG_FORMAT = 'json';
    const lines = capture('stderr');
    logger.error('boom', { error: new Error('bad thing') });
    const entry = JSON.parse(lines[0]);
    expect(entry.level).toBe('error');
    expect(entry.error.message).toBe('bad thing');
    expect(entry.error.stack).toContain('bad thing');
  });

  it('skips events below LOG_LEVEL', () => {
    process.env.LOG_LEVEL = 'warn';
    const out = capture('stdout');
    logger.info('quiet');
    logger.debug('quieter');
    expect(out).toHaveLength(0);
  });
});

describe('requestLogger', () => {
  it('logs method, path without the query string, status and duration', () => {
    process.env.LOG_FORMAT = 'json';
    const lines = capture('stdout');
    let onFinish;
    const res = { statusCode: 200, on: (event, fn) => { onFinish = fn; } };
    const next = vi.fn();

    requestLogger({ method: 'GET', originalUrl: '/api/orders?token=secret-value' }, res, next);
    onFinish();

    expect(next).toHaveBeenCalledOnce();
    const entry = JSON.parse(lines[0]);
    expect(entry).toMatchObject({ msg: 'request', method: 'GET', path: '/api/orders', status: 200 });
    expect(typeof entry.ms).toBe('number');
    expect(lines[0]).not.toContain('secret-value');
  });

  it('logs server errors at error level and client errors as warnings', () => {
    process.env.LOG_FORMAT = 'json';
    const err = capture('stderr');
    for (const statusCode of [404, 500]) {
      let onFinish;
      requestLogger({ method: 'GET', originalUrl: '/x' }, { statusCode, on: (e, fn) => { onFinish = fn; } }, vi.fn());
      onFinish();
    }
    expect(err.map((l) => JSON.parse(l).level)).toEqual(['warn', 'error']);
  });
});
