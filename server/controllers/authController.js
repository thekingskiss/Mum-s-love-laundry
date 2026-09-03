const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const { isZoneSupported, getActiveZoneNames } = require('../utils/zones');
const { sendEmail } = require('../services/notify');

const SALT_ROUNDS = 12;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const USERNAME_PATTERN = /^[a-zA-Z0-9_.]{3,30}$/;
const SUPPORTED_LANGUAGES = ['en', 'tw'];
const SUPPORTED_THEMES = ['light', 'dark'];

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      location_zone: user.location_zone,
      role: user.role,
      branch_id: user.branch_id ?? null,
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    full_name: user.full_name,
    phone_number: user.phone_number,
    location_zone: user.location_zone,
    role: user.role,
    branch_id: user.branch_id ?? null,
    avatar_url: user.avatar_url,
    preferred_language: user.preferred_language,
    preferred_currency: user.preferred_currency,
    theme_preference: user.theme_preference,
    date_of_birth: user.date_of_birth,
    created_at: user.created_at,
  };
}

// Accepts 'YYYY-MM-DD' and rejects anything in the future — a birth date
// can't be tomorrow. Used for both registration and profile updates.
function isValidPastDateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() <= Date.now();
}

async function register(req, res, next) {
  try {
    const { email, password, full_name, phone_number, location_zone, date_of_birth } = req.body;

    if (!email || !password || !full_name || !phone_number || !location_zone) {
      return res.status(400).json({ error: 'email, password, full_name, phone_number, and location_zone are required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
    if (date_of_birth && !isValidPastDateString(date_of_birth)) {
      return res.status(400).json({ error: 'date_of_birth must be a valid past date in YYYY-MM-DD format.' });
    }
    if (!(await isZoneSupported(location_zone))) {
      const zones = await getActiveZoneNames();
      return res.status(400).json({ error: `location_zone must be one of: ${zones.join(', ')}` });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const baseUsername = email.toLowerCase().trim().split('@')[0].replace(/[^a-zA-Z0-9_.]/g, '') || 'user';
    let username = baseUsername;
    for (let suffix = 0; ; suffix += 1) {
      const candidate = suffix === 0 ? username : `${baseUsername}${suffix}`;
      const taken = await pool.query('SELECT id FROM users WHERE username = $1', [candidate]);
      if (taken.rows.length === 0) {
        username = candidate;
        break;
      }
    }

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, phone_number, location_zone, username, date_of_birth)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, username, full_name, phone_number, location_zone, role,
                 avatar_url, preferred_language, preferred_currency, theme_preference, date_of_birth, created_at`,
      [email.toLowerCase().trim(), password_hash, full_name.trim(), phone_number.trim(), location_zone.trim(), username, date_of_birth || null]
    );

    const user = result.rows[0];
    const token = signToken(user);

    res.status(201).json({ token, user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required.' });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = signToken(user);
    res.json({ token, user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT id, email, username, full_name, phone_number, location_zone, role, branch_id,
              avatar_url, preferred_language, preferred_currency, theme_preference, date_of_birth, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({ user: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function updateProfile(req, res, next) {
  try {
    const { email, current_password, username, full_name, phone_number, location_zone, preferred_language, preferred_currency, theme_preference, date_of_birth } = req.body;
    const updates = [];
    const params = [];

    // Email is the login identifier, so changing it requires re-proving the
    // account password — the session token alone isn't enough for a change
    // this sensitive (it also feeds forgot-password / receipts / Paystack).
    if (email !== undefined) {
      const trimmed = email.toLowerCase().trim();
      if (!EMAIL_PATTERN.test(trimmed)) {
        return res.status(400).json({ error: 'Enter a valid email address.' });
      }
      if (!current_password) {
        return res.status(400).json({ error: 'current_password is required to change your email.' });
      }
      const current = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
      const validPassword = await bcrypt.compare(current_password, current.rows[0].password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Incorrect password.' });
      }
      const taken = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [trimmed, req.user.id]);
      if (taken.rows.length > 0) {
        return res.status(409).json({ error: 'An account with that email already exists.' });
      }
      params.push(trimmed);
      updates.push(`email = $${params.length}`);
    }
    if (username !== undefined) {
      const trimmed = username.trim();
      if (!USERNAME_PATTERN.test(trimmed)) {
        return res.status(400).json({ error: 'Username must be 3-30 characters, letters/numbers/underscore/period only.' });
      }
      const taken = await pool.query('SELECT id FROM users WHERE username = $1 AND id != $2', [trimmed, req.user.id]);
      if (taken.rows.length > 0) {
        return res.status(409).json({ error: 'That username is already taken.' });
      }
      params.push(trimmed);
      updates.push(`username = $${params.length}`);
    }
    if (full_name !== undefined) {
      if (!full_name.trim()) {
        return res.status(400).json({ error: 'full_name cannot be empty.' });
      }
      params.push(full_name.trim());
      updates.push(`full_name = $${params.length}`);
    }
    if (phone_number !== undefined) {
      if (!phone_number.trim()) {
        return res.status(400).json({ error: 'phone_number cannot be empty.' });
      }
      params.push(phone_number.trim());
      updates.push(`phone_number = $${params.length}`);
    }
    if (location_zone !== undefined) {
      if (!(await isZoneSupported(location_zone))) {
        const zones = await getActiveZoneNames();
        return res.status(400).json({ error: `location_zone must be one of: ${zones.join(', ')}` });
      }
      params.push(location_zone.trim());
      updates.push(`location_zone = $${params.length}`);
    }
    if (preferred_language !== undefined) {
      if (!SUPPORTED_LANGUAGES.includes(preferred_language)) {
        return res.status(400).json({ error: `preferred_language must be one of: ${SUPPORTED_LANGUAGES.join(', ')}` });
      }
      params.push(preferred_language);
      updates.push(`preferred_language = $${params.length}`);
    }
    if (preferred_currency !== undefined) {
      const currency = await pool.query('SELECT code FROM currencies WHERE code = $1 AND is_active = true', [preferred_currency]);
      if (currency.rows.length === 0) {
        return res.status(400).json({ error: 'preferred_currency is not a supported currency.' });
      }
      params.push(preferred_currency);
      updates.push(`preferred_currency = $${params.length}`);
    }
    if (theme_preference !== undefined) {
      if (!SUPPORTED_THEMES.includes(theme_preference)) {
        return res.status(400).json({ error: `theme_preference must be one of: ${SUPPORTED_THEMES.join(', ')}` });
      }
      params.push(theme_preference);
      updates.push(`theme_preference = $${params.length}`);
    }
    if (date_of_birth !== undefined) {
      if (date_of_birth !== null && !isValidPastDateString(date_of_birth)) {
        return res.status(400).json({ error: 'date_of_birth must be a valid past date in YYYY-MM-DD format.' });
      }
      params.push(date_of_birth);
      updates.push(`date_of_birth = $${params.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields provided to update.' });
    }

    params.push(req.user.id);
    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${params.length}
       RETURNING id, email, username, full_name, phone_number, location_zone, role,
                 avatar_url, preferred_language, preferred_currency, theme_preference, date_of_birth, created_at`,
      params
    );

    res.json({ user: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function uploadAvatar(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file was uploaded.' });
    }

    const current = await pool.query('SELECT avatar_url FROM users WHERE id = $1', [req.user.id]);
    const previousUrl = current.rows[0]?.avatar_url;

    const avatar_url = `/uploads/avatars/${req.file.filename}`;
    const result = await pool.query(
      `UPDATE users SET avatar_url = $1 WHERE id = $2
       RETURNING id, email, username, full_name, phone_number, location_zone, role,
                 avatar_url, preferred_language, preferred_currency, theme_preference, date_of_birth, created_at`,
      [avatar_url, req.user.id]
    );

    if (previousUrl && previousUrl.startsWith('/uploads/avatars/')) {
      const previousPath = path.join(__dirname, '..', previousUrl);
      fs.unlink(previousPath, () => {});
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'email is required.' });
    }

    const genericResponse = { message: 'If an account exists for that email, we\'ve sent password reset instructions.' };

    const result = await pool.query('SELECT id, email, full_name FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    const user = result.rows[0];
    if (!user) {
      // Don't reveal whether the email exists.
      return res.json(genericResponse);
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await pool.query('UPDATE users SET reset_token_hash = $1, reset_token_expires_at = $2 WHERE id = $3', [
      tokenHash,
      expiresAt,
      user.id,
    ]);

    const clientOrigin = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',')[0].trim();
    const resetLink = `${clientOrigin}/reset-password?token=${rawToken}`;

    const sent = await sendEmail(
      user.email,
      'Reset your Mum\'s Love Laundry password',
      `Hi ${user.full_name}, use this link to reset your password (expires in 1 hour): ${resetLink}`
    );

    // Email isn't configured yet in this environment — surface the link
    // directly so the flow is still testable locally. Gated to development
    // only: a production deployment that forgets to set SMTP_* must never
    // hand the raw reset token back in the API response, since that would
    // let anyone take over any account just by knowing its email address.
    if (!sent) {
      if (process.env.NODE_ENV === 'development') {
        return res.json({ ...genericResponse, devResetLink: resetLink });
      }
      console.warn(`[auth] Password reset requested for ${user.email} but email is not configured — no reset link was sent.`);
    }

    res.json(genericResponse);
  } catch (err) {
    next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'token and password are required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const tokenHash = hashToken(token);
    const result = await pool.query(
      'SELECT id, reset_token_expires_at FROM users WHERE reset_token_hash = $1',
      [tokenHash]
    );
    const user = result.rows[0];

    if (!user || !user.reset_token_expires_at || new Date(user.reset_token_expires_at) < new Date()) {
      return res.status(400).json({ error: 'That reset link is invalid or has expired. Please request a new one.' });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    await pool.query(
      'UPDATE users SET password_hash = $1, reset_token_hash = NULL, reset_token_expires_at = NULL WHERE id = $2',
      [password_hash, user.id]
    );

    res.json({ message: 'Your password has been reset. You can now log in.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, me, forgotPassword, resetPassword, updateProfile, uploadAvatar };
