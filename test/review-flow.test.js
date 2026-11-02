'use strict';

// Bewertungs-Ablauf mit nachgebauten Discord-Interaktionen
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DATA_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'hsb-rev-')), 'data.json');
process.env.DISCORD_TOKEN = '';

test('Bewerten: Sterne-Buttons → Formular mit nur Textfeld, wenn die Bestellung bekannt ist', async () => {
  const store = require('../src/store');
  const data = store.loadData();
  data.dashboardOrderMeta = { chan1: { invoice: { itemsText: 'Elytra x1' } } };
  store.saveData(data);

  const discord = require('discord.js');
  const ctx = { ...discord, ...require('../src/config'), ...require('../src/theme'), ...require('../src/store'), ...require('../src/services/tickets') };
  const tickets = require('../src/features/tickets')(ctx);

  let reply = null;
  await tickets.button({ customId: 'bewerten_42_#0007', user: { id: '42' }, reply: async r => { reply = r; } });
  const labels = reply.components[0].toJSON().components.map(b => b.custom_id);
  assert.deepEqual(labels, [1, 2, 3, 4, 5].map(n => `review_star_42_#0007_${n}`));

  let modal = null;
  await tickets.button({ customId: 'review_star_42_#0007_5', user: { id: '42' }, channel: { id: 'chan1' }, showModal: async m => { modal = m.toJSON(); } });
  assert.equal(modal.custom_id, 'review_modal_42_#0007_5');
  assert.equal(modal.components.length, 1, 'nur Textfeld');

  await tickets.button({ customId: 'review_star_42_#0007_4', user: { id: '42' }, channel: { id: 'unbekannt' }, showModal: async m => { modal = m.toJSON(); } });
  assert.equal(modal.components.length, 1, 'nie „Was hast du gekauft?“ – macht der Bot');
});

test('Erinnerung nach 24 Std. nur einmal, nicht bei schon bewerteten Bestellungen', () => {
  const r = require('../src/services/reviews');
  r.trackReviewRequest('#0100', 'u1', 'c1');
  r.trackReviewRequest('#0101', 'u2', 'c2');
  const later = Date.now() + 25 * 60 * 60 * 1000;
  assert.equal(r.dueReviewReminders(Date.now()).length, 0, 'nicht vor 24 Std.');
  const due = r.dueReviewReminders(later, id => id === '#0101');
  assert.deepEqual(due.map(d => d.orderId), ['#0100']);
  r.markReviewReminded('#0100');
  assert.equal(r.dueReviewReminders(later).filter(d => d.orderId === '#0100').length, 0);
  r.buildReviewReminderCard('u1', '#0100').components.forEach(c => c.toJSON());
});

test('Team-Antwort erscheint unter der Bewertung', () => {
  const r = require('../src/services/reviews');
  const stats = require('../src/services/stats');
  stats.addReview({ orderId: '#0200', userId: 'u9', username: 'kunde', stars: 5, text: 'top' });
  const saved = r.setReviewReply('#0200', { text: 'Danke dir!', by: 'Chris', at: 1 });
  assert.equal(saved.reply.text, 'Danke dir!');
  const payload = r.buildReviewCard({ user: { id: 'u9', username: 'kunde' }, stars: 5, text: 'top', item: 'Elytra', orderId: '#0200', reply: saved.reply });
  const json = JSON.stringify(payload.components.map(c => c.toJSON()));
  assert.match(json, /Antwort vom Team/);
  assert.match(json, /review_reply_#0200/);
  assert.equal(r.setReviewReply('#9999', { text: 'x', by: 'y' }), null);
});
