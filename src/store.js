'use strict';

const fs = require('fs');
const path = require('path');
const { DATA_FILE, STOCK_CHANNEL_ID, RESTOCK_CHANNEL_ID, STOCK_ITEMS } = require('./config');

// ── Data helpers ──────────────────────────────────────────────────
// Daten liegen einmal im Speicher: Alle Teile des Bots arbeiten auf demselben
// Objekt. Früher wurde die Datei bei jedem Zugriff neu gelesen – passierten zwei
// Dinge gleichzeitig (z. B. zwei Einladungen), konnte eins davon verloren gehen.
let dataCache = null;

function loadData() {
  if (dataCache) return dataCache;
  dataCache = readDataFile();
  return dataCache;
}

function readDataFile() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

      data.invites = data.invites || {};
      data.counted = data.counted || [];
      data.pending = data.pending || {};

      data.leaderboardMessageId = data.leaderboardMessageId || null;

      data.stockMessageId = data.stockMessageId || null;
      data.stockButtonsMessageId = data.stockButtonsMessageId || null;
      data.stockChannelId = data.stockChannelId || STOCK_CHANNEL_ID;
      data.restockChannelId = data.restockChannelId || RESTOCK_CHANNEL_ID;

      data.publicStockMessageId = data.publicStockMessageId || null;
      data.publicStockChannelId = data.publicStockChannelId || null;

      if (typeof data.nextOrderId !== 'number') data.nextOrderId = 1;
      if (typeof data.nextTicketOrderId !== 'number') data.nextTicketOrderId = 1;

      data.reviewedOrders = data.reviewedOrders || [];
      data.giveaways = data.giveaways || {};
      data.warnings = data.warnings || {};
      data.tempbans = data.tempbans || {};
      data.welcomeConfig = data.welcomeConfig || {};
      data.leaveConfig = data.leaveConfig || {};
      data.presence = data.presence || null;
      data.dmThreads = data.dmThreads || {};
      data.dashboardTicketMeta = data.dashboardTicketMeta || {};
      data.dashboardOrderMeta = data.dashboardOrderMeta || {};
      data.dashboardShop = data.dashboardShop || {};
      data.shopOffers = Array.isArray(data.shopOffers) ? data.shopOffers : [];
      data.reviewTicketDecisions = data.reviewTicketDecisions || [];
      data.orderFormsSubmitted = data.orderFormsSubmitted || {};

      if (!data.stock) data.stock = {};

      // Migrate hardcoded STOCK_ITEMS into data.stockItems on first run
      if (!data.stockItems || data.stockItems.length === 0) {
        data.stockItems = JSON.parse(JSON.stringify(STOCK_ITEMS));
      }

      // Fix any items where emoji was stored as a raw ID number
      data.stockItems.forEach(item => {
        if (item.emoji && /^\d{15,20}$/.test(item.emoji.trim())) {
          // Raw ID stored as emoji — build proper format
          item.emojiId = item.emoji.trim();
          item.emoji = `<:item:${item.emojiId}>`;
        } else if (item.emoji) {
          // Re-extract emojiId in case it got lost
          const m = item.emoji.match(/<a?:([^:]+):(\d+)>/);
          if (m) item.emojiId = m[2];
        }
      });

      data.stockItems.forEach(item => {
        if (typeof data.stock[item.id] !== 'number') {
          data.stock[item.id] = 0;
        }
      });

      return data;
    }
  } catch (e) {
    // Kaputte Datei NICHT mit leeren Daten überschreiben: erst wegsichern
    console.error('loadData error:', e.message);
    try {
      const backup = `${DATA_FILE}.kaputt-${Date.now()}`;
      fs.copyFileSync(DATA_FILE, backup);
      console.error(`⚠️ Datendatei war unlesbar – gesichert als ${backup}`);
    } catch { /* nichts zu sichern */ }
  }

  const initial = {
    invites: {},
    counted: [],
    pending: {},
    leaderboardMessageId: null,

    stockMessageId: null,
    stockButtonsMessageId: null,
    stockChannelId: STOCK_CHANNEL_ID,
    restockChannelId: RESTOCK_CHANNEL_ID,

    publicStockMessageId: null,
    publicStockChannelId: null,

    nextOrderId: 1,
    nextTicketOrderId: 1,

    reviewedOrders: [],
    reviewTicketDecisions: [],
    orderFormsSubmitted: {},
    giveaways: {},
    warnings: {},
    tempbans: {},
    welcomeConfig: {},
    leaveConfig: {},
    presence: null,
    dmThreads: {},
    dashboardTicketMeta: {},
    dashboardOrderMeta: {},
    dashboardShop: {},
    shopOffers: [],

    stock: {},
    stockItems: JSON.parse(JSON.stringify(STOCK_ITEMS))
  };

  STOCK_ITEMS.forEach(item => {
    initial.stock[item.id] = 0;
  });

  return initial;
}

