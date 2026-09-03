// Thin wrapper around Paystack's REST API. Uses the global fetch (Node 18+)
// rather than pulling in an SDK — the two calls we need (initialize, verify)
// don't justify the dependency.

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

function secretKey() {
  return process.env.PAYSTACK_SECRET_KEY;
}

function configured() {
  return Boolean(secretKey());
}

async function paystackRequest(method, path, body) {
  const key = secretKey();
  if (!key) {
    throw new Error('Paystack is not configured (missing PAYSTACK_SECRET_KEY).');
  }

  const res = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok || data.status === false) {
    // Paystack's rejection reason (bad email, unsupported currency, etc.) is
    // safe and useful to show the caller — mark it a client error (4xx) so
    // errorHandler forwards the real message instead of masking it as a
    // generic 500. A network/parse failure above would still throw normally
    // and surface as an opaque 500, which is what we want for that case.
    const err = new Error(data.message || `Paystack request failed (HTTP ${res.status}).`);
    err.status = 400;
    throw err;
  }
  return data.data;
}

function initializeTransaction({ email, amountPesewas, reference, callbackUrl, metadata }) {
  return paystackRequest('POST', '/transaction/initialize', {
    email,
    amount: amountPesewas,
    currency: 'GHS',
    reference,
    callback_url: callbackUrl,
    metadata,
  });
}

function verifyTransaction(reference) {
  return paystackRequest('GET', `/transaction/verify/${encodeURIComponent(reference)}`);
}

module.exports = { configured, secretKey, initializeTransaction, verifyTransaction };
