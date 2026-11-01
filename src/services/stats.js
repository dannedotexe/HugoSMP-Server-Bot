'use strict';

// Statistiken und Bewertungen: Zähler pro Tag (Berlin-Zeit), Umsatz,
// beliebteste Artikel und alle Bewertungen. Liegt in data.stats / data.reviews.

const { loadData, saveData } = require('../store');
const { parsePriceNumber } = require('../util');

const MAX_ORDERS = 2000;
const MAX_REVIEWS = 2000;
const MAX_DAYS = 400;

function dayKey(time = Date.now()) {
  // sv-SE liefert JJJJ-MM-TT
  return new Date(time).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
}

function getStatsData(data = loadData()) {
  if (!data.stats || typeof data.stats !== 'object') data.stats = {};
  const s = data.stats;
  s.days = s.days && typeof s.days === 'object' ? s.days : {};
  s.orders = Array.isArray(s.orders) ? s.orders : [];
  if (!Array.isArray(data.reviews)) data.reviews = [];
  if (!s.importedOldOrders) importOldOrders(data, s);
  return s;
}

// Einmalig: Bestellungen, die es schon vor der Statistik gab, übernehmen.
function importOldOrders(data, s) {
  s.importedOldOrders = Date.now();
  for (const [channelId, meta] of Object.entries(data.dashboardOrderMeta || {})) {
    if (!meta || !meta.invoice) continue;
    const createdAt = Number(meta.invoice.createdAt) || Number(meta.updatedAt) || Date.now();
    meta.statsCreatedAt = createdAt;
    bumpDay(s, 'orders', 1, createdAt);
    if (meta.status === 'fertig') {
      const at = Number(meta.completedAt) || Number(meta.updatedAt) || createdAt;
      meta.statsCompletedAt = at;
      const revenue = invoiceTotal(meta.invoice);
      bumpDay(s, 'completed', 1, at);
      if (revenue) bumpDay(s, 'revenue', revenue, at);
      s.orders.push({
        channelId,
        orderId: meta.invoice.orderId || meta.reviewOrderId || null,
        ownerId: meta.invoice.ownerId || null,
        revenue,
        items: invoiceItems(meta.invoice),
        category: meta.category || meta.invoice.category || null,
        createdAt,
        completedAt: at
      });
    }
  }
  s.orders.sort((a, b) => a.completedAt - b.completedAt);
  saveData(data);
}

function bumpDay(s, field, amount = 1, time = Date.now()) {
  const key = dayKey(time);
  const day = s.days[key] || (s.days[key] = {});
  day[field] = Number(day[field] || 0) + amount;

  const keys = Object.keys(s.days);
  if (keys.length > MAX_DAYS) {
    keys.sort().slice(0, keys.length - MAX_DAYS).forEach(k => delete s.days[k]);
  }
}

// Einfache Zähler: 'joins', 'leaves', 'tickets'
function recordEvent(field, amount = 1) {
  const data = loadData();
  bumpDay(getStatsData(data), field, amount);
  saveData(data);
}

function invoiceTotal(invoice) {
  const value = parsePriceNumber(invoice?.total);
  return value !== null && value > 0 ? Math.round(value * 100) / 100 : 0;
}

function invoiceItems(invoice) {
  if (Array.isArray(invoice?.items) && invoice.items.length) {
    return invoice.items
      .filter(row => row && row.name)
      .map(row => ({ name: String(row.name).slice(0, 80), quantity: Number(row.quantity) || 1 }));
  }
  return [];
}

// Wird bei jeder Änderung einer Bestellung aufgerufen (updateDashboardOrderMeta).
// Zählt jede Bestellung genau einmal als „neu“ und einmal als „fertig“.
function trackOrderMeta(data, channelId, meta) {
  const s = getStatsData(data);
  let changed = false;

  if (meta.invoice && !meta.statsCreatedAt) {
    meta.statsCreatedAt = Date.now();
    bumpDay(s, 'orders');
    changed = true;
  }

  if (meta.status === 'fertig' && !meta.statsCompletedAt) {
    const at = Date.now();
    meta.statsCompletedAt = at;
    const revenue = invoiceTotal(meta.invoice);
    bumpDay(s, 'completed');
    if (revenue) bumpDay(s, 'revenue', revenue);
    s.orders.push({
      channelId,
      orderId: meta.invoice?.orderId || meta.reviewOrderId || null,
      ownerId: meta.invoice?.ownerId || null,
      revenue,
      items: invoiceItems(meta.invoice),
      category: meta.category || meta.invoice?.category || null,
      createdAt: meta.statsCreatedAt || at,
      completedAt: at
    });
    if (s.orders.length > MAX_ORDERS) s.orders.splice(0, s.orders.length - MAX_ORDERS);
    changed = true;
  }

  return changed;
}

