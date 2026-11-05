const pool = require('../config/db');

// Records a sensitive change. The change itself has already succeeded by the
// time this runs, so a logging failure is reported to the server log rather
// than turned into an error for the person who made the change.
async function recordAudit(actor, { action, entityType, entityId, summary }) {
  try {
    await pool.query(
      `INSERT INTO audit_log (actor_id, actor_email, actor_role, action, entity_type, entity_id, summary)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [actor.id, actor.email, actor.role, action, entityType, entityId == null ? null : String(entityId), summary]
    );
  } catch (err) {
    console.error(`[audit] could not record ${action}: ${err.message}`);
  }
}

module.exports = { recordAudit };
