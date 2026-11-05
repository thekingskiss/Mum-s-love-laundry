const pool = require('../config/db');
const { FREE_PICKUP_DAYS } = require('../utils/lateFee');
const { NET_PAID_EXPR } = require('./paymentController');

const AUDIT_LOG_LIMIT = 200;

// A storage fee starts once an order has sat ready for more than the free
// period, matching calculateLateFee's whole-day count.
const LATE_FEE_STARTS_AFTER_DAYS = FREE_PICKUP_DAYS + 1;

// Revenue and outstanding balance use the same definitions as the Analytics
// tab. Dates follow the database's zone, which v21 sets to the shop's own.
// Expects `orders o` and the `pay` join below.
const ORDER_FIGURES = `
  COUNT(*) FILTER (WHERE o.status != 'cancelled' AND o.created_at::date = CURRENT_DATE) AS orders_today,
  COUNT(*) FILTER (WHERE o.status = 'ready_for_pickup') AS ready_for_pickup,
  COUNT(*) FILTER (WHERE o.status NOT IN ('completed', 'cancelled') AND o.pickup_date < CURRENT_DATE) AS overdue_pickups,
  COUNT(*) FILTER (
    WHERE o.status = 'ready_for_pickup'
      AND (SELECT MAX(created_at) FROM order_events WHERE order_id = o.id AND to_status = 'ready_for_pickup')
          <= CURRENT_TIMESTAMP - INTERVAL '${LATE_FEE_STARTS_AFTER_DAYS} days'
  ) AS late_fees_accruing,
  COALESCE(SUM(o.total_price) FILTER (
    WHERE o.status != 'cancelled' AND o.created_at >= date_trunc('week', CURRENT_DATE)
  ), 0) AS revenue_this_week,
  COALESCE(SUM(GREATEST(o.total_price - pay.net_paid, 0)) FILTER (WHERE o.status != 'cancelled'), 0) AS outstanding_balance`;

const PAYMENTS_JOIN = `LEFT JOIN LATERAL (SELECT ${NET_PAID_EXPR} AS net_paid FROM payments WHERE order_id = o.id) pay ON true`;

function numericFigures(row) {
  return {
    orders_today: Number(row.orders_today),
    ready_for_pickup: Number(row.ready_for_pickup),
    overdue_pickups: Number(row.overdue_pickups),
    late_fees_accruing: Number(row.late_fees_accruing),
    revenue_this_week: Number(row.revenue_this_week),
    outstanding_balance: Number(row.outstanding_balance),
  };
}

// The admin landing page and sidebar badges. Non-super_admin admins only ever
// see their own branch; a super_admin may pick a branch or see all of them,
// in which case a per-branch comparison is included.
async function getOverview(req, res, next) {
  try {
    const branchId = req.user.branch_id || req.query.branch_id || null;
    const params = branchId ? [branchId] : [];

    const [figures, lowStock, unread, byBranch] = await Promise.all([
      pool.query(
        `SELECT ${ORDER_FIGURES} FROM orders o ${PAYMENTS_JOIN} ${branchId ? 'WHERE o.branch_id = $1' : ''}`,
        params
      ),
      pool.query(
        `SELECT COUNT(*) AS count FROM inventory_items
         WHERE is_active = true AND quantity_on_hand <= reorder_threshold ${branchId ? 'AND branch_id = $1' : ''}`,
        params
      ),
      // The contact inbox belongs to the business as a whole, not to one branch.
      pool.query('SELECT COUNT(*) AS count FROM contact_messages WHERE read_at IS NULL'),
      branchId
        ? Promise.resolve({ rows: [] })
        : pool.query(
            `SELECT b.id, b.name, ${ORDER_FIGURES}
             FROM branches b
             LEFT JOIN orders o ON o.branch_id = b.id
             ${PAYMENTS_JOIN}
             WHERE b.is_active = true
             GROUP BY b.id, b.name
             ORDER BY b.name`
          ),
    ]);

    res.json({
      ...numericFigures(figures.rows[0]),
      low_stock_count: Number(lowStock.rows[0].count),
      unread_messages: Number(unread.rows[0].count),
      by_branch: byBranch.rows.map((row) => ({ id: row.id, name: row.name, ...numericFigures(row) })),
    });
  } catch (err) {
    next(err);
  }
}

