// Mirrors server/config/orderLifecycle.js — kept in sync manually since the
// client and server are separate deployables. The server is authoritative;
// this only drives optimistic UI (labels, colors, "what's next" buttons).
// Walk-in drop-off model: customers bring laundry in and collect it in
// person — no pickup or delivery legs.

export const STATUS_LABELS = {
  order_received: 'Order Received',
  in_washing: 'Washing',
  ironing_process: 'Ironing',
  quality_check: 'Quality Check',
  ready_for_pickup: 'Ready for Pickup',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const STATUS_STYLES = {
  order_received: 'bg-amber-100 text-amber-700',
  in_washing: 'bg-sky-100 text-sky-700',
  ironing_process: 'bg-violet-100 text-violet-700',
  quality_check: 'bg-violet-100 text-violet-700',
  ready_for_pickup: 'bg-orange-100 text-orange-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-slate-200 text-slate-600',
};

// Ordered "happy path" milestones for progress-bar UI.
export const MILESTONES = [
  'order_received',
  'in_washing',
  'ironing_process',
  'quality_check',
  'ready_for_pickup',
  'completed',
];

const STAFF_ROLES = ['laundry_staff', 'administrator', 'super_admin'];

// Mirrors the server's role-gated transition graph, for showing the right
// "advance to X" action in staff UI. The server re-validates independently.
export const TRANSITIONS = {
  order_received: { in_washing: STAFF_ROLES, cancelled: ['administrator', 'super_admin'] },
  in_washing: { ironing_process: STAFF_ROLES },
  ironing_process: { quality_check: STAFF_ROLES },
  quality_check: { ready_for_pickup: STAFF_ROLES },
  ready_for_pickup: { completed: STAFF_ROLES },
  completed: {},
  cancelled: {},
};

export const CUSTOMER_CANCELLABLE_STATUSES = ['order_received'];

// The shop's physical storage partitions an order can be assigned to once
// it's ready for pickup. Mirrors server/config/orderLifecycle.js.
export const STORAGE_LOCATIONS = ['Shelf 1', 'Area 2', 'Area 3', 'Area 4'];

export function getAllowedTransitions(status, role) {
  const edges = TRANSITIONS[status] || {};
  return Object.entries(edges)
    .filter(([, roles]) => roles.includes(role))
    .map(([toStatus]) => toStatus);
}

export function milestoneProgress(status) {
  if (status === 'cancelled') return -1;
  return MILESTONES.indexOf(status);
}
