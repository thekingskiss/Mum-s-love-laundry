import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { CurrencyProvider, useCurrency } from './CurrencyContext.jsx';
import api from '../api/axios';

vi.mock('../api/axios', () => ({ default: { get: vi.fn() } }));
vi.mock('./AuthContext.jsx', () => ({ useAuth: () => ({ user: { preferred_currency: 'NGN' } }) }));

const currencies = [
  { code: 'GHS', name: 'Ghanaian Cedi', symbol: 'GHS', rate_to_ghs: 1 },
  { code: 'NGN', name: 'Naira', symbol: '₦', rate_to_ghs: 100 },
];

let ctx;
function Probe() {
  ctx = useCurrency();
  return <p>{ctx.active.code}</p>;
}

beforeEach(() => {
  localStorage.clear();
  api.get.mockResolvedValue({ data: { currencies } });
});

describe('CurrencyProvider', () => {
  it('shows prices in the signed-in person\'s preferred currency', async () => {
    render(<CurrencyProvider><Probe /></CurrencyProvider>);
    await waitFor(() => expect(screen.getByText('NGN')).toBeInTheDocument());
    expect(ctx.formatPrice(12.5)).toBe('₦ 1250.00');
  });

  it('formats a fixed-price item', async () => {
    render(<CurrencyProvider><Probe /></CurrencyProvider>);
    await waitFor(() => expect(screen.getByText('NGN')).toBeInTheDocument());
    expect(ctx.formatItemPrice({ unit_price: 5 })).toBe('₦ 500.00');
  });

  it('formats a range-priced item as min – max, converted', async () => {
    render(<CurrencyProvider><Probe /></CurrencyProvider>);
    await waitFor(() => expect(screen.getByText('NGN')).toBeInTheDocument());
    expect(ctx.formatItemPrice({ unit_price: null, price_min: 10, price_max: 15 })).toBe('₦ 1000.00 – 1500.00');
  });
});
