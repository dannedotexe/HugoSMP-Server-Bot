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

test('Regeln+Verifizierung und Bestell-Info: gültige Embeds mit echten Kanal-Links', () => {
  const { Collection, ChannelType } = require('discord.js');
  const { buildRulesVerifyPanel, buildOrderInfoPanel } = require('../src/services/infoPanels');
  const channels = new Collection([
    ['11', { id: '11', type: ChannelType.GuildText, name: '🎫┃tickets' }],
    ['12', { id: '12', type: ChannelType.GuildText, name: '🛒 | bestell-inꜰo' }],
    ['13', { id: '13', type: ChannelType.GuildText, name: '📈┃preise-und-stock' }]
  ]);
  const guild = { id: '1', channels: { cache: channels }, iconURL: () => null };
  const rules = buildRulesVerifyPanel(guild, '1M = 0,50 €');
  const r = rules.embed.toJSON();
  assert.ok(r.description.length < 4096);
  assert.match(r.description, /<#11>/);
  assert.match(r.description, /<#12>/);
  assert.match(r.description, /\*\*#bewertungen\*\*/, 'fehlender Kanal als Text');
  assert.equal(rules.row.toJSON().components[0].custom_id, 'verify_member');
  const info = buildOrderInfoPanel(guild);
  assert.match(JSON.stringify(info.embed.toJSON()), /<#13>/);
  assert.equal(info.row.toJSON().components.length, 2);
  assert.equal(buildOrderInfoPanel({ iconURL: () => null }).row.toJSON().components.length, 1);
});

test('Feste Panels als Karten: Buttons werden erkannt, Signatur stabil', () => {
  const panels = require('../src/services/panels');
  const { collectButtons } = require('../src/cards');
  const { createComponent } = require(path.join(path.dirname(require.resolve('discord.js')), 'util', 'Components.js'));
  const asMessage = p => ({ components: json(p).map(c => createComponent(c)) });
  for (const [build, id] of [[panels.buildTicketPanel, 'create_support_ticket'], [panels.buildRolesPanel, 'role_giveaways'], [panels.buildPanel, 'gen_invite']]) {
    const ids = collectButtons(asMessage(build())).ids;
    assert.ok(ids.includes(id), id);
  }
  assert.ok(collectButtons(asMessage(panels.buildWebsitePanel())).urls.some(u => u.includes('hugosmpmarket')));
  assert.equal(panels.panelDesignSignature(), panels.panelDesignSignature(), 'kein Zeitstempel → kein Dauer-Neuladen');
});
