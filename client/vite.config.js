import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Keep the development origin aligned with the API's default CORS origin
  // and the setup instructions. Fail clearly if another process owns it.
  server: { host: 'localhost', port: 5173, strictPort: true },
});
