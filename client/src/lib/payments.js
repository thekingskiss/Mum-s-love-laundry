export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
];

export const PAYMENT_TYPES = [
  { value: 'deposit', label: 'Deposit (at drop-off)' },
  { value: 'partial', label: 'Partial Payment' },
  { value: 'balance', label: 'Balance Payment' },
  { value: 'full', label: 'Full Payment' },
  { value: 'refund', label: 'Refund' },
];

export const PAYMENT_METHOD_LABELS = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.value, m.label]));
export const PAYMENT_TYPE_LABELS = Object.fromEntries(PAYMENT_TYPES.map((t) => [t.value, t.label]));

export const PAYMENT_STATUS_STYLES = {
  unpaid: 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400',
  partial: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',
  paid: 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400',
};

export const PAYMENT_STATUS_LABELS = {
  unpaid: 'Unpaid',
  partial: 'Partially Paid',
  paid: 'Paid',
};

// Suggests the most likely payment_type for a given amount relative to what's
// still owed — a sensible default the staff member can always override.
export function suggestPaymentType(amount, balanceDue, amountPaidSoFar) {
  const amt = Number(amount) || 0;
  if (amt >= Number(balanceDue) - 0.005) {
    return amountPaidSoFar > 0 ? 'balance' : 'full';
  }
  return amountPaidSoFar > 0 ? 'partial' : 'deposit';
}
