import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Stamps a fresh build id into the built service worker. A browser only
// installs a new worker when sw.js changes, and without this it would never
// change between releases, so installed apps would keep the old shell.
function serviceWorkerBuildId() {
  let outDir = 'dist';
  let root = process.cwd();
  return {
    name: 'service-worker-build-id',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
      root = config.root;
    },
    async closeBundle() {
      const file = path.resolve(root, outDir, 'sw.js');
      let source;
      try {
        source = await readFile(file, 'utf8');
      } catch {
        return;
      }
      await writeFile(file, source.replaceAll('__BUILD_ID__', Date.now().toString(36)));
    },
  };
}

export default defineConfig({
  plugins: [react(), serviceWorkerBuildId()],
  // Keep the development origin aligned with the API's default CORS origin
  // and the setup instructions. Fail clearly if another process owns it.
  server: { host: 'localhost', port: 5173, strictPort: true },
});
