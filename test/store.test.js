'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hsb-'));
process.env.DATA_FILE = path.join(dir, 'data.json');
const store = require('../src/store');

test('Daten: einmal im Speicher, gleichzeitige Änderungen gehen nicht verloren', async () => {
  await Promise.all(Array.from({ length: 20 }, (_, i) => Promise.resolve().then(() => store.addInvite(`u${i % 2}`))));
  assert.equal(store.getInvites('u0'), 10);
  assert.equal(store.getInvites('u1'), 10);
  const onDisk = JSON.parse(fs.readFileSync(process.env.DATA_FILE, 'utf8'));
  assert.equal(onDisk.invites.u0, 10);
  assert.equal(store.loadData(), store.loadData(), 'immer dasselbe Objekt');
});

test('Bestellnummern zählen hoch', () => {
  assert.equal(store.getNextOrderId(), '#0001');
  assert.equal(store.getNextOrderId(), '#0002');
});
