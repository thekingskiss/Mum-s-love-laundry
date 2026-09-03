function notFound(req, res) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error(err);

  if (err.code === '23505') {
    return res.status(409).json({ error: 'That record already exists.' });
  }
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Referenced record does not exist.' });
  }

  const status = err.status || 500;
  // err.message is only safe to forward when the code deliberately threw it
  // (those set `.status`, e.g. capacity/validation errors) — an unexpected
  // 500 could otherwise leak internal details (DB errors, stack info, file
  // paths) straight to the client. Full detail still goes to the server log
  // above via console.error.
  const message = status < 500 ? err.message || 'Request failed.' : 'Internal server error.';
  res.status(status).json({ error: message });
}

module.exports = { notFound, errorHandler };
