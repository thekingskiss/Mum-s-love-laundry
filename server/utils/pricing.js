// A promo_price overrides the normal unit price (flat or per-kg) while its
// window is active. Either bound may be open-ended (null).
function isPromoActive(service, now = new Date()) {
  if (service.promo_price == null) return false;
  if (service.promo_starts_at && new Date(service.promo_starts_at) > now) return false;
  if (service.promo_ends_at && new Date(service.promo_ends_at) < now) return false;
  return true;
}

function getUnitPrice(service) {
  if (isPromoActive(service)) return Number(service.promo_price);
  return service.pricing_unit === 'per_kg' ? Number(service.price_per_kg) : Number(service.base_price);
}

function calculateOrderTotal(service, estimatedKg) {
  const unitPrice = getUnitPrice(service);
  if (service.pricing_unit === 'per_kg') {
    return unitPrice * Number(estimatedKg);
  }
  return unitPrice;
}

module.exports = { isPromoActive, getUnitPrice, calculateOrderTotal };
