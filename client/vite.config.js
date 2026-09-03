import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    // The default "forks" pool times out starting worker processes on this
    // machine (Windows process-fork overhead); "threads" starts reliably.
    pool: 'threads',
  },
});
