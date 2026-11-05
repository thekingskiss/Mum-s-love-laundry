import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // bcryptjs's pure-JS hashing is noticeably slower inside Vitest's worker
    // threads on this machine than in plain Node — give tests that hash a
    // real password (register/login smoke tests) enough headroom.
    testTimeout: 20000,
    // Route-level tests import every controller (twilio, pdfkit, ...), which can
    // take well over the 10s default on a slow or busy machine.
    hookTimeout: 60000,
  },
});