const ACTIVITY_LIST_LIMIT = 5;

// The charts and lists on the admin landing page. Separate from getOverview
// because the sidebar badges refetch that on every tab change. Revenue and
// branch scope use the same definitions as getOverview.
async function getOverviewActivity(req, res, next) {
  try {
    const branchId = req.user.branch_id || req.query.branch_id || null;
    const params = branchId ? [branchId] : [];
    const inBranch = branchId ? 'AND o.branch_id = $1' : '';

    const [comparison, trend, pipeline, recentOrders, pickups] = await Promise.all([
      pool.query(
        `SELECT
           to_char(CURRENT_DATE, 'YYYY-MM-DD') AS today,
           COALESCE(SUM(o.total_price) FILTER (
             WHERE o.created_at >= date_trunc('week', LOCALTIMESTAMP) - INTERVAL '7 days'
               AND o.created_at < LOCALTIMESTAMP - INTERVAL '7 days'
           ), 0) AS revenue_last_week_to_date,
           COUNT(*) FILTER (
             WHERE o.created_at::date = CURRENT_DATE - 1 AND o.created_at < LOCALTIMESTAMP - INTERVAL '1 day'
           ) AS orders_yesterday_to_date
         FROM orders o
         WHERE o.status != 'cancelled' ${inBranch}`,
        params
      ),
      // Monday of last week through Sunday of this week, including days with no orders.
      pool.query(
        `SELECT to_char(d.day, 'YYYY-MM-DD') AS date,
                COALESCE(SUM(o.total_price), 0) AS revenue,
                COUNT(o.id) AS order_count
         FROM generate_series(
           date_trunc('week', LOCALTIMESTAMP) - INTERVAL '7 days',
           date_trunc('week', LOCALTIMESTAMP) + INTERVAL '6 days',
           INTERVAL '1 day'
         ) AS d(day)
         LEFT JOIN orders o ON o.created_at::date = d.day::date AND o.status != 'cancelled' ${inBranch}
         GROUP BY d.day
         ORDER BY d.day`,
        params
      ),
      pool.query(
        `SELECT o.status, COUNT(*) AS count
         FROM orders o
         WHERE o.status NOT IN ('completed', 'cancelled') ${inBranch}
         GROUP BY o.status`,
        params
      ),
      pool.query(
        `SELECT o.id, o.status, o.total_price, o.created_at, u.full_name AS customer_name
         FROM orders o
         JOIN users u ON u.id = o.user_id
         WHERE true ${inBranch}
         ORDER BY o.created_at DESC, o.id DESC
         LIMIT ${ACTIVITY_LIST_LIMIT}`,
        params
      ),
      pool.query(
        `SELECT o.id, o.status, u.full_name AS customer_name, CURRENT_DATE - o.pickup_date AS days_late
         FROM orders o
         JOIN users u ON u.id = o.user_id
         WHERE o.status NOT IN ('completed', 'cancelled') AND o.pickup_date <= CURRENT_DATE ${inBranch}
         ORDER BY o.pickup_date, o.id
         LIMIT ${ACTIVITY_LIST_LIMIT}`,
        params
      ),
    ]);

    res.json({
      today: comparison.rows[0].today,
      revenue_last_week_to_date: Number(comparison.rows[0].revenue_last_week_to_date),
      orders_yesterday_to_date: Number(comparison.rows[0].orders_yesterday_to_date),
      trend: trend.rows.map((row) => ({
        date: row.date,
        revenue: Number(row.revenue),
        order_count: Number(row.order_count),
      })),
      pipeline: pipeline.rows.map((row) => ({ status: row.status, count: Number(row.count) })),
      recent_orders: recentOrders.rows.map((row) => ({ ...row, total_price: Number(row.total_price) })),
      pickups: pickups.rows,
    });
  } catch (err) {
    next(err);
  }
}

async function listAuditLog(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT a.id, a.actor_email, a.actor_role, a.action, a.entity_type, a.entity_id, a.summary, a.created_at,
              u.full_name AS actor_name
       FROM audit_log a
       LEFT JOIN users u ON u.id = a.actor_id
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT ${AUDIT_LOG_LIMIT}`
    );
    res.json({ entries: result.rows });
  } catch (err) {
    next(err);
  }
}

module.exports = { getOverview, getOverviewActivity, listAuditLog };
