import { describe, it, expect } from 'vitest';
import { isPromoActive, getUnitPrice, calculateOrderTotal } from '../utils/pricing';

describe('pricing', () => {
  it('is not on promo when promo_price is unset', () => {
    expect(isPromoActive({ promo_price: null })).toBe(false);
  });

  it('is on promo when within an open-ended window', () => {
    expect(isPromoActive({ promo_price: 10, promo_starts_at: null, promo_ends_at: null })).toBe(true);
  });

  it('is not on promo before promo_starts_at', () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(isPromoActive({ promo_price: 10, promo_starts_at: future, promo_ends_at: null })).toBe(false);
  });

  it('is not on promo after promo_ends_at', () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(isPromoActive({ promo_price: 10, promo_starts_at: null, promo_ends_at: past })).toBe(false);
  });

  it('uses the promo price over the base price when active', () => {
    const service = { promo_price: 12, base_price: 22, pricing_unit: 'flat' };
    expect(getUnitPrice(service)).toBe(12);
  });

  it('falls back to base_price for flat pricing with no promo', () => {
    const service = { promo_price: null, base_price: 22, pricing_unit: 'flat' };
    expect(getUnitPrice(service)).toBe(22);
  });

  it('uses price_per_kg for per_kg pricing with no promo', () => {
    const service = { promo_price: null, price_per_kg: 5, pricing_unit: 'per_kg' };
    expect(getUnitPrice(service)).toBe(5);
  });

  it('multiplies unit price by estimated kg for per_kg services', () => {
    const service = { promo_price: null, price_per_kg: 5, pricing_unit: 'per_kg' };
    expect(calculateOrderTotal(service, 3)).toBe(15);
  });

  it('ignores estimated kg for flat-priced services', () => {
    const service = { promo_price: null, base_price: 22, pricing_unit: 'flat' };
    expect(calculateOrderTotal(service, 3)).toBe(22);
  });
});
