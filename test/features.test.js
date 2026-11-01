'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hsb-feat-'));
process.env.DATA_FILE = path.join(dir, 'data.json');
const store = require('../src/store');

test('Backup: einmal pro Tag, kaputte Datei wird nicht gesichert', () => {
  const backup = require('../src/services/backup');
  store.saveData(store.loadData());
  const name = backup.runBackup();
  assert.match(name, /^data-\d{4}-\d{2}-\d{2}\.json$/);
  assert.equal(backup.runBackup(), null, 'heute schon gesichert');
  assert.equal(backup.listBackups().length, 1);
  assert.ok(store.loadData().lastBackupAt);
});

test('Ticket-Wartezeit: Kunde wartet, Team antwortet, Erinnerung nur einmal', () => {
  const wait = require('../src/services/ticketWait');
  wait.onTicketMessage('t1', { fromStaff: false });
  const since = wait.getWait('t1').waitingSince;
  wait.onTicketMessage('t1', { fromStaff: false });
  assert.equal(wait.getWait('t1').waitingSince, since, 'Wartezeit startet beim ersten Mal');
  const later = Date.now() + 31 * 60000;
  assert.deepEqual(wait.dueReminders(later).map(r => r.channelId), ['t1']);
  wait.markReminded('t1');
  assert.equal(wait.dueReminders(later).length, 0);
  wait.onTicketMessage('t1', { fromStaff: true });
  assert.equal(wait.getWait('t1').waitingSince, null);
  const stats = require('../src/services/stats').getStats(7);
  assert.equal(stats.totals.avgResponseMinutes, 0);
  wait.clearWait('t1');
  assert.equal(wait.getWait('t1'), null);
});

test('Bestell-Status: eigene Bestellungen und Fortschritt', () => {
  const os2 = require('../src/services/orderStatus');
  const data = store.loadData();
  data.dashboardOrderMeta = {
    c1: { status: 'bezahlt', updatedAt: 2, invoice: { ownerId: 'u1', orderId: '#0007', itemsText: 'Elytra x1', total: '110 €', createdAt: 1 } },
    c2: { status: 'offen', invoice: { ownerId: 'u2', orderId: '#0008', createdAt: 1 } }
  };
  const orders = os2.getUserOrders('u1', data);
  assert.equal(orders.length, 1);
  assert.equal(orders[0].status, 'bezahlt');
  assert.match(os2.progressLine('bezahlt'), /\*\*Bezahlt\*\*/);
  assert.match(os2.progressLine('storniert'), /Storniert/);
  const user = { username: 'a', displayAvatarURL: () => 'https://example.com/a.png' };
  for (const payload of [os2.buildMyOrdersCard(user, orders), os2.buildMyOrdersCard(user, []), os2.buildStatusChangeCard('#0007', 'bezahlt', 'u1')]) {
    payload.components.forEach(c => c.toJSON());
  }
});
