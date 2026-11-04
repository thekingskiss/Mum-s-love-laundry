import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <section className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-brand-500">404</p>
      <h1 className="mt-2 text-3xl font-bold text-ink-900 dark:text-slate-100">Page not found</h1>
      <p className="mt-3 max-w-md text-slate-600 dark:text-slate-300">
        We couldn&apos;t find the page you were looking for. It may have moved, or the link may be incorrect.
      </p>
      <Link
        to="/"
        className="mt-6 rounded-full bg-brand-500 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-600"
      >
        Back to home
      </Link>
    </section>
  );
}
