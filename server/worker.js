require('dotenv').config();

const cron = require('node-cron');
const pool = require('./config/db');
const { runPickupReminders } = require('./services/pickupReminders');
const { sendBirthdayGreetings } = require('./services/birthdayGreetings');
const { runBalanceDueReminders } = require('./services/balanceDueReminders');
const { runInvoiceReminders } = require('./services/invoiceReminders');

const timezone = 'Africa/Accra';
const jobs = [
  { name: 'pickup reminders', schedule: '0 9 * * *', run: runPickupReminders },
  { name: 'birthday greetings', schedule: '5 9 * * *', run: sendBirthdayGreetings },
  { name: 'balance reminders', schedule: '10 9 * * *', run: runBalanceDueReminders },
  { name: 'invoice reminders', schedule: '15 9 * * *', run: runInvoiceReminders },
];

const activeRuns = new Set();

function executeJob(name, run) {
  const execution = run()
    .then((count) => console.log('[jobs] ' + name + ': processed ' + count + ' notification(s).'))
    .catch((error) => console.error('[jobs] ' + name + ' failed:', error.message));
  activeRuns.add(execution);
  execution.finally(() => activeRuns.delete(execution));
}

const tasks = jobs.map(({ name, schedule, run }) =>
  cron.schedule(schedule, () => executeJob(name, run), { timezone })
);

console.log('Reminder worker scheduled ' + jobs.length + ' jobs in ' + timezone + '.');

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  tasks.forEach((task) => task.stop());
  await Promise.allSettled(Array.from(activeRuns));
  await pool.end();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);