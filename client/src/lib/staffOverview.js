import { MILESTONES } from './orderLifecycle';

const CLOSED_STATUSES = ['completed', 'cancelled'];
const LIST_LIMIT = 5;

function pickupDay(order) {
  return order.pickup_date ? order.pickup_date.slice(0, 10) : null;
}

// Turns the staff order list into the figures on the dashboard overview.
// `today` is a YYYY-MM-DD string, and orders are expected newest first, which
// is how GET /orders returns them.
export function summarizeOrders(orders, today) {
  const active = orders.filter((order) => !CLOSED_STATUSES.includes(order.status));
  const owing = orders.filter(
    (order) => order.status !== 'cancelled' && order.payment_status !== 'paid'
  );

  const pickups = active
    .filter((order) => pickupDay(order) && pickupDay(order) <= today)
    .sort((a, b) => pickupDay(a).localeCompare(pickupDay(b)));

  return {
    activeCount: active.length,
    readyCount: active.filter((order) => order.status === 'ready_for_pickup').length,
    overdueCount: pickups.filter((order) => pickupDay(order) < today).length,
    dueTodayCount: pickups.filter((order) => pickupDay(order) === today).length,
    owingCount: owing.length,
    owingTotal: owing.reduce((sum, order) => sum + (Number(order.balance_due) || 0), 0),
    stages: MILESTONES.filter((status) => status !== 'completed').map((status) => ({
      status,
      count: active.filter((order) => order.status === status).length,
    })),
    pickups: pickups.slice(0, LIST_LIMIT),
    morePickups: Math.max(pickups.length - LIST_LIMIT, 0),
    recent: orders.slice(0, LIST_LIMIT),
  };
}
