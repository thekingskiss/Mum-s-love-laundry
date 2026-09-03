import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import api from '../api/axios';
import SectionHeading from '../components/SectionHeading.jsx';
import ScrollReveal from '../components/ScrollReveal.jsx';

function priceLabel(item) {
  if (item.unit_price != null) return `GHS ${Number(item.unit_price).toFixed(2)}`;
  return `GHS ${Number(item.price_min).toFixed(2)} – ${Number(item.price_max).toFixed(2)}`;
}

export default function PricingPage() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/items').then(({ data }) => setItems(data.items)).catch(() => setItems([]));
  }, []);

  const groupedItems = useMemo(() => {
    const filtered = items.filter((i) => i.item_name.toLowerCase().includes(search.toLowerCase()));
    const groups = {};
    for (const item of filtered) {
      groups[item.category] = groups[item.category] || [];
      groups[item.category].push(item);
    }
    return groups;
  }, [items, search]);

  return (
    <section className="mx-auto max-w-5xl px-6 pb-24 pt-14">
      <Helmet>
        <title>Pricing — Mum's Love Laundry</title>
        <meta
          name="description"
          content="See our full, itemized laundry price list — shirts, bedding, towels, and formal wear — at Mum's Love Laundry, Akuapem-Akropong."
        />
      </Helmet>
      <ScrollReveal className="text-center">
        <SectionHeading title="Our Full Price List" eyebrow="Pricing" />
        <p className="mx-auto mt-5 max-w-xl text-sm text-slate-500">
          Straightforward, per-item pricing — no surprises. Search below or browse by category, then head to
          booking to build your order.
        </p>
      </ScrollReveal>

      <div className="relative mx-auto mt-8 max-w-md">
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search for an item..."
          className="w-full rounded-full border border-slate-200 py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
      </div>

      <div className="mt-12 grid grid-cols-1 gap-10 md:grid-cols-2">
        {Object.entries(groupedItems).map(([category, categoryItems], i) => (
          <ScrollReveal key={category} delay={i * 0.06}>
            <motion.div
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-soft"
            >
              <div className="bg-brand-50 px-6 py-3">
                <h3 className="font-display text-sm font-bold uppercase tracking-widest text-brand-600">{category}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <tbody className="divide-y divide-slate-100">
                    {categoryItems.map((item) => (
                      <tr key={item.id}>
                        <td className="px-6 py-2.5 text-slate-700">{item.item_name}</td>
                        <td className="px-6 py-2.5 text-right font-semibold text-brand-600">{priceLabel(item)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </ScrollReveal>
        ))}
        {Object.keys(groupedItems).length === 0 && (
          <p className="col-span-2 text-center text-sm text-slate-400">No items match "{search}".</p>
        )}
      </div>

      <div className="mt-14 text-center">
        <Link
          to="/book"
          className="inline-block rounded-full bg-brand-500 px-8 py-3.5 text-xs font-bold uppercase tracking-widest text-white shadow-soft transition hover:bg-brand-600"
        >
          Book a Drop-off
        </Link>
      </div>
    </section>
  );
}
