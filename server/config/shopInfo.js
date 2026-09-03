// Server-side mirror of client/src/lib/shopInfo.js — used as the fallback
// brand/contact line on receipts when the order's branch has no address/
// phone/email of its own set yet. Kept in sync manually since client and
// server don't share a module tree.
const SHOP_NAME = "Mum's Love Laundry";
const SHOP_ADDRESS = 'Akuapem-Akropong, Opposite Old Police Station, Eastern Region, Ghana';
const SHOP_PHONE = '+233244980843';
const SHOP_EMAIL = 'hello@mumslovelaundry.com';

module.exports = { SHOP_NAME, SHOP_ADDRESS, SHOP_PHONE, SHOP_EMAIL };
