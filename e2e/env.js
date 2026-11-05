// Shared settings for the end-to-end run. Everything here points at a throwaway
// setup that cannot reach the development or production database:
//   - its own database, which must end in "_e2e" (global-setup refuses otherwise);
//   - its own API and web ports, so a running dev server is left alone;
//   - DATABASE_URL is forced empty, so a hosted database URL in server/.env is
//     never used.
export const E2E_DB = 'mums_love_laundry_e2e';
export const API_PORT = 4100;
export const WEB_PORT = 5273;
export const API_URL = `http://localhost:${API_PORT}`;
export const WEB_URL = `http://localhost:${WEB_PORT}`;

export const PASSWORD = 'E2e-password-1';
export const USERS = {
  customer: { email: 'customer@e2e.test', name: 'E2E Customer', role: 'customer' },
  staff: { email: 'staff@e2e.test', name: 'E2E Staff', role: 'laundry_staff' },
  admin: { email: 'admin@e2e.test', name: 'E2E Admin', role: 'administrator' },
  superAdmin: { email: 'super@e2e.test', name: 'E2E Super Admin', role: 'super_admin' },
};

// Environment for every process the tests start (API, migrations, seeding).
export function serverEnv() {
  return {
    NODE_ENV: 'development',
    PORT: String(API_PORT),
    DATABASE_URL: '',
    DB_NAME: E2E_DB,
    JWT_SECRET: 'e2e-only-secret-not-used-anywhere-else-0123456789',
    CLIENT_ORIGIN: WEB_URL,
    LOG_LEVEL: 'warn',
  };
}
