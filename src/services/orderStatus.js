'use strict';

// Bestell-Status für Kunden: /bestellung zeigt die eigenen Bestellungen mit
// Fortschritt; ändert das Team den Status, sieht der Kunde das im Ticket.

const { loadData } = require('../store');
const { card } = require('../cards');
const { e } = require('../emojis');

const STEPS = [
  { key: 'offen', label: 'Eingegangen', icon: 'clipboard', fallback: '📋' },
  { key: 'bearbeitung', label: 'In Bearbeitung', icon: 'clock', fallback: '⏳' },
  { key: 'bezahlt', label: 'Bezahlt', icon: 'card', fallback: '💳' },
  { key: 'fertig', label: 'Geliefert', icon: 'check', fallback: '✅' }
];

function statusLabel(status) {
  if (status === 'storniert') return 'Storniert';
  return STEPS.find(s => s.key === status)?.label || 'Eingegangen';
}

// ● ● ○ ○  Eingegangen → In Bearbeitung → …
function progressLine(status) {
  if (status === 'storniert') return `${e('cross', '❌')} **Storniert**`;
  const index = Math.max(0, STEPS.findIndex(s => s.key === status));
  return STEPS.map((step, i) => {
    if (i > index) return `▫️ ${step.label}`;
    const icon = e(step.icon, step.fallback);
    return i === index ? `${icon} **${step.label}**` : `${icon} ${step.label}`;
  }).join('  ›  ');
}

function getUserOrders(userId, data = loadData()) {
  return Object.entries(data.dashboardOrderMeta || {})
    .filter(([, meta]) => meta?.invoice?.ownerId === userId)
    .map(([channelId, meta]) => ({
      channelId,
      orderId: meta.invoice.orderId || meta.reviewOrderId || '?',
      status: meta.status || 'offen',
      items: meta.invoice.itemsText || (meta.invoice.items || []).map(r => `${r.name} x${r.quantity}`).join(', '),
      total: meta.invoice.total || 'Offen',
      createdAt: meta.invoice.createdAt || meta.updatedAt || 0,
      updatedAt: meta.updatedAt || 0
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

function buildMyOrdersCard(user, orders) {
  if (!orders.length) {
    return card({
      tone: 'neutral',
      eyebrow: `${e('box', '📦')} Deine Bestellungen`,
      title: 'Noch keine Bestellungen',
      body: 'Sobald du über das Ticket-Panel bestellst, siehst du hier den Status.',
      timestamp: false
    });
  }

  const blocks = orders.slice(0, 5).map(order => [
    `**Bestellung #${String(order.orderId).replace(/^#/, '')}** · <#${order.channelId}>`,
    `-# ${String(order.items || '—').replace(/\n/g, ', ').slice(0, 150)} · ${order.total}`,
    progressLine(order.status),
    order.updatedAt ? `-# Zuletzt geändert <t:${Math.floor(order.updatedAt / 1000)}:R>` : null
  ].filter(Boolean).join('\n'));

  return card({
    tone: 'primary',
    eyebrow: `${e('box', '📦')} Deine Bestellungen`,
    title: `Hallo ${user.username}!`,
    body: orders.length > 5 ? `Hier sind deine 5 neuesten von ${orders.length} Bestellungen.` : 'Hier ist der aktuelle Stand:',
    thumbnail: user.displayAvatarURL?.({ size: 128 }) || null,
    blocks,
    timestamp: false
  });
}

// Kurze Info im Ticket, wenn das Team den Status ändert
function buildStatusChangeCard(orderId, status, ownerId) {
  const tone = status === 'storniert' ? 'danger' : status === 'fertig' ? 'success' : 'primary';
  return card({
    tone,
    eyebrow: `${e('refresh', '🔄')} Status-Update`,
    title: `Bestellung ${orderId}: ${statusLabel(status)}`,
    body: progressLine(status),
    footer: 'Mit /bestellung siehst du jederzeit den Stand',
    mention: ownerId ? `<@${ownerId}>` : null,
    allowedMentions: { users: ownerId ? [ownerId] : [] }
  });
}

module.exports = {
  STEPS,
  statusLabel,
  progressLine,
  getUserOrders,
  buildMyOrdersCard,
  buildStatusChangeCard
};
