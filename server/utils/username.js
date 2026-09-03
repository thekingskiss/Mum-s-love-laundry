// Derives a unique username from an email's local part (e.g.
// "kwame.asante@x.com" -> "kwame.asante"), appending a numeric suffix on
// collision. `queryable` is a pg Pool or a checked-out client — callers
// creating the user inside a transaction should pass their client so the
// uniqueness check and the insert commit together.
async function generateUniqueUsername(queryable, email) {
  const base = email.toLowerCase().trim().split('@')[0].replace(/[^a-zA-Z0-9_.]/g, '') || 'user';
  for (let suffix = 0; ; suffix += 1) {
    const candidate = suffix === 0 ? base : `${base}${suffix}`;
    const taken = await queryable.query('SELECT id FROM users WHERE username = $1', [candidate]);
    if (taken.rows.length === 0) return candidate;
  }
}

module.exports = { generateUniqueUsername };
