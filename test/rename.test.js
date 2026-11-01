'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { textChannelName } = require('../src/commands/rename');

const name = (n) => textChannelName({ name: n });

test('Umbenennen: Zierschrift wird erkannt, jede Art bekommt ihr Emoji', () => {
  assert.equal(name('📜-ʀᴜʟᴇꜱ'), '📜┃regeln');
  assert.equal(name('💬┃ᴘʀᴇɪꜱᴇ-ᴜɴᴅ-ꜱᴛᴏᴄᴋ'), '📈┃preise-und-stock');
  assert.equal(name('💬┃ꜱᴄʜᴇᴍᴀᴛɪᴄꜱ'), '🏗️┃schematics');
  assert.equal(name('💬┃ʀᴇꜱᴛᴏᴄᴋ'), '📦┃restock');
  assert.equal(name('💬┃ᴏᴜʀ-ᴀᴅ'), '📺┃werbung');
  assert.equal(name('💬┃ᴘɪɴɢ-ᴄʟᴀɪᴍ'), '📌┃ping-claim');
  assert.equal(name('💬┃ɪɴᴠɪᴛᴇ-ʀᴇᴡᴀʀᴅꜱ'), '📨┃einladungs-belohnungen');
  assert.equal(name('💬┃ʀᴇᴠɪᴇᴡꜱ'), '⭐┃bewertungen');
  assert.equal(name('💬┃ʙᴇꜱᴛᴇʟʟᴜɴɢᴇɴ'), '🛒┃bestellungen');
  assert.equal(name('💬┃ʀᴇᴡᴀʀᴅ-ʟᴏɢ'), '💰┃belohnungs-logs');
  assert.equal(name('💬┃ᴡᴇʙꜱɪᴛᴇ'), '🌐┃website');
  assert.equal(name('💬┃ᴀɴᴋüɴᴅɪɢᴜɴɢᴇɴ'), '📢┃ankündigungen');
  assert.equal(name('💬┃ɢɪᴠᴇᴀᴡᴀʏ'), '🎉┃giveaways');
  assert.equal(name('💬┃ᴛɪᴄᴋᴇᴛꜱ'), '🎫┃tickets');
  assert.equal(name('💬┃ɢᴇɴᴇʀᴀʟ'), '💬┃allgemein');
  assert.equal(name('💬┃ᴜɴᴠᴇʀɪꜰɪᴇᴅ-ᴄʜᴀᴛ'), '🔒┃unverifiziert-chat');
  assert.equal(name('💬┃ʀᴇᴘᴏʀᴛꜱ'), '🚨┃meldungen');
  assert.equal(name('💬┃modchat'), '🛡️┃modchat');
  assert.equal(name('💬┃alerts'), '🚨┃alarme');
  assert.equal(name('💬┃neue-mitglieder'), '👋┃neue-mitglieder');
  assert.equal(name('𝗣𝗥𝗘𝗜𝗦𝗘'), '📈┃preise');
  assert.equal(name('🦄┃irgendwas'), '🦄┃irgendwas', 'unbekannt: bisheriges Emoji bleibt');
});
