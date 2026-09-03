const pool = require('../config/db');

async function isZoneSupported(zone) {
  if (typeof zone !== 'string' || !zone.trim()) return false;
  const result = await pool.query(
    'SELECT 1 FROM service_zones WHERE is_active = true AND lower(zone_name) = lower($1)',
    [zone.trim()]
  );
  return result.rowCount > 0;
}

async function getActiveZoneNames() {
  const result = await pool.query('SELECT zone_name FROM service_zones WHERE is_active = true ORDER BY zone_name');
  return result.rows.map((r) => r.zone_name);
}

module.exports = { isZoneSupported, getActiveZoneNames };
