// A single pulsing placeholder block — compose a few of these into a
// page-specific loading layout (see DashboardPage/ReceiptPage/BookingPage)
// instead of showing plain "Loading..." text, so content cross-fades in
// without a layout jump once it arrives.
export default function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-md bg-slate-200 dark:bg-slate-700 ${className}`} />;
}
