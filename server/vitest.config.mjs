import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // bcryptjs's pure-JS hashing is noticeably slower inside Vitest's worker
    // threads on this machine than in plain Node — give tests that hash a
    // real password (register/login smoke tests) enough headroom.
    testTimeout: 20000,
  },
});
