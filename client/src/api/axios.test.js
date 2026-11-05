import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import api from './axios';
import { SESSION_ENDED_EVENT } from '../lib/sessionEvents.js';

// Replaces the network with a function that answers every request with `status`.
function answerWith(status, data = {}) {
  api.defaults.adapter = (config) =>
    status < 400
      ? Promise.resolve({ data, status, statusText: 'OK', headers: {}, config })
      : Promise.reject(Object.assign(new Error(`HTTP ${status}`), { config, response: { status, data, headers: {}, config } }));
}

let originalAdapter;
let ended;
const onEnded = (event) => ended.push(event.detail);

beforeEach(() => {
  originalAdapter = api.defaults.adapter;
  ended = [];
  localStorage.clear();
  window.addEventListener(SESSION_ENDED_EVENT, onEnded);
});

afterEach(() => {
  api.defaults.adapter = originalAdapter;
  window.removeEventListener(SESSION_ENDED_EVENT, onEnded);
});

describe('api client', () => {
  it('sends the saved token with every request', async () => {
    localStorage.setItem('mll_token', 'abc123');
    let sent;
    api.defaults.adapter = (config) => {
      sent = config.headers.Authorization;
      return Promise.resolve({ data: {}, status: 200, statusText: 'OK', headers: {}, config });
    };
    await api.get('/orders/user');
    expect(sent).toBe('Bearer abc123');
  });

  it('ends the session when the server rejects the saved login', async () => {
    localStorage.setItem('mll_token', 'abc123');
    answerWith(401, { error: 'This account is no longer active.' });

    await expect(api.get('/orders/user')).rejects.toBeTruthy();

    expect(localStorage.getItem('mll_token')).toBeNull();
    expect(ended).toEqual(['This account is no longer active.']);
  });

  it('does not treat a wrong password at login as a lost session', async () => {
    localStorage.setItem('mll_token', 'stale-but-present');
    answerWith(401, { error: 'Invalid email or password.' });

    await expect(api.post('/auth/login', { email: 'a@b.com', password: 'x' })).rejects.toBeTruthy();

    expect(ended).toHaveLength(0);
    expect(localStorage.getItem('mll_token')).toBe('stale-but-present');
  });

  it('ignores a 401 when nobody was logged in', async () => {
    answerWith(401);
    await expect(api.get('/orders/user')).rejects.toBeTruthy();
    expect(ended).toHaveLength(0);
  });

  it('leaves other errors alone', async () => {
    localStorage.setItem('mll_token', 'abc123');
    answerWith(500, { error: 'Internal server error.' });
    await expect(api.get('/orders/user')).rejects.toBeTruthy();
    expect(ended).toHaveLength(0);
    expect(localStorage.getItem('mll_token')).toBe('abc123');
  });

  it('passes successful responses through', async () => {
    answerWith(200, { ok: true });
    const res = await api.get('/anything');
    expect(res.data).toEqual({ ok: true });
  });
});
