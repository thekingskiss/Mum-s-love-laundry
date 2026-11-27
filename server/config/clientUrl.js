// The address of the website, used to build links that go in emails, reset
// messages and payment redirects.
//
// CLIENT_ORIGIN is for CORS and holds origins only (no path), possibly several.
// A site served from a sub-path (GitHub Pages: https://user.github.io/repo) needs
// the path in its links too, so CLIENT_URL can carry the full address. When it is
// unset, the first CLIENT_ORIGIN is used, which is the same as before.
const raw =
  process.env.CLIENT_URL || (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',')[0];

module.exports = { CLIENT_URL: raw.trim().replace(/\/+$/, '') };
