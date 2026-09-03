const pool = require('../config/db');

// Display-only conversion — all orders are always priced and stored in GHS.
// Exchange rates are set manually by an admin, not pulled from a live feed.
async function listCurrencies(req, res, next) {
  try {
    const result = await pool.query(
      'SELECT code, name, symbol, rate_to_ghs FROM currencies WHERE is_active = true ORDER BY code'
    );
    res.json({ currencies: result.rows });
  } catch (err) {
    next(err);
  }
}

async function listCurrenciesAdmin(req, res, next) {
  try {
    const result = await pool.query('SELECT code, name, symbol, rate_to_ghs, is_active FROM currencies ORDER BY code');
    res.json({ currencies: result.rows });
  } catch (err) {
    next(err);
  }
}

async function updateCurrency(req, res, next) {
  try {
    const { code } = req.params;
    const { rate_to_ghs, is_active } = req.body;

    const updates = [];
    const params = [];
    if (rate_to_ghs !== undefined) {
      const rate = Number(rate_to_ghs);
      if (!(rate > 0)) {
        return res.status(400).json({ error: 'rate_to_ghs must be a positive number.' });
      }
      params.push(rate);
      updates.push(`rate_to_ghs = $${params.length}`);
    }
    if (is_active !== undefined) {
      params.push(!!is_active);
      updates.push(`is_active = $${params.length}`);
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields provided to update.' });
    }

    params.push(code);
    const result = await pool.query(
      `UPDATE currencies SET ${updates.join(', ')} WHERE code = $${params.length}
       RETURNING code, name, symbol, rate_to_ghs, is_active`,
      params
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Currency not found.' });
    }
    res.json({ currency: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = { listCurrencies, listCurrenciesAdmin, updateCurrency };
