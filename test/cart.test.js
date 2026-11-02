'use strict';

// Warenkorb-Bestellung mit nachgebauten Discord-Klicks
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DATA_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'hsb-cart-')), 'data.json');
const store = require('../src/store');

function fakeInteraction(extra) {
  const calls = {};
  const i = {
    user: { id: 'u1', username: 'kunde' },
    guild: { channels: { cache: new Map() } },
    reply: async p => { calls.reply = p; },
    update: async p => { calls.update = p; },
    showModal: async m => { calls.modal = m.toJSON(); },
    ...extra
  };
  i.guild.channels.cache.find = () => null;
  return { i, calls };
}

test('Warenkorb: Item wählen, Menge, Zahlung, Name → Absenden möglich, Preis stimmt', async () => {
  const data = store.loadData();
  data.stockItems = [
    { id: 'money', name: '1M Money', price: '0,50 €', emoji: '💰' },
    { id: 'elytra', name: 'Elytra', price: '110 €', emoji: '🪽' },
    { id: 'leer', name: 'Ausverkauft', price: '1 €', emoji: '❌' }
  ];
  data.stock = { money: 100, elytra: 2, leer: 0 };
  store.saveData(data);

  const cart = require('../src/features/cart')();
  const { carts, priceCart } = require('../src/features/cart')._internals;

  let { i, calls } = fakeInteraction({ customId: 'ticket_cat_items_geld' });
  await cart.button(i);
  const json = JSON.stringify(calls.reply.components.map(c => c.toJSON()));
  assert.match(json, /cart_add/);
  assert.doesNotMatch(json, /"value":"leer"/, 'ausverkaufte Items stehen nicht in der Liste');
  assert.match(json, /"custom_id":"cart_submit"[^}]*"disabled":true/);

  ({ i, calls } = fakeInteraction({ customId: 'cart_add', values: ['money'] }));
  await cart.select(i);
  assert.equal(calls.modal.custom_id, 'cart_qty_money');

  ({ i, calls } = fakeInteraction({ customId: 'cart_qty_money', fields: { getTextInputValue: () => '20' } }));
  await cart.modal(i);
  ({ i, calls } = fakeInteraction({ customId: 'cart_qty_elytra', fields: { getTextInputValue: () => '5' } }));
  await cart.modal(i);
  assert.match(calls.reply.content, /nur \*\*2\*\* verfügbar/, 'mehr als auf Lager geht nicht');
  ({ i, calls } = fakeInteraction({ customId: 'cart_qty_elytra', fields: { getTextInputValue: () => '1' } }));
  await cart.modal(i);

  ({ i, calls } = fakeInteraction({ customId: 'cart_payment', values: ['paysafe'] }));
  await cart.select(i);
  ({ i, calls } = fakeInteraction({ customId: 'cart_ingame_modal', fields: { getTextInputValue: () => 'Steve_123' } }));
  await cart.modal(i);

  const c = carts.get('u1');
  const priced = priceCart(c);
  assert.equal(priced.base, 120, '20 × 0,50 + 110');
  assert.equal(priced.total, 132, '+10 % Paysafecard');
  const view = JSON.stringify(calls.update.components.map(x => x.toJSON()));
  assert.match(view, /132,00 €/);
  assert.match(view, /"custom_id":"cart_submit"(?![^}]*"disabled":true)/, 'jetzt absendbar');
});

test('Lager wird bei „fertig“ genau einmal abgezogen (nur Warenkorb-Bestellungen)', () => {
  const tickets = require('../src/services/tickets');
  const data = store.loadData();
  data.stock = { money: 100, elytra: 2 };
  store.saveData(data);
  tickets.updateDashboardOrderMeta('ch1', { status: 'offen', invoice: { fromCart: true, cartItems: [{ id: 'money', qty: 20 }, { id: 'elytra', qty: 1 }], total: '10 €' } });
  tickets.updateDashboardOrderMeta('ch1', { status: 'fertig' });
  tickets.updateDashboardOrderMeta('ch1', { status: 'fertig' });
  assert.deepEqual(store.loadData().stock, { money: 80, elytra: 1 });
  tickets.updateDashboardOrderMeta('ch2', { status: 'fertig', invoice: { items: [{ id: 'money', quantity: 50 }] } });
  assert.equal(store.loadData().stock.money, 80, 'alte Freitext-Bestellungen ändern das Lager nicht');
});
