// Order status transition graph for a walk-in drop-off shop: customers
// bring laundry in themselves and collect it in person — no pickup or
// delivery legs. { fromStatus: { toStatus: [rolesAllowedToMakeThisMove] } }
const STAFF_ROLES = ['laundry_staff', 'administrator', 'super_admin'];

const TRANSITIONS = {
  order_received: {
    in_washing: STAFF_ROLES,
    cancelled: ['administrator', 'super_admin'],
  },
  in_washing: {
    ironing_process: STAFF_ROLES,
  },
  ironing_process: {
    quality_check: STAFF_ROLES,
  },
  quality_check: {
    ready_for_pickup: STAFF_ROLES,
  },
  ready_for_pickup: {
    completed: STAFF_ROLES,
  },
  completed: {},
  cancelled: {},
};

// A customer may cancel their own order themselves only before we've
// started processing it.
const CUSTOMER_CANCELLABLE_STATUSES = ['order_received'];

// The shop's physical storage partitions. Staff assign one of these to an
// order once it's ready for pickup, so anyone at the counter can find the
// laundry immediately when the customer arrives — it stays put until
// collected.
const STORAGE_LOCATIONS = ['Shelf 1', 'Area 2', 'Area 3', 'Area 4'];

const STATUS_LABELS = {
  order_received: 'Order Received',
  in_washing: 'Washing',
  ironing_process: 'Ironing',
  quality_check: 'Quality Check',
  ready_for_pickup: 'Ready for Pickup',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

// Ordered milestones for progress-bar style UI.
const MILESTONES = [
  'order_received',
  'in_washing',
  'ironing_process',
  'quality_check',
  'ready_for_pickup',
  'completed',
];

function getAllowedTransitions(status) {
  return Object.keys(TRANSITIONS[status] || {});
}

function canTransition(fromStatus, toStatus, role) {
  const allowedRoles = TRANSITIONS[fromStatus]?.[toStatus];
  return Array.isArray(allowedRoles) && allowedRoles.includes(role);
}

function isStaffRole(role) {
  return STAFF_ROLES.includes(role);
}

function isAdminRole(role) {
  return ['administrator', 'super_admin'].includes(role);
}

module.exports = {
  TRANSITIONS,
  STATUS_LABELS,
  MILESTONES,
  CUSTOMER_CANCELLABLE_STATUSES,
  STORAGE_LOCATIONS,
  getAllowedTransitions,
  canTransition,
  isStaffRole,
  isAdminRole,
};
