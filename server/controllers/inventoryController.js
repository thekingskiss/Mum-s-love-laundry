const pool = require('../config/db');

// All items, including inactive ones — Staff -> Inventory needs to see
// everything to manage it. `low_stock` flags anything at or below its
// reorder threshold so it's easy to spot what's running out.
async function listInventory(req, res, next) {
  try {
    // Non-super_admin admins only ever see their own branch's stock;
    // super_admin may filter by branch_id or omit it to see every branch.
    const params = [];
    let where = '';
    const effectiveBranchId = req.user.branch_id || req.query.branch_id;
    if (effectiveBranchId) {
      params.push(effectiveBranchId);
      where = `WHERE branch_id = $${params.length}`;
    }
    const result = await pool.query(
      `SELECT id, name, category, unit, quantity_on_hand, reorder_threshold, unit_cost, is_active, branch_id,
              (quantity_on_hand <= reorder_threshold) AS low_stock, created_at, updated_at
       FROM inventory_items
       ${where}
       ORDER BY category, name`,
      params
    );
    res.json({ items: result.rows });
  } catch (err) {
    next(err);
  }
}

async function createInventoryItem(req, res, next) {
  try {
    const { name, category, unit, quantity_on_hand, reorder_threshold, unit_cost, branch_id } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'name is required.' });
    }
    // Non-super_admin admins stock their own branch; super_admin must say
    // which branch explicitly.
    const effectiveBranchId = req.user.branch_id || branch_id;
    if (!effectiveBranchId) {
      return res.status(400).json({ error: 'branch_id is required.' });
    }

    const result = await pool.query(
      `INSERT INTO inventory_items (name, category, unit, quantity_on_hand, reorder_threshold, unit_cost, branch_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, category, unit, quantity_on_hand, reorder_threshold, unit_cost, is_active, branch_id, created_at, updated_at`,
      [
        name.trim(),
        (category || 'General').trim(),
        (unit || 'pieces').trim(),
        Number(quantity_on_hand) || 0,
        Number(reorder_threshold) || 0,
        unit_cost != null && unit_cost !== '' ? Number(unit_cost) : null,
        effectiveBranchId,
      ]
    );
    res.status(201).json({ item: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function updateInventoryItem(req, res, next) {
  try {
    const { id } = req.params;
    const { name, category, unit, reorder_threshold, unit_cost, is_active } = req.body;
    const updates = [];
    const params = [];

    function set(column, value) {
      params.push(value);
      updates.push(`${column} = $${params.length}`);
    }

    if (name !== undefined) set('name', name.trim());
    if (category !== undefined) set('category', category.trim());
    if (unit !== undefined) set('unit', unit.trim());
    if (reorder_threshold !== undefined) set('reorder_threshold', Number(reorder_threshold) || 0);
    if (unit_cost !== undefined) set('unit_cost', unit_cost === '' || unit_cost === null ? null : Number(unit_cost));
    if (is_active !== undefined) set('is_active', !!is_active);

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields provided to update.' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    const result = await pool.query(
      `UPDATE inventory_items SET ${updates.join(', ')} WHERE id = $${params.length}
       RETURNING id, name, category, unit, quantity_on_hand, reorder_threshold, unit_cost, is_active, created_at, updated_at`,
      params
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Inventory item not found.' });
    }
    res.json({ item: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// Records a stock change (positive = restock, negative = usage/wastage)
// and keeps quantity_on_hand in sync, transactionally.
async function adjustStock(req, res, next) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { change_qty, reason } = req.body;
    const delta = Number(change_qty);

    if (!delta) {
      return res.status(400).json({ error: 'change_qty is required and must be a non-zero number.' });
    }

    await client.query('BEGIN');

    const current = await client.query('SELECT quantity_on_hand FROM inventory_items WHERE id = $1 FOR UPDATE', [id]);
    if (current.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Inventory item not found.' });
    }

    const newQuantity = Number(current.rows[0].quantity_on_hand) + delta;
    if (newQuantity < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'That adjustment would take stock below zero.' });
    }

    const result = await client.query(
      `UPDATE inventory_items SET quantity_on_hand = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2
       RETURNING id, name, category, unit, quantity_on_hand, reorder_threshold, unit_cost, is_active, created_at, updated_at`,
      [newQuantity, id]
    );

    await client.query(
      `INSERT INTO inventory_transactions (item_id, change_qty, reason, created_by) VALUES ($1, $2, $3, $4)`,
      [id, delta, reason || null, req.user.id]
    );

    await client.query('COMMIT');
    res.json({ item: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

async function listInventoryTransactions(req, res, next) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT t.id, t.change_qty, t.reason, t.created_at, u.full_name AS created_by_name
       FROM inventory_transactions t
       LEFT JOIN users u ON u.id = t.created_by
       WHERE t.item_id = $1
       ORDER BY t.created_at DESC
       LIMIT 50`,
      [id]
    );
    res.json({ transactions: result.rows });
  } catch (err) {
    next(err);
  }
}

module.exports = { listInventory, createInventoryItem, updateInventoryItem, adjustStock, listInventoryTransactions };
