// Pickup storage policy: the first week after an order is marked
// ready_for_pickup is free; every full day after that accrues a flat fee.
const FREE_PICKUP_DAYS = 7;
const LATE_FEE_PER_DAY = 5;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// `asOf` is "now" for an order still sitting ready for pickup, or the
// order's completed_at for a picked-up order — so the fee freezes at the
// moment it was actually collected instead of continuing to grow forever.
function calculateLateFee(readyForPickupAt, asOf = new Date()) {
  if (!readyForPickupAt) {
    return { daysReady: 0, daysOverdue: 0, fee: 0 };
  }

  const daysReady = Math.floor((new Date(asOf) - new Date(readyForPickupAt)) / MS_PER_DAY);
  const daysOverdue = Math.max(0, daysReady - FREE_PICKUP_DAYS);
  const fee = daysOverdue * LATE_FEE_PER_DAY;

  return { daysReady, daysOverdue, fee };
}

module.exports = { FREE_PICKUP_DAYS, LATE_FEE_PER_DAY, calculateLateFee };
