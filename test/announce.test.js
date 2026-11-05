'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DATA_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'hsb-ann-')), 'data.json');
const { Collection, ChannelType, PermissionFlagsBits } = require('discord.js');
const { PING_ROLES, PUNISH_LOG_CHANNEL_ID } = require('../src/config');

function guildWith(sent) {
  const ch = (id, name, type = ChannelType.GuildText) => [id, { id, name, type, send: async p => { sent.push([id, p]); return { id: 'msg1' }; } }];
  return {
    id: 'g1',
    channels: { cache: new Collection([ch('a1', '📢┃ankündigungen'), ch('b1', '🛒┃bestellen'), ch(PUNISH_LOG_CHANNEL_ID, 'mod-log')]) }
  };
}
const admin = { displayName: 'Chris', permissions: { has: p => p === PermissionFlagsBits.ManageGuild } };
const nobody = { permissions: { has: () => false } };

test('Ankündigung: nur Admins, Link muss https sein, Kanäle werden verlinkt, Ping nur News-Rolle', async () => {
  const announce = require('../src/features/announce')();
  let reply = null;
  await announce.command({ commandName: 'ankündigung', member: nobody, reply: async r => { reply = r; } });
  assert.match(reply.content, /Nur Inhaber/);

  let modal = null;
  await announce.command({ commandName: 'ankündigung', member: admin, options: { getBoolean: () => null }, showModal: async m => { modal = m.toJSON(); } });
  assert.equal(modal.custom_id, 'announce_submit_1', 'Standard: mit Ping');

  const fields = values => ({ getTextInputValue: k => values[k] ?? '' });
  await announce.modal({ customId: 'announce_submit_1', member: nobody, reply: async r => { reply = r; } });
  assert.match(reply.content, /Nur Inhaber/, 'Rechte auch beim Absenden geprüft');

  await announce.modal({ customId: 'announce_submit_1', member: admin, fields: fields({ title: 'T', text: 'x', link: 'http://unsicher' }), reply: async r => { reply = r; } });
  assert.match(reply.content, /https:\/\//);

  const sent = [];
  let edited = null;
  await announce.modal({
    customId: 'announce_submit_1', member: admin, user: { id: '5', username: 'chris' }, guild: guildWith(sent),
    fields: fields({ title: 'Shop offen', text: 'Bestellt jetzt in #bestellen!', link: 'https://hugosmpmarket.store' }),
    deferReply: async () => {}, editReply: async r => { edited = r; }
  });
  assert.match(edited.content, /veröffentlicht: https:\/\/discord\.com\/channels\/g1\/a1\/msg1/);
  const [chanId, post] = sent[0];
  assert.equal(chanId, 'a1');
  const json = JSON.stringify(post.components.map(c => c.toJSON()));
  assert.match(json, /<#b1>/, '#bestellen verlinkt');
  assert.match(json, /Mehr erfahren/);
  assert.match(json, new RegExp(`Für <@&${PING_ROLES.news}>`));
  assert.deepEqual(post.allowedMentions, { roles: [PING_ROLES.news] });
  assert.equal(sent[1][0], PUNISH_LOG_CHANNEL_ID, 'Eintrag im Mod-Log');

  sent.length = 0;
  await announce.modal({
    customId: 'announce_submit_0', member: admin, user: { id: '5', username: 'chris' }, guild: guildWith(sent),
    fields: fields({ title: 'Leise', text: 'ohne Ping' }), deferReply: async () => {}, editReply: async () => {}
  });
  assert.deepEqual(sent[0][1].allowedMentions, { roles: [] }, 'ohne Ping niemand');
});
