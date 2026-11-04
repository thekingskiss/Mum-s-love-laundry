import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    // The threads pool times out starting workers with jsdom on Windows.
    pool: 'forks',
    // Loading jsdom in several workers at once can pass Vitest's 60-second
    // worker start limit on slower machines, so run test files one at a time.
    maxWorkers: 1,
  },
});
