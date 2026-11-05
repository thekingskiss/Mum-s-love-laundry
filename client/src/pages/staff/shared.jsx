export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function priceLabel(item) {
  if (item.unit_price != null) return `GHS ${Number(item.unit_price).toFixed(2)}`;
  return `GHS ${Number(item.price_min).toFixed(2)}–${Number(item.price_max).toFixed(2)}`;
}
