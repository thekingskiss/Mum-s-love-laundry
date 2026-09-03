const pool = require('../config/db');

async function listExpenses(req, res, next) {
  try {
    const { start, end, category, branch_id } = req.query;
    const conditions = [];
    const params = [];

    // Non-super_admin admins only ever see their own branch's expenses;
    // super_admin may filter by branch_id or omit it to see every branch.
    const effectiveBranchId = req.user.branch_id || branch_id;
    if (effectiveBranchId) {
      params.push(effectiveBranchId);
      conditions.push(`e.branch_id = $${params.length}`);
    }
    if (start) {
      params.push(start);
      conditions.push(`expense_date >= $${params.length}`);
    }
    if (end) {
      params.push(end);
      conditions.push(`expense_date <= $${params.length}`);
    }
    if (category) {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT e.id, e.category, e.description, e.amount, e.expense_date, e.created_at, u.full_name AS created_by_name
       FROM expenses e
       LEFT JOIN users u ON u.id = e.created_by
       ${where}
       ORDER BY e.expense_date DESC, e.created_at DESC
       LIMIT 500`,
      params
    );
    const totalResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses e ${where}`,
      params
    );
    res.json({ expenses: result.rows, total: Number(totalResult.rows[0].total) });
  } catch (err) {
    next(err);
  }
}

async function createExpense(req, res, next) {
  try {
    const { category, description, amount, expense_date, branch_id } = req.body;

    if (!category || !category.trim()) {
      return res.status(400).json({ error: 'category is required.' });
    }
    const amountNum = Number(amount);
    if (!(amountNum > 0)) {
      return res.status(400).json({ error: 'amount must be a positive number.' });
    }
    if (!expense_date || !/^\d{4}-\d{2}-\d{2}$/.test(expense_date) || Number.isNaN(new Date(`${expense_date}T00:00:00`).getTime())) {
      return res.status(400).json({ error: 'expense_date is required and must be a valid date in YYYY-MM-DD format.' });
    }
    // Non-super_admin admins log expenses against their own branch;
    // super_admin must say which branch explicitly.
    const effectiveBranchId = req.user.branch_id || branch_id;
    if (!effectiveBranchId) {
      return res.status(400).json({ error: 'branch_id is required.' });
    }

    const result = await pool.query(
      `INSERT INTO expenses (category, description, amount, expense_date, branch_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, category, description, amount, expense_date, branch_id, created_at`,
      [category.trim(), (description || '').trim() || null, amountNum, expense_date, effectiveBranchId, req.user.id]
    );
    res.status(201).json({ expense: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function deleteExpense(req, res, next) {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM expenses WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found.' });
    }
    res.json({ message: 'Expense deleted.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listExpenses, createExpense, deleteExpense };
