const pool = require('../config/db');
const { recordAudit } = require('../services/auditLog');

const ITEM_COLUMNS = 'id, category, item_name, unit_price, price_min, price_max, is_active';
const MAX_PRICE = 99999999.99; // the largest value DECIMAL(10, 2) can hold
const UNIQUE_VIOLATION = '23505';
const DUPLICATE_NAME = 'An item with that name already exists.';

function priceText(item) {
  return item.unit_price != null ? `GHS ${item.unit_price}` : `GHS ${item.price_min}-${item.price_max}`;
}

function parsePrice(value) {
  if (typeof value === 'string' ? value.trim() === '' : typeof value !== 'number') return null;
  const price = Number(value);
  return Number.isFinite(price) && price > 0 && price <= MAX_PRICE ? price : null;
}

// The item's price from a request: { pricing } when one was sent correctly,
// { error } when it wasn't, and {} when none was sent.
function readPricing({ unit_price, price_min, price_max }) {
  const sentFixed = unit_price != null;
  const sentRange = price_min != null || price_max != null;

  if (!sentFixed && !sentRange) return {};
  if (sentFixed && sentRange) {
    return { error: 'Provide either a fixed price or a price range, not both.' };
  }
  if (sentFixed) {
    const price = parsePrice(unit_price);
    return price === null
      ? { error: 'Enter a price greater than 0.' }
      : { pricing: { unit_price: price, price_min: null, price_max: null } };
  }

  const min = parsePrice(price_min);
  const max = parsePrice(price_max);
  if (min === null || max === null) {
    return { error: 'Enter a minimum and maximum price greater than 0.' };
  }
  if (min > max) {
    return { error: 'The minimum price cannot be more than the maximum.' };
  }
  return { pricing: { unit_price: null, price_min: min, price_max: max } };
}

// A trimmed name or category, or null if it isn't usable.
function readText(value, maxLength) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text.length > 0 && text.length <= maxLength ? text : null;
}

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
    const category = readText(req.body.category, 100);
    const itemName = readText(req.body.item_name, 150);
    if (!category || !itemName) {
      return res.status(400).json({ error: 'A category and item name are required.' });
    }

    const { pricing, error } = readPricing(req.body);
    if (error) return res.status(400).json({ error });
    if (!pricing) return res.status(400).json({ error: 'Enter a fixed price or a price range.' });

    const result = await pool.query(
      `INSERT INTO laundry_items (category, item_name, unit_price, price_min, price_max)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${ITEM_COLUMNS}`,
      [category, itemName, pricing.unit_price, pricing.price_min, pricing.price_max]
    );
    await recordAudit(req.user, {
      action: 'item.created',
      entityType: 'laundry_item',
      entityId: result.rows[0].id,
      summary: `Added "${result.rows[0].item_name}" at ${priceText(result.rows[0])}`,
    });
    res.status(201).json({ item: result.rows[0] });
  } catch (err) {
    if (err.code === UNIQUE_VIOLATION) return res.status(409).json({ error: DUPLICATE_NAME });
    next(err);
  }
}

async function updateItem(req, res, next) {
  try {
    const { id } = req.params;
    const { item_name, category, is_active } = req.body;

    if (!/^\d{1,9}$/.test(id)) {
      return res.status(400).json({ error: 'Invalid item.' });
    }
    const newName = item_name === undefined ? null : readText(item_name, 150);
    if (item_name !== undefined && !newName) {
      return res.status(400).json({ error: 'Enter an item name.' });
    }
    const newCategory = category === undefined ? null : readText(category, 100);
    if (category !== undefined && !newCategory) {
      return res.status(400).json({ error: 'Enter a category.' });
    }
    if (is_active !== undefined && typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active must be true or false.' });
    }
    const { pricing, error } = readPricing(req.body);
    if (error) return res.status(400).json({ error });

    const current = await pool.query(`SELECT ${ITEM_COLUMNS} FROM laundry_items WHERE id = $1`, [id]);
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found.' });
    }
    const existing = current.rows[0];

    // Only touch pricing if new pricing was actually sent — an is_active-only
    // toggle shouldn't wipe out the item's existing price.
    const { unit_price, price_min, price_max } = pricing || existing;

    const result = await pool.query(
      `UPDATE laundry_items SET
         unit_price = $1,
         price_min = $2,
         price_max = $3,
         is_active = COALESCE($4, is_active),
         item_name = COALESCE($5, item_name),
         category = COALESCE($6, category)
       WHERE id = $7
       RETURNING ${ITEM_COLUMNS}`,
      [unit_price, price_min, price_max, is_active, newName, newCategory, id]
    );

    const updated = result.rows[0];
    const changes = [];
    if (existing.item_name !== updated.item_name) changes.push(`renamed from "${existing.item_name}"`);
    if (existing.category !== updated.category) changes.push(`category ${existing.category} → ${updated.category}`);
    if (priceText(existing) !== priceText(updated)) changes.push(`price ${priceText(existing)} → ${priceText(updated)}`);
    if (existing.is_active !== updated.is_active) changes.push(updated.is_active ? 'activated' : 'deactivated');
    if (changes.length > 0) {
      await recordAudit(req.user, {
        action: 'item.updated',
        entityType: 'laundry_item',
        entityId: id,
        summary: `"${updated.item_name}": ${changes.join(', ')}`,
      });
    }

    res.json({ item: updated });
  } catch (err) {
    if (err.code === UNIQUE_VIOLATION) return res.status(409).json({ error: DUPLICATE_NAME });
    next(err);
  }
}

module.exports = { listItems, listItemsAdmin, createItem, updateItem };
