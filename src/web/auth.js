'use strict';

// ── Dashboard-Login ──
// Nach dem Login gibt es ein eigenes, signiertes Token (30 Tage gültig) statt des
// Passworts. Es übersteht Neustarts und wird ungültig, wenn das Passwort geändert wird.
// Das Passwort selbst wird nie gespeichert oder in Adressen übertragen.
const crypto = require('crypto');
const { DASHBOARD_PASSWORD } = require('../config');
const DASHBOARD_TOKEN_DAYS = 30;
const tokenKey = () => crypto.createHash('sha256').update(`hugosmp-dashboard:${DASHBOARD_PASSWORD}`).digest();
const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

function createDashboardToken() {
  const expires = Date.now() + DASHBOARD_TOKEN_DAYS * 24 * 3600 * 1000;
  const sig = crypto.createHmac('sha256', tokenKey()).update(String(expires)).digest('base64url');
  return `${expires}.${sig}`;
}

function validDashboardToken(token) {
  const [expires, sig] = String(token || '').split('.');
  if (!/^\d{13}$/.test(expires || '') || Number(expires) < Date.now() || !sig) return false;
  const expected = crypto.createHmac('sha256', tokenKey()).update(expires).digest('base64url');
  return safeEqual(sig, expected);
}

// Einfache Bremse pro IP (Login, öffentliche Bestellungen)
function rateLimiter({ max, windowMs, message }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip;
    const list = (hits.get(key) || []).filter(t => now - t < windowMs);
    if (list.length >= max) {
      return res.status(429).json({ success: false, error: message });
    }
    list.push(now);
    hits.set(key, list);
    if (hits.size > 5000) hits.clear();
    next();
  };
}


module.exports = { createDashboardToken, validDashboardToken, safeEqual, rateLimiter };
