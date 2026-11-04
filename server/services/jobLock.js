const pool = require('../config/db');

const LOCK_NAMESPACE = 187004;
const JOB_IDS = {
  'pickup-reminders': 1,
  'birthday-greetings': 2,
  'balance-due-reminders': 3,
  'invoice-reminders': 4,
};

async function runWithJobLock(name, task) {
  const jobId = JOB_IDS[name];
  if (!jobId) throw new Error('Unknown scheduled job: ' + name);

  const client = await pool.connect();
  let locked = false;
  let brokenConnection;
  try {
    const result = await client.query(
      'SELECT pg_try_advisory_lock($1, $2) AS locked',
      [LOCK_NAMESPACE, jobId]
    );
    locked = result.rows[0].locked;
    if (!locked) {
      console.log('[jobs] ' + name + ' skipped; another instance holds the lock.');
      return 0;
    }
    return await task();
  } finally {
    if (locked) {
      try {
        await client.query('SELECT pg_advisory_unlock($1, $2)', [LOCK_NAMESPACE, jobId]);
      } catch (error) {
        brokenConnection = error;
        console.error('[jobs] Could not release ' + name + ' lock:', error.message);
      }
    }
    client.release(brokenConnection);
  }
}

module.exports = { runWithJobLock };