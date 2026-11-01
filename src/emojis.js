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

module.exports = { syncEmojis, e, buttonEmoji, _ids: ids };
