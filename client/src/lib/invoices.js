export const INVOICE_LINE_KINDS = [
  { value: 'discount', label: 'Discount' },
  { value: 'fee', label: 'Fee' },
  { value: 'tax', label: 'Tax' },
];

export const INVOICE_STATUS_STYLES = {
  not_paid: 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400',
  partial: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',
  paid: 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400',
  voided: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

export const INVOICE_STATUS_LABELS = {
  not_paid: 'Not Paid',
  partial: 'Partially Paid',
  paid: 'Paid',
  voided: 'Voided',
};
