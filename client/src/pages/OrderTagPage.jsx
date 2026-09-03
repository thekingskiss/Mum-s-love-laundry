import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import api from '../api/axios';
import Skeleton from '../components/Skeleton.jsx';
import { SHOP_NAME } from '../lib/shopInfo.js';

// A small printable label staff stick on the physical laundry bag when
// placing it in storage — order #, customer name/phone, and shelf/area, big
// and legible at a glance. Deliberately separate from ReceiptPage (a
// customer-facing itemized receipt) — this is staff-only and optimized for
// a strip of paper, not a full page.
export default function OrderTagPage() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/orders/${id}`)
      .then(({ data }) => setOrder(data.order))
      .catch((err) => setError(err.response?.data?.error || 'Unable to load this order.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-sm px-6 pb-16 pt-10">
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (error) return <p className="mx-auto max-w-sm px-6 pb-16 pt-10 text-sm text-red-600">{error}</p>;
  if (!order) return null;

  return (
    <div className="mx-auto max-w-sm px-6 pb-16 pt-10">
      <Helmet>
        <title>{`Tag — Order #${order.id} — ${SHOP_NAME}`}</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <div id="tag-print-area" className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-6 text-center dark:border-slate-600 dark:bg-slate-800">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{SHOP_NAME}</p>
        <p className="mt-1 text-xs text-slate-400">Order #{order.id} · {new Date(order.created_at).toLocaleDateString()}</p>

        <p className="mt-4 font-display text-3xl font-bold text-ink-900 dark:text-white">{order.customer_name}</p>
        <p className="mt-1 text-lg text-slate-600 dark:text-slate-300">{order.customer_phone}</p>

        <div className="mt-5 rounded-xl bg-indigo-50 px-4 py-3 dark:bg-indigo-950/30">
          <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">Storage</p>
          <p className="mt-1 font-display text-2xl font-bold text-indigo-700 dark:text-indigo-300">
            {order.storage_location || 'Not yet assigned'}
          </p>
        </div>

        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          {order.items_summary || `${order.item_count} item(s)`}
        </p>
        <p className="mt-1 text-xs text-slate-400">Drop-off {order.drop_off_date?.slice(0, 10)}</p>
      </div>

      <button
        onClick={() => window.print()}
        className="print:hidden mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-brand-500 px-6 py-3 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-brand-600"
      >
        <Printer size={16} /> Print Tag
      </button>
    </div>
  );
}
