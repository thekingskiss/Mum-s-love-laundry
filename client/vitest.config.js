import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Same JSX handling as the app (vite.config.js). Without it the tests compile
  // JSX the old way and fail with "React is not defined".
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    // The first test in a file can take several seconds on a slow or busy
    // machine while modules are compiled; the 5s default fails spuriously.
    testTimeout: 20000,
    // The threads pool times out starting workers with jsdom on Windows.
    pool: 'forks',
    // Loading jsdom in several workers at once can pass Vitest's 60-second
    // worker start limit on slower machines, so run test files one at a time.
    maxWorkers: 1,
  },
});
