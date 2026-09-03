const pool = require('../config/db');
const { isPromoActive } = require('../utils/pricing');

const SERVICE_COLUMNS = `
  id, service_name, description, base_price, icon_name,
  pricing_unit, price_per_kg, promo_price, promo_starts_at, promo_ends_at
`;

function withPromoFlag(service) {
  return { ...service, promo_active: isPromoActive(service) };
}

async function listServices(req, res, next) {
  try {
    const result = await pool.query(`SELECT ${SERVICE_COLUMNS} FROM services ORDER BY base_price ASC`);
    res.json({ services: result.rows.map(withPromoFlag) });
  } catch (err) {
    next(err);
  }
}

async function updatePricing(req, res, next) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { base_price, pricing_unit, price_per_kg } = req.body;

    const current = await client.query('SELECT base_price FROM services WHERE id = $1', [id]);
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Service not found.' });
    }

    if (pricing_unit && !['flat', 'per_kg'].includes(pricing_unit)) {
      return res.status(400).json({ error: 'pricing_unit must be "flat" or "per_kg".' });
    }

    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE services SET
         base_price = COALESCE($1, base_price),
         pricing_unit = COALESCE($2, pricing_unit),
         price_per_kg = COALESCE($3, price_per_kg)
       WHERE id = $4
       RETURNING ${SERVICE_COLUMNS}`,
      [base_price, pricing_unit, price_per_kg, id]
    );

    if (base_price != null) {
      await client.query(
        `INSERT INTO service_pricing_history (service_id, changed_by, old_base_price, new_base_price)
         VALUES ($1, $2, $3, $4)`,
        [id, req.user.id, current.rows[0].base_price, base_price]
      );
    }

    await client.query('COMMIT');
    res.json({ service: withPromoFlag(result.rows[0]) });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

async function setPromo(req, res, next) {
  try {
    const { id } = req.params;
    const { promo_price, promo_starts_at, promo_ends_at } = req.body;

    const result = await pool.query(
      `UPDATE services SET promo_price = $1, promo_starts_at = $2, promo_ends_at = $3
       WHERE id = $4
       RETURNING ${SERVICE_COLUMNS}`,
      [promo_price, promo_starts_at || null, promo_ends_at || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Service not found.' });
    }
    res.json({ service: withPromoFlag(result.rows[0]) });
  } catch (err) {
    next(err);
  }
}

module.exports = { listServices, updatePricing, setPromo };
