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
  assert.equal(priced.total, 144, '+20 % Paysafecard');
  const view = JSON.stringify(calls.update.components.map(x => x.toJSON()));
  assert.match(view, /144,00 €/);
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

test('/zahlungsinfo ohne Text öffnet ein Textfeld, Speichern klappt', async () => {
  const cart = require('../src/features/cart')();
  let modal = null;
  await cart.command({ commandName: 'zahlungsinfo', options: { getString: k => (k === 'methode' ? 'paypal' : null) }, showModal: async m => { modal = m.toJSON(); } });
  assert.equal(modal.custom_id, 'cart_payinfo_paypal');
  let reply = null;
  await cart.modal({ customId: 'cart_payinfo_paypal', user: { id: 'x' }, fields: { getTextInputValue: () => 'paypal.me/Hugo\nFreunde & Familie' }, reply: async r => { reply = r; } });
  assert.match(reply.content, /Gespeichert/);
  assert.equal(store.loadData().paymentInfo.paypal, 'paypal.me/Hugo\nFreunde & Familie');
});

test('Bezahlen: PayPal-Link mit Betrag, Bitcoin kopierbar, „Ich habe bezahlt“ und Bestätigen', async () => {
  const { paypalLink, formatPaymentInfo, buildPayRow } = require('../src/features/cart')._internals;
  assert.equal(paypalLink('paypal.me/HugoIrlTrade\nFreunde', 7.5), 'https://paypal.me/HugoIrlTrade/7.50EUR');
  assert.equal(paypalLink('an x@y.de', 7.5), null);
  assert.match(formatPaymentInfo('Adresse: bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'), /`bc1q[^`]+`/);
  const row = buildPayRow('paypal', 'paypal.me/Hugo', 12).toJSON().components;
  assert.equal(row[0].url, 'https://paypal.me/Hugo/12.00EUR');
  assert.equal(row[1].custom_id, 'pay_done');
  assert.equal(buildPayRow('paysafe', '', 12).toJSON().components[0].custom_id, 'pay_psc');

  const tickets = require('../src/services/tickets');
  const cart = require('../src/features/cart')();
  const sent = [];
  const channel = { id: 'payc', topic: 'owner:700000000000000007;type:bestellung;order:0009', send: async p => { sent.push(p); return {}; } };
  tickets.updateDashboardOrderMeta('payc', { status: 'offen' });
  let reply = null;
  await cart.button({ customId: 'pay_done', user: { id: 'fremd' }, channel, reply: async r => { reply = r; } });
  assert.match(reply.content, /nur der Kunde/);
  await cart.button({ customId: 'pay_done', user: { id: '700000000000000007' }, channel, reply: async r => { reply = r; } });
  assert.match(reply.content, /Danke/);
  assert.match(JSON.stringify(sent[0].components.map(c => c.toJSON())), /pay_confirm/);

  let updated = null;
  const staff = { roles: { cache: { has: () => false } }, permissions: { has: () => true } };
  await cart.button({ customId: 'pay_confirm', user: { id: 's1', username: 'Chris' }, member: staff, channel, update: async u => { updated = u; } });
  assert.ok(updated);
  assert.equal(tickets.getOrderDashboardMeta(store.loadData(), 'payc').status, 'bezahlt');
  assert.match(JSON.stringify(sent[1].components.map(c => c.toJSON())), /Bezahlt/, 'Kunde sieht Status-Update');
});

test('Mindestbestellwert 10 €: darunter kein Absenden, Hinweis wie viel fehlt', () => {
  const { carts, buildCartView } = require('../src/features/cart')._internals;
  const data = store.loadData();
  data.stockItems = [{ id: 'money', name: '1M Money', price: '0,20 €', emoji: '💰' }];
  data.stock = { money: 500 };
  store.saveData(data);
  carts.set('min1', { items: [{ id: 'money', qty: 20 }], payment: 'paypal', ingame: 'Steve', at: Date.now() });
  let view = JSON.stringify(buildCartView('min1').components.map(c => c.toJSON()));
  assert.match(view, /es fehlen noch \*\*6,00 €\*\*/);
  assert.match(view, /"custom_id":"cart_submit"[^}]*"disabled":true/);
  carts.get('min1').items[0].qty = 50;
  view = JSON.stringify(buildCartView('min1').components.map(c => c.toJSON()));
  assert.doesNotMatch(view, /es fehlen noch/);
  assert.match(view, /"custom_id":"cart_submit"(?![^}]*"disabled":true)/);
});

test('Lager-Panel: Verfügbares oben, Ausverkauftes gesammelt unten', () => {
  const { buildStockEmbed } = require('../src/services/stock');
  const data = store.loadData();
  data.stockItems = [
    { id: 'money', name: '1M Money', price: '0,20 €', emoji: '💰' },
    { id: 'elytra', name: 'Elytra', price: '110 €', emoji: '🪽' },
    { id: 'mace', name: 'Mace', price: '1,50 €', emoji: '🔨' }
  ];
  data.stock = { money: 562, elytra: 0, mace: 3 };
  store.saveData(data);
  const d = buildStockEmbed().toJSON().description;
  assert.match(d, /Auf Lager[\s\S]*1M Money[\s\S]*\*\*562\*\* verfügbar[\s\S]*nur noch 3[\s\S]*Ausverkauft[\s\S]*Elytra/);
  assert.equal(buildStockEmbed().toJSON().title, 'Lagerbestand', 'Erkennung im Kanal bleibt');
});