function addReview({ orderId, userId, username, stars, item, text }) {
  const data = loadData();
  const s = getStatsData(data);
  const review = {
    orderId: String(orderId || ''),
    userId: String(userId || ''),
    username: String(username || '').slice(0, 80),
    stars: Math.max(1, Math.min(5, Number(stars) || 0)),
    item: String(item || '').slice(0, 100),
    text: String(text || '').slice(0, 1000),
    at: Date.now()
  };
  data.reviews.push(review);
  if (data.reviews.length > MAX_REVIEWS) data.reviews.splice(0, data.reviews.length - MAX_REVIEWS);
  bumpDay(s, 'reviews');
  saveData(data);
  return review;
}

function getReviewSummary(data = loadData()) {
  getStatsData(data);
  const reviews = data.reviews;
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  for (const r of reviews) {
    counts[r.stars] = (counts[r.stars] || 0) + 1;
    sum += r.stars;
  }
  return {
    count: reviews.length,
    average: reviews.length ? Math.round((sum / reviews.length) * 10) / 10 : null,
    counts,
    latest: reviews.slice(-10).reverse()
  };
}

function getStats(rangeDays = 30, data = loadData()) {
  const s = getStatsData(data);
  const days = [];
  const now = Date.now();
  for (let i = rangeDays - 1; i >= 0; i--) {
    const key = dayKey(now - i * 86400000);
    const d = s.days[key] || {};
    days.push({
      date: key,
      orders: d.orders || 0,
      completed: d.completed || 0,
      revenue: Math.round((d.revenue || 0) * 100) / 100,
      joins: d.joins || 0,
      leaves: d.leaves || 0,
      tickets: d.tickets || 0,
      reviews: d.reviews || 0,
      responses: d.responses || 0,
      responseMinutes: d.responseMinutes || 0
    });
  }

  const sumOf = field => days.reduce((sum, d) => sum + d[field], 0);
  const since = now - rangeDays * 86400000;
  const recentOrders = s.orders.filter(o => o.completedAt >= since);

  const itemMap = new Map();
  for (const order of recentOrders) {
    for (const row of order.items || []) {
      const key = row.name.toLowerCase();
      const entry = itemMap.get(key) || { name: row.name, quantity: 0, orders: 0 };
      entry.quantity += row.quantity;
      entry.orders += 1;
      itemMap.set(key, entry);
    }
  }
  const topItems = [...itemMap.values()].sort((a, b) => b.orders - a.orders || b.quantity - a.quantity).slice(0, 8);

  const durations = recentOrders
    .map(o => o.completedAt - o.createdAt)
    .filter(ms => ms > 0);
  const avgDeliveryMinutes = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 60000)
    : null;

  const totalRevenue = Math.round(sumOf('revenue') * 100) / 100;
  const completed = sumOf('completed');

  return {
    rangeDays,
    days,
    totals: {
      orders: sumOf('orders'),
      completed,
      revenue: totalRevenue,
      averageOrder: completed ? Math.round((totalRevenue / completed) * 100) / 100 : 0,
      joins: sumOf('joins'),
      leaves: sumOf('leaves'),
      tickets: sumOf('tickets'),
      reviews: sumOf('reviews'),
      avgDeliveryMinutes,
      avgResponseMinutes: sumOf('responses') ? Math.round(sumOf('responseMinutes') / sumOf('responses')) : null
    },
    allTime: {
      completed: s.orders.length,
      revenue: Math.round(s.orders.reduce((sum, o) => sum + (o.revenue || 0), 0) * 100) / 100
    },
    topItems,
    reviews: getReviewSummary(data)
  };
}

module.exports = {
  dayKey,
  recordEvent,
  trackOrderMeta,
  addReview,
  getReviewSummary,
  getStats
};
