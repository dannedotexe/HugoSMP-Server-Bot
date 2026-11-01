'use strict';

// Eigene HugoSMP-Emojis (assets/emojis/hs_*.png). Der Bot lädt sie beim Start
// als App-Emojis zu Discord hoch (einmalig) und kann sie dann überall nutzen.
// Solange sie fehlen, wird ein normales Emoji als Ersatz genommen.

const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'assets', 'emojis');
const ids = new Map(); // name (ohne hs_) → Emoji-ID

async function syncEmojis(client) {
  try {
    const existing = await client.application.emojis.fetch();
    for (const emoji of existing.values()) {
      if (emoji.name?.startsWith('hs_')) ids.set(emoji.name.slice(3), emoji.id);
    }

    const files = fs.readdirSync(DIR).filter(f => /^hs_[a-z0-9_]+\.png$/.test(f));
    let added = 0;
    for (const file of files) {
      const name = file.slice(3, -4);
      if (ids.has(name)) continue;
      const emoji = await client.application.emojis.create({
        attachment: path.join(DIR, file),
        name: `hs_${name}`
      });
      ids.set(name, emoji.id);
      added++;
    }
    console.log(`😀 Eigene Emojis bereit: ${ids.size}${added ? ` (${added} neu hochgeladen)` : ''}`);
  } catch (e) {
    console.error('emoji sync error:', e.message);
  }
}

// Für Text: <:hs_ticket:123…> oder Ersatz
function e(name, fallback = '') {
  const id = ids.get(name);
  return id ? `<:hs_${name}:${id}>` : fallback;
}

// Für Buttons: { id } oder Ersatz-Emoji
function buttonEmoji(name, fallback) {
  const id = ids.get(name);
  return id ? { id, name: `hs_${name}` } : fallback;
}

// Normale Emojis → eigene Emojis (nur wenn hochgeladen)
const UNICODE_MAP = {
  '✅': 'check', '✔️': 'check', '❌': 'cross', '⚠️': 'warn', '⚠': 'warn', '🚨': 'warn',
  'ℹ️': 'info', '⏳': 'clock', '⏰': 'clock', '🕒': 'clock', '💰': 'euro', '💸': 'euro', '💶': 'money', '💵': 'money',
  '🎫': 'ticket', '🎟️': 'ticket', '⭐': 'star', '🌟': 'star', '🎉': 'party', '🎊': 'party', '📌': 'pin',
  '🔒': 'lock', '🔐': 'lock', '🔓': 'unlock', '🎨': 'palette', '📦': 'box', '📐': 'blueprint', '🏗️': 'blueprint',
  '🛒': 'cart', '🛡️': 'shield', '🛡': 'shield', '📊': 'chart', '📈': 'chart', '💳': 'card', '📰': 'news',
  '🌐': 'globe', '🔥': 'fire', '🎁': 'gift', '📋': 'clipboard', '📝': 'clipboard', '💬': 'chat', '🔍': 'search',
  '🔎': 'search', '🔔': 'bell', '🔗': 'link', '🔨': 'hammer', '📜': 'rules', '📢': 'megaphone', '📣': 'megaphone',
  '👋': 'wave', '🏷️': 'tag', '📨': 'mail', '📩': 'mail', '✉️': 'mail', '🏆': 'trophy', '🥇': 'trophy',
  '🤝': 'handshake', '🤖': 'bot', '❓': 'question', '🧭': 'compass', '⚙️': 'settings', '🏠': 'home', '👀': 'eye',
  '👁️': 'eye', '👑': 'crown', '⚔️': 'sword', '🗡️': 'sword', '⛏️': 'pickaxe', '❤️': 'heart', '💜': 'heart',
  '➕': 'plus', '➖': 'minus', '🔄': 'refresh', '🔁': 'refresh', '📅': 'calendar', '📆': 'calendar',
  '🚪': 'door', '🔇': 'mute', '👥': 'users', '👤': 'user', '🎰': 'dice', '🎲': 'dice', '🎧': 'support',
  '✨': 'sparkle', '💡': 'info', '🔑': 'lock'
};
const UNICODE_RE = new RegExp(
  Object.keys(UNICODE_MAP).sort((a, b) => b.length - a.length)
    .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
  'gu'
);

function swap(text) {
  return text.replace(UNICODE_RE, match => {
    const id = ids.get(UNICODE_MAP[match]);
    return id ? `<:hs_${UNICODE_MAP[match]}:${id}>` : match;
  });
}

// Text in `Code` bleibt unverändert (z. B. Kanalnamen in /umbenennen)
function emojify(text) {
  if (typeof text !== 'string' || !ids.size || !text) return text;
  return text.split(/(```[\s\S]*?```|`[^`]*`)/).map((part, i) => (i % 2 ? part : swap(part))).join('');
}

// Unicode-Emoji → Button-Emoji ({ id } wenn vorhanden)
function emojifyButton(emoji) {
  if (typeof emoji !== 'string') return emoji;
  const name = UNICODE_MAP[emoji] || UNICODE_MAP[emoji.replace(/\ufe0f/g, '')];
  const id = name && ids.get(name);
  return id ? { id, name: `hs_${name}` } : emoji;
}

// Alle Buttons des Bots: setEmoji('✅') nimmt automatisch das eigene Emoji
let patched = false;
function installButtonEmojis() {
  if (patched) return;
  patched = true;
  const { ButtonBuilder } = require('discord.js');
  const original = ButtonBuilder.prototype.setEmoji;
  ButtonBuilder.prototype.setEmoji = function setEmoji(emoji) {
    return original.call(this, emojifyButton(emoji));
  };
}
installButtonEmojis();

module.exports = { syncEmojis, e, buttonEmoji, emojify, emojifyButton, UNICODE_MAP, _ids: ids };
