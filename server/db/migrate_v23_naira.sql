-- Mum's Love Laundry - v23 migration: add the Nigerian Naira as a display currency.
--
-- Display only: every order is still priced and charged in GHS. The rate is the
-- mid-market rate on 4 November 2026 (1 GHS = about 115.5 NGN). Rates are set by
-- hand from here on, so this one will drift until someone updates it. A database
-- that already has NGN keeps its own rate.

BEGIN;

INSERT INTO currencies (code, name, symbol, rate_to_ghs)
VALUES ('NGN', 'Nigerian Naira', '₦', 115.5)
ON CONFLICT (code) DO NOTHING;

COMMIT;
