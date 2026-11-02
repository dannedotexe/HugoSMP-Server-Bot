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
  assert.equal(modal.components.length, 1, 'nur Textfeld – Gekauftes kennt der Bot');

  await tickets.button({ customId: 'review_star_42_#0007_4', user: { id: '42' }, channel: { id: 'unbekannt' }, showModal: async m => { modal = m.toJSON(); } });
  assert.equal(modal.components.length, 2, 'unbekannte Bestellung → Feld „Was hast du gekauft?“');
});
