const pool = require('../config/db');

async function listZones(req, res, next) {
  try {
    const result = await pool.query(
      'SELECT zone_name FROM service_zones WHERE is_active = true ORDER BY zone_name'
    );
    res.json({ zones: result.rows.map((r) => r.zone_name) });
  } catch (err) {
    next(err);
  }
}

async function listZonesAdmin(req, res, next) {
  try {
    const result = await pool.query(
      'SELECT id, zone_name, is_active FROM service_zones ORDER BY zone_name'
    );
    res.json({ zones: result.rows });
  } catch (err) {
    next(err);
  }
}

async function createZone(req, res, next) {
  try {
    const { zone_name } = req.body;
    if (!zone_name || !zone_name.trim()) {
      return res.status(400).json({ error: 'zone_name is required.' });
    }
    const result = await pool.query(
      `INSERT INTO service_zones (zone_name)
       VALUES ($1)
       RETURNING id, zone_name, is_active`,
      [zone_name.trim()]
    );
    res.status(201).json({ zone: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function updateZone(req, res, next) {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    const result = await pool.query(
      `UPDATE service_zones SET is_active = COALESCE($1, is_active)
       WHERE id = $2
       RETURNING id, zone_name, is_active`,
      [is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Zone not found.' });
    }
    res.json({ zone: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = { listZones, listZonesAdmin, createZone, updateZone };