function saveData(data) {
  if (data) dataCache = data;
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    // Erst in eine temp-Datei schreiben, dann ersetzen – so bleibt die
    // Datei auch bei einem Absturz mitten im Schreiben lesbar.
    const tmp = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, DATA_FILE);
  } catch (e) {
    console.error('saveData error:', e.message);
  }
}

function getInvites(userId) {
  return loadData().invites[userId] ?? 0;
}

function setInvites(userId, amount) {
  const data = loadData();
  data.invites[userId] = Math.max(0, amount);
  saveData(data);
}

function addInvite(userId) {
  const data = loadData();
  data.invites[userId] = (data.invites[userId] ?? 0) + 1;
  saveData(data);
  return data.invites[userId];
}

function hasBeenCounted(memberId) {
  return loadData().counted?.includes(memberId) ?? false;
}

function markAsCounted(memberId) {
  const data = loadData();
  if (!data.counted) data.counted = [];
  if (!data.counted.includes(memberId)) data.counted.push(memberId);
  saveData(data);
}

function setPending(memberId, inviterId) {
  const data = loadData();
  if (!data.pending) data.pending = {};
  data.pending[memberId] = inviterId;
  saveData(data);
}

function getPending(memberId) {
  return loadData().pending?.[memberId] ?? null;
}

function removePending(memberId) {
  const data = loadData();
  if (data.pending) delete data.pending[memberId];
  saveData(data);
}

function getNextOrderId() {
  const data = loadData();
  const orderId = `#${String(data.nextOrderId).padStart(4, '0')}`;
  data.nextOrderId += 1;
  saveData(data);
  return orderId;
}

function getNextTicketOrderId() {
  const data = loadData();
  const orderId = String(data.nextTicketOrderId).padStart(4, '0');
  data.nextTicketOrderId += 1;
  saveData(data);
  return orderId;
}

function hasReviewedOrder(orderId) {
  return loadData().reviewedOrders.includes(orderId);
}

function markReviewedOrder(orderId) {
  const data = loadData();
  if (!data.reviewedOrders.includes(orderId)) {
    data.reviewedOrders.push(orderId);
  }
  saveData(data);
}

function hasReviewDecision(id) {
  return loadData().reviewTicketDecisions.includes(id);
}

function markReviewDecision(id) {
  const data = loadData();
  if (!data.reviewTicketDecisions.includes(id)) {
    data.reviewTicketDecisions.push(id);
  }
  saveData(data);
}

function hasOrderFormSubmitted(channelId) {
  return !!loadData().orderFormsSubmitted[channelId];
}

function markOrderFormSubmitted(channelId) {
  const data = loadData();
  data.orderFormsSubmitted[channelId] = true;
  saveData(data);
}

module.exports = {
  loadData,
  saveData,
  getInvites,
  setInvites,
  addInvite,
  hasBeenCounted,
  markAsCounted,
  setPending,
  getPending,
  removePending,
  getNextOrderId,
  getNextTicketOrderId,
  hasReviewedOrder,
  markReviewedOrder,
  hasReviewDecision,
  markReviewDecision,
  hasOrderFormSubmitted,
  markOrderFormSubmitted,
};
