import { useEffect, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import api from '../../api/axios';
import { useCurrency } from '../../context/CurrencyContext.jsx';

const EXPENSE_CATEGORIES = ['Utilities', 'Supplies', 'Wages', 'Rent', 'Maintenance', 'Other'];

const NEW_EXPENSE = { category: 'Supplies', description: '', amount: '', expense_date: '' };

export function ExpensesTab() {
  const { formatPrice } = useCurrency();
  const [expenses, setExpenses] = useState([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(NEW_EXPENSE);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadExpenses();
  }, []);

  function loadExpenses() {
    setLoading(true);
    api
      .get('/admin/expenses')
      .then(({ data }) => {
        setExpenses(data.expenses);
        setTotal(data.total);
      })
      .catch(() => setError('Unable to load expenses.'))
      .finally(() => setLoading(false));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.amount || !form.expense_date) return;
    setSubmitting(true);
    setError('');
    try {
      await api.post('/admin/expenses', form);
      setForm(NEW_EXPENSE);
      loadExpenses();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to add that expense.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/admin/expenses/${id}`);
      loadExpenses();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to delete that expense.');
    }
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg text-ink-900 dark:text-white">Expenses</h2>
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Total: {formatPrice(total)}</p>
        </div>
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        {loading && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Loading expenses...</p>}

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-soft dark:border-slate-700 dark:bg-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {expenses.length === 0 && !loading && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400">No expenses recorded yet.</td></tr>
                )}
                {expenses.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{e.expense_date?.slice(0, 10)}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{e.category}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{e.description || '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-ink-900 dark:text-white">{formatPrice(e.amount)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleDelete(e.id)} className="text-slate-300 hover:text-red-600" aria-label="Delete expense">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div>
        <h2 className="font-display text-lg text-ink-900 dark:text-white">Add Expense</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-soft dark:border-slate-700 dark:bg-slate-800">
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          >
            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
          <input
            required
            type="number"
            step="0.01"
            min="0.01"
            placeholder="Amount (GHS)"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
          <input
            required
            type="date"
            value={form.expense_date}
            onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />} Add Expense
          </button>
        </form>
      </div>
    </div>
  );
}
