-- Mum's Love Laundry — v11 migration: expanded service-area coverage
-- across the Akuapem-area towns of the Eastern Region the shop serves.

BEGIN;

INSERT INTO service_zones (zone_name)
VALUES
  ('Peduase'), ('Aburi'), ('Ahwerease'), ('Obosomase'), ('Tutu'),
  ('Mampong Akuapem'), ('Abotakyi'), ('Amanokrom'), ('Mamfe'), ('Larteh'),
  ('Akropong'), ('Abiriw'), ('Dawu'), ('Awukugua'), ('Adukrom'),
  ('Apirede'), ('Aseseeso (Abonse)'), ('Berekusu'), ('Atweasin'), ('Odawu'),
  ('Obodan'), ('Konkonuru'), ('Yensiso'), ('Adamorobe'), ('Gyankam')
ON CONFLICT (zone_name) DO NOTHING;

COMMIT;
