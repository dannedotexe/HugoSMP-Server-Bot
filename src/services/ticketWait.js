'use strict';

// Ticket-Wartezeit: merkt sich, seit wann ein Kunde auf eine Antwort vom
// Team wartet. Nach WAIT_REMIND_MINUTES ohne Antwort erinnert der Bot das
// Team einmal im Ticket-Log. Antwortzeiten fließen in die Statistik.

const { loadData, saveData } = require('../store');
const { recordEvent } = require('./stats');

const WAIT_REMIND_MINUTES = Number(process.env.TICKET_REMIND_MINUTES || 30);

function waits(data = loadData()) {
  if (!data.ticketWait || typeof data.ticketWait !== 'object') data.ticketWait = {};
  return data.ticketWait;
}

function getWait(channelId, data = loadData()) {
  return waits(data)[channelId] || null;
}

// Neue Nachricht in einem Ticket
function onTicketMessage(channelId, { fromStaff }) {
  const data = loadData();
  const all = waits(data);
  const entry = all[channelId] || {};

  if (fromStaff) {
    if (entry.waitingSince) {
      const minutes = Math.max(0, Math.round((Date.now() - entry.waitingSince) / 60000));
      recordEvent('responses');
      recordEvent('responseMinutes', minutes);
      entry.lastResponseMinutes = minutes;
    }
    entry.waitingSince = null;
    entry.remindedAt = null;
    entry.lastStaffAt = Date.now();
  } else if (!entry.waitingSince) {
    entry.waitingSince = Date.now();
    entry.remindedAt = null;
  }

  all[channelId] = entry;
  saveData(data);
}

function clearWait(channelId) {
  const data = loadData();
  if (waits(data)[channelId]) {
    delete waits(data)[channelId];
    saveData(data);
  }
}

// Tickets, die zu lange warten und noch nicht erinnert wurden
function dueReminders(now = Date.now()) {
  const data = loadData();
  return Object.entries(waits(data))
    .filter(([, w]) => w.waitingSince && !w.remindedAt && now - w.waitingSince >= WAIT_REMIND_MINUTES * 60000)
    .map(([channelId, w]) => ({ channelId, waitingSince: w.waitingSince }));
}

function markReminded(channelId) {
  const data = loadData();
  const entry = waits(data)[channelId];
  if (entry) {
    entry.remindedAt = Date.now();
    saveData(data);
  }
}

function formatWait(ms) {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  return `${hours} Std.${minutes % 60 ? ` ${minutes % 60} Min.` : ''}`;
}

module.exports = {
  WAIT_REMIND_MINUTES,
  onTicketMessage,
  clearWait,
  getWait,
  dueReminders,
  markReminded,
  formatWait
};
