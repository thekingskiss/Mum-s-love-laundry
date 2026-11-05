// Small structured logger: one line per event, no extra dependency.
//   production / LOG_FORMAT=json  ->  {"time":"...","level":"error","msg":"...","status":500}
//   development                   ->  readable text with the same fields
// LOG_LEVEL (error | warn | info | debug) sets the minimum level; default info.
//
// Never pass passwords, tokens, or request bodies as fields.
const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

function threshold() {
  return LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;
}

function asJson() {
  return process.env.LOG_FORMAT === 'json' || process.env.NODE_ENV === 'production';
}

// Errors don't serialize usefully by default, so keep what helps debugging.
function normalize(value) {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, code: value.code, stack: value.stack };
  }
  return value;
}

function write(level, msg, fields = {}) {
  if (LEVELS[level] > threshold()) return;
  const clean = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, normalize(v)]));
  const stream = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
  if (asJson()) {
    stream.write(`${JSON.stringify({ time: new Date().toISOString(), level, msg, ...clean })}\n`);
  } else {
    const extra = Object.keys(clean).length
      ? ` ${Object.entries(clean).map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' ')}`
      : '';
    stream.write(`${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} ${msg}${extra}\n`);
  }
}

const logger = {
  error: (msg, fields) => write('error', msg, fields),
  warn: (msg, fields) => write('warn', msg, fields),
  info: (msg, fields) => write('info', msg, fields),
  debug: (msg, fields) => write('debug', msg, fields),
};

// Logs one line per finished request: method, path (without the query string,
// which can carry tokens), status and duration.
function requestLogger(req, res, next) {
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number((process.hrtime.bigint() - started) / 1000000n);
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    write(level, 'request', {
      method: req.method,
      path: (req.originalUrl || req.url).split('?')[0],
      status: res.statusCode,
      ms,
    });
  });
  next();
}

module.exports = { logger, requestLogger };
