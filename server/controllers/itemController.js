const pool = require('../config/db');

const ITEM_COLUMNS = 'id, category, item_name, unit_price, price_min, price_max, is_active';

async function listItems(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT ${ITEM_COLUMNS} FROM laundry_items WHERE is_active = true ORDER BY category, item_name`
    );
    res.json({ items: result.rows });
  } catch (err) {
    next(err);
  }
}

async function listItemsAdmin(req, res, next) {
  try {
    const result = await pool.query(`SELECT ${ITEM_COLUMNS} FROM laundry_items ORDER BY category, item_name`);
    res.json({ items: result.rows });
  } catch (err) {
    next(err);
  }
}

async function createItem(req, res, next) {
  try {
    const { category, item_name, unit_price, price_min, price_max } = req.body;

    if (!category || !item_name) {
      return res.status(400).json({ error: 'category and item_name are required.' });
    }
    const isRanged = price_min != null && price_max != null;
    const isFixed = unit_price != null;
    if (isRanged === isFixed) {
      return res.status(400).json({ error: 'Provide either unit_price, or both price_min and price_max — not both.' });
    }

    const result = await pool.query(
      `INSERT INTO laundry_items (category, item_name, unit_price, price_min, price_max)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${ITEM_COLUMNS}`,
      [category.trim(), item_name.trim(), unit_price || null, price_min || null, price_max || null]
    );
    res.status(201).json({ item: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function updateItem(req, res, next) {
  try {
    const { id } = req.params;
    const { unit_price, price_min, price_max, is_active } = req.body;

    const current = await pool.query(`SELECT ${ITEM_COLUMNS} FROM laundry_items WHERE id = $1`, [id]);
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found.' });
    }
    const existing = current.rows[0];

    // Only touch pricing if new pricing was actually sent — an is_active-only
    // toggle shouldn't wipe out the item's existing price.
    let newUnitPrice = existing.unit_price;
    let newPriceMin = existing.price_min;
    let newPriceMax = existing.price_max;

    if (unit_price != null) {
      newUnitPrice = unit_price;
      newPriceMin = null;
      newPriceMax = null;
    } else if (price_min != null && price_max != null) {
      newPriceMin = price_min;
      newPriceMax = price_max;
      newUnitPrice = null;
    }

    const result = await pool.query(
      `UPDATE laundry_items SET
         unit_price = $1,
         price_min = $2,
         price_max = $3,
         is_active = COALESCE($4, is_active)
       WHERE id = $5
       RETURNING ${ITEM_COLUMNS}`,
      [newUnitPrice, newPriceMin, newPriceMax, is_active, id]
    );

    res.json({ item: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = { listItems, listItemsAdmin, createItem, updateItem };
