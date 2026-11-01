'use strict';

// Kleine, reine Hilfsfunktionen (ohne Discord) – mit Tests in test/util.test.js

function cleanUsername(username) {
  return username
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '')
    .slice(0, 80);
}

function cleanShortText(value, limit = 120) {
  return String(value || '').trim().slice(0, limit);
}

function cleanLongText(value, limit = 1200) {
  return String(value || '').trim().slice(0, limit);
}

function normalizeStockItemId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
    .slice(0, 30);
}

function parsePriceNumber(value) {
  const clean = String(value || '')
    .replace(/[^\d,.]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const number = Number.parseFloat(clean);
  return Number.isFinite(number) ? number : null;
}

function formatEuroValue(value) {
  if (!Number.isFinite(value)) return '';
  return `${value.toFixed(2).replace('.', ',')} €`;
}

// Dauer wie „30m“, „2h“, „1d12h“ oder „1d 6h 30m“ → Millisekunden (null bei Unsinn)
function parseDuration(str) {
  const text = String(str || '').trim().toLowerCase().replace(/\s+/g, '');
  if (!/^(\d+[smhd])+$/.test(text)) return null;
  const unit = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  let ms = 0;
  for (const [, n, u] of text.matchAll(/(\d+)([smhd])/g)) ms += Number(n) * unit[u];
  return ms > 0 ? ms : null;
}

function formatTimeLeft(ms) {
  if (ms <= 0) return 'Beendet';
  const d = Math.floor(ms / 86400000); ms %= 86400000;
  const h = Math.floor(ms / 3600000); ms %= 3600000;
  const m = Math.floor(ms / 60000); ms %= 60000;
  const s = Math.floor(ms / 1000);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s && !d) parts.push(`${s}s`);
  return parts.join(' ') || '< 1s';
}

function joinEmbedLines(lines, limit = 3600) {
  const output = [];
  let length = 0;

  for (const line of lines) {
    const nextLength = length + line.length + (output.length ? 2 : 0);
    if (nextLength > limit) {
      output.push('... weitere Items im Stock-Tab');
      break;
    }
    output.push(line);
    length = nextLength;
  }

  return output.join('\n\n') || 'Keine Items ausgewählt.';
}

function stockStatusText(amount) {
  if (amount === 0) return '-# Ausverkauft';
  if (amount <= 5) return `-# Nur noch ${amount} verfügbar`;
  return `-# ${amount} verfügbar`;
}

module.exports = {
  cleanUsername,
  cleanShortText,
  cleanLongText,
  normalizeStockItemId,
  parsePriceNumber,
  formatEuroValue,
  parseDuration,
  formatTimeLeft,
  joinEmbedLines,
  stockStatusText,
};
