// Fired on `window` when the server says the saved login no longer works: the
// account was deactivated, its password was changed, or the token expired.
// api/axios.js fires it; AuthContext listens and signs the person out, so they
// land on the login screen instead of on screens that fail one request at a
// time. Kept in its own module so tests can mock the API client without it.
export const SESSION_ENDED_EVENT = 'mll:session-ended';
