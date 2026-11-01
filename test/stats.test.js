'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hsb-stats-'));
process.env.DATA_FILE = path.join(dir, 'data.json');
const store = require('../src/store');
const stats = require('../src/services/stats');

test('Statistik: Bestellung zählt einmal neu und einmal fertig, Umsatz stimmt', () => {
  const data = store.loadData();
  const meta = { status: 'offen', invoice: { total: '12,50 €', items: [{ name: 'Elytra', quantity: 2 }] } };
  assert.equal(stats.trackOrderMeta(data, 'c1', meta), true);
  assert.equal(stats.trackOrderMeta(data, 'c1', meta), false, 'nicht doppelt');
  meta.status = 'fertig';
  stats.trackOrderMeta(data, 'c1', meta);
  stats.trackOrderMeta(data, 'c1', meta);
  stats.recordEvent('joins');
  const s = stats.getStats(7);
  assert.equal(s.totals.orders, 1);
  assert.equal(s.totals.completed, 1);
  assert.equal(s.totals.revenue, 12.5);
  assert.equal(s.totals.joins, 1);
  assert.equal(s.topItems[0].name, 'Elytra');
  assert.equal(s.days.length, 7);
});

test('Bewertungen: Durchschnitt und Verteilung', () => {
  stats.addReview({ orderId: '#1', userId: '1', username: 'a', stars: 5, text: 'top' });
  stats.addReview({ orderId: '#2', userId: '2', username: 'b', stars: 4, text: 'gut' });
  const r = stats.getReviewSummary();
  assert.equal(r.count, 2);
  assert.equal(r.average, 4.5);
  assert.equal(r.counts[5], 1);
  assert.equal(r.latest[0].text, 'gut');
  const { buildReviewSummaryEmbed } = require('../src/services/reviews');
  assert.match(buildReviewSummaryEmbed(r).data.title, /4,5 von 5/);
});
