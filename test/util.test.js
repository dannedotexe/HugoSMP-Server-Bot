'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const u = require('../src/util');

test('Dauer: einzeln und kombiniert', () => {
  assert.equal(u.parseDuration('30m'), 30 * 60000);
  assert.equal(u.parseDuration('1d12h'), 36 * 3600000);
  assert.equal(u.parseDuration('1d 6h 30m'), (30 * 60 + 30) * 60000);
  assert.equal(u.parseDuration('abc'), null);
  assert.equal(u.parseDuration('0m'), null);
  assert.equal(u.formatTimeLeft(90 * 60000), '1h 30m');
  assert.equal(u.formatTimeLeft(0), 'Beendet');
});

test('Preise und Namen', () => {
  assert.equal(u.parsePriceNumber('1,50 €'), 1.5);
  assert.equal(u.parsePriceNumber('110 €'), 110);
  assert.equal(u.formatEuroValue(1.5), '1,50 €');
  assert.equal(u.cleanUsername('Sparko Happy!'), 'sparkohappy');
  assert.equal(u.normalizeStockItemId('Skeleton Spawner'), 'skeleton_spawner');
  assert.equal(u.stockStatusText(0), '-# Ausverkauft');
  assert.equal(u.stockStatusText(3), '-# Nur noch 3 verfügbar');
});
