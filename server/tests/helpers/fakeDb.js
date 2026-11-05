import { createRequire } from 'node:module';

// A scripted stand-in for the PostgreSQL pool, so tests can exercise code that
// talks to the database without one running.
//
// Vitest's module mocking doesn't reliably intercept require('../config/db') in
// the CommonJS controllers here, so instead of mocking the module this patches
// the shared pool object's methods. createRequire goes through Node's own
// require cache, which is the one the controllers use, so both sides see the
// same pool.
//
//   const db = installFakeDb();
//   db.on(/FROM users WHERE id/, [{ id: 1, role: 'customer' }]);
//   db.on(/INSERT INTO payments/, (params) => ({ rows: [{ id: 9, amount: params[1] }] }));
//
// A query nothing matches throws, so a test fails loudly the moment code runs
// SQL it didn't expect. Handlers are tried in the order added; the first match
// wins. BEGIN / COMMIT / ROLLBACK are accepted automatically and recorded.
const require = createRequire(import.meta.url);

const TRANSACTION_SQL = /^\s*(BEGIN|COMMIT|ROLLBACK)\b/i;

function toResult(value) {
  if (Array.isArray(value)) return { rows: value, rowCount: value.length };
  const rows = value?.rows ?? [];
  return { rowCount: rows.length, ...value, rows };
}

export function installFakeDb() {
  const pool = require('../../config/db');
  const original = { query: pool.query, connect: pool.connect };
  const handlers = [];
  const calls = [];

  async function run(sql, params = []) {
    const text = typeof sql === 'string' ? sql : sql.text;
    calls.push({ sql: text, params });
    if (TRANSACTION_SQL.test(text)) return toResult([]);
    for (const handler of handlers) {
      if (handler.pattern.test(text)) {
        const value = typeof handler.result === 'function' ? await handler.result(params, text) : handler.result;
        if (value instanceof Error) throw value;
        return toResult(value);
      }
    }
    throw new Error(`fakeDb: no handler for query: ${text.replace(/\s+/g, ' ').trim().slice(0, 200)}`);
  }

  pool.query = run;
  pool.connect = async () => ({ query: run, release() {} });

  // Handlers added before freeze() are the shared base (e.g. the account lookup)
  // and survive reset(); everything added afterwards is per-test.
  let frozen = false;

  return {
    pool,
    calls,
    on(pattern, result) {
      handlers.push({ pattern, result, base: !frozen });
      return this;
    },
    // Like on(), but wins over handlers added earlier. For overriding a base
    // answer in one test.
    first(pattern, result) {
      handlers.unshift({ pattern, result, base: !frozen });
      return this;
    },
    freeze() {
      frozen = true;
      return this;
    },
    // Queries run so far that match `pattern`.
    callsMatching(pattern) {
      return calls.filter((call) => pattern.test(call.sql));
    },
    // Drops per-test handlers and the call log. Call it in beforeEach.
    reset() {
      for (let i = handlers.length - 1; i >= 0; i -= 1) {
        if (!handlers[i].base) handlers.splice(i, 1);
      }
      calls.length = 0;
    },
    restore() {
      pool.query = original.query;
      pool.connect = original.connect;
    },
  };
}
