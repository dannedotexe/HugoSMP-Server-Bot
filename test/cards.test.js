'use strict';

// Prüft, dass alle neuen Discord-Karten gültig gebaut werden (Discord-Regeln
// werden von discord.js beim Umwandeln geprüft).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DATA_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'hsb-cards-')), 'data.json');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { card, cardText, emojiImageUrl } = require('../src/cards');
const { buildShopPanelCard, buildSaleCard } = require('../src/services/stock');
const { buildReviewCard, buildReviewSummaryCard } = require('../src/services/reviews');

const row = () => new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('x').setLabel('X').setStyle(ButtonStyle.Primary)
);
const json = payload => payload.components.map(c => c.toJSON());

test('Karten: gültig, mit Flag, Ping nur wie erlaubt', () => {
  const p = card({ eyebrow: 'A', title: 'B', body: 'C', thumbnail: 'https://example.com/a.png', blocks: ['D', null], rows: [row()], mention: '<@&1>', allowedMentions: { roles: ['1'] } });
  assert.equal(p.flags, MessageFlags.IsComponentsV2);
  const out = json(p);
  assert.equal(out.length, 2);
  assert.equal(out[1].type, 17, 'Container');
  assert.deepEqual(card({ title: 'ohne' }).allowedMentions, { parse: [] });
  assert.match(cardText({ components: out }), /### B/);
  assert.equal(emojiImageUrl({ emoji: '<:Money:1502281700774772908>' }), 'https://cdn.discordapp.com/emojis/1502281700774772908.png?size=128');
  assert.equal(emojiImageUrl({ emoji: '💰' }), null);
});

test('Karten: Shop, Angebot, Bewertung, Übersicht', () => {
  json(buildShopPanelCard({ title: 'Shop', includeSale: true }, row()));
  json(buildSaleCard({ title: 'Sale', itemName: 'Elytra', discount: '-20%', itemId: 'elytra' }, row(), '<@&5>'));
  json(buildReviewCard({ user: { id: '1', username: 'a', displayAvatarURL: () => 'https://example.com/a.png' }, stars: 5, text: 'top', item: 'Elytra', orderId: '#1' }));
  json(buildReviewSummaryCard());
  assert.throws(() => buildShopPanelCard({ itemIds: [] }, row()), /mindestens ein Item/);
});
