'use strict';

// Aus index.js ausgelagert.

const { BrandEmbed } = require('../theme');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const { loadData, saveData } = require('../store');
const { CLOSED_TICKET_CATEGORY_ID, REQUIRED_INVITES, REWARD, STOCK_ITEMS, TICKET_CATEGORY_ID } = require('../config');
const { client } = require('../client');
const { buildStockEmbed } = require('./stock');

function buildRolesPanel() {
  const embed = new BrandEmbed()
    .setTitle('Benachrichtigungen')
    .setDescription([
      'Wähle selbst, worüber du informiert werden möchtest.',
      '',
      '🎉 **Giveaways** – neue Verlosungen',
      '📦 **Restocks** – Items wieder auf Lager',
      '💰 **Deals** – Rabatte und Gratis-Aktionen',
      '📰 **News** – Ankündigungen',
      '',
      '-# Ein Klick fügt die Rolle hinzu, ein zweiter entfernt sie wieder.'
    ].join('\n'));

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('role_giveaways')
      .setLabel('Giveaways')
      .setEmoji('🎉')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('role_restocks')
      .setLabel('Restocks')
      .setEmoji('📦')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('role_deals')
      .setLabel('Deals')
      .setEmoji('💰')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('role_news')
      .setLabel('News')
      .setEmoji('📰')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embed, row };
}

// Kurs für 1M Geld aus dem Lager (Dashboard/Stock), damit er überall gleich ist
function currentMoneyRate() {
  const items = loadData().stockItems || STOCK_ITEMS;
  const money = items.find(item => item.id === 'money');
  return money ? `1M = ${money.price}` : 'siehe Lager';
}

function buildVerifyPanel(guild) {
  const embed = new BrandEmbed()
    .setTitle('Verifizierung')
    .setDescription(
      'Willkommen bei **HugoSMP Market**.\n' +
      'Bestätige kurz, dass du ein Mensch bist, um alle Kanäle freizuschalten.'
    )
    .addFields({ name: 'Kurs', value: currentMoneyRate(), inline: true })
    .setThumbnail(guild.iconURL({ size: 256 }) || null);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('verify_member')
      .setLabel('Verifizieren')
      .setStyle(ButtonStyle.Primary)
  );

  return { embed, row };
}

function buildTicketPanel() {
  const embed = new BrandEmbed()
    .setTitle('Support & Bestellungen')
    .setDescription([
      'Wähle unten eine Kategorie – wir öffnen dir einen privaten Kanal mit dem Team.',
      '',
      '💰 **Items & Geld** – Ingame-Items und Geld kaufen',
      '📐 **Schematics** – Baupläne bestellen',
      '🎨 **Resource Pack** – Texture- und Resource-Packs',
      '🎫 **Support** – Fragen und Probleme',
      '',
      '-# Bitte pro Anliegen nur ein Ticket öffnen.'
    ].join('\n'));

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_cat_items_geld')
      .setLabel('Items & Geld')
      .setEmoji('💰')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('ticket_cat_schematics')
      .setLabel('Schematics')
      .setEmoji('📐')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('ticket_cat_resource_pack')
      .setLabel('Resource Pack')
      .setEmoji('🎨')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('create_support_ticket')
      .setLabel('Support')
      .setEmoji('🎫')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embed, row };
}

function buildWebsitePanel() {
  const embed = new BrandEmbed()
    .setTitle('HugoSMP Market')
    .setDescription('Geld, Items, Kits und mehr – direkt über unsere Website bestellen.')
    .addFields(
      { name: 'Anmeldung', value: 'Mit Discord', inline: true },
      { name: 'Bestellung', value: 'Mit Bestellnummer', inline: true },
      { name: 'Support', value: '<#1499132947041751181>', inline: true }
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Website öffnen')
      .setStyle(ButtonStyle.Link)
      .setURL('https://hugosmpmarket.store')
  );

  return { embed, row };
}

// Nach einem Update sucht der Bot seine bereits geposteten Panels und
// ersetzt sie in-place durch die aktuelle Version – kein neues Posten
// nötig. Läuft nur, wenn sich das Panel-Design geändert hat.
const PANEL_DETECTORS = [
  { name: 'Tickets', match: ids => ids.includes('create_support_ticket'), build: () => toPanelPayload(buildTicketPanel()) },
  { name: 'Verifizierung', match: ids => ids.includes('verify_member'), build: guild => toPanelPayload(buildVerifyPanel(guild)) },
  { name: 'Benachrichtigungen', match: ids => ids.includes('role_giveaways'), build: () => toPanelPayload(buildRolesPanel()) },
  { name: 'Invite Rewards', match: ids => ids.includes('gen_invite'), build: () => buildPanel() },
  {
    name: 'Website',
    match: (ids, urls) => ids.length === 0 && urls.some(url => url.includes('hugosmpmarket.store')),
    build: () => toPanelPayload(buildWebsitePanel())
  }
];

// Erhöhen, wenn sich die Erkennung ändert, damit alle Kanäle neu
// durchsucht werden, auch ohne Design-Änderung.
const PANEL_REFRESH_REVISION = 2;

function isStockMessage(message) {
  const title = message.embeds?.[0]?.title || '';
  return /lagerbestand/i.test(title);
}

function toPanelPayload({ embed, row }) {
  return { embeds: [embed], components: [row] };
}

function messageButtons(message) {
  const ids = [];
  const urls = [];
  for (const row of message.components || []) {
    for (const component of row.components || []) {
      if (component.customId) ids.push(component.customId);
      if (component.url) urls.push(component.url);
    }
  }
  return { ids, urls };
}

function panelDesignSignature() {
  const placeholderGuild = { iconURL: () => null };
  const payloads = PANEL_DETECTORS.map(d => {
    const payload = d.build(placeholderGuild);
    return {
      embeds: payload.embeds.map(e => ({ ...e.toJSON(), footer: undefined })),
      components: payload.components.map(c => c.toJSON())
    };
  });
  return require('crypto').createHash('sha1').update(JSON.stringify({ PANEL_REFRESH_REVISION, payloads })).digest('hex');
}

async function refreshPostedPanels({ force = false } = {}) {
  const data = loadData();
  const signature = panelDesignSignature();
  if (!force && data.panelDesignSignature === signature) return [];

  const updated = [];

  for (const guild of client.guilds.cache.values()) {
    const channels = guild.channels.cache.filter(channel =>
      channel.type === ChannelType.GuildText &&
      channel.parentId !== TICKET_CATEGORY_ID &&
      channel.parentId !== CLOSED_TICKET_CATEGORY_ID &&
      channel.permissionsFor(guild.members.me)?.has(['ViewChannel', 'ReadMessageHistory'])
    );

    for (const channel of channels.values()) {
      const messages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
      if (!messages) continue;

      for (const message of messages.values()) {
        if (message.author?.id !== client.user.id) continue;

        // Lager-Anzeigen (öffentlich oder Admin-Panel): nur das Embed
        // erneuern, Buttons bleiben. Eine unbekannte öffentliche Anzeige
        // wird übernommen, damit künftige Bestandsänderungen sie updaten.
        if (isStockMessage(message)) {
          try {
            await message.edit({ embeds: [buildStockEmbed()] });
            const tracked = loadData();
            const isAdminPanel = message.components?.length > 0;
            const trackedAlive = tracked.publicStockMessageId && tracked.publicStockChannelId
              ? await client.channels.cache.get(tracked.publicStockChannelId)?.messages
                .fetch(tracked.publicStockMessageId).then(() => true).catch(() => false)
              : false;
            if (!isAdminPanel && !trackedAlive) {
              tracked.publicStockMessageId = message.id;
              tracked.publicStockChannelId = channel.id;
              saveData(tracked);
            }
            updated.push(`Lagerbestand in #${channel.name}`);
          } catch (e) {
            console.error(`stock refresh error (#${channel.name}):`, e.message);
          }
          continue;
        }

        if (!message.components?.length) continue;

        const { ids, urls } = messageButtons(message);
        const detector = PANEL_DETECTORS.find(d => d.match(ids, urls));
        if (!detector) continue;

        try {
          await message.edit(detector.build(guild));
          updated.push(`${detector.name} in #${channel.name}`);
        } catch (e) {
          console.error(`panel refresh error (#${channel.name}):`, e.message);
        }
      }
    }
  }

  const fresh = loadData();
  fresh.panelDesignSignature = signature;
  saveData(fresh);

  if (updated.length) console.log(`🎨 Panels erneuert: ${updated.join(', ')}`);
  return updated;
}

function buildPanel() {
  const embed = new BrandEmbed()
    .setTitle('Einladungs-Belohnungen')
    .setDescription('Lade Freunde ein und sichere dir eine Belohnung, sobald sie sich verifiziert haben.')
    .addFields(
      { name: 'Ziel', value: `${REQUIRED_INVITES} verifizierte Einladungen`, inline: true },
      { name: 'Belohnung', value: REWARD, inline: true },
      {
        name: 'Wichtig',
        value: 'Es zählen nur Links, die du über **Link erstellen** bekommst – normale Discord-Einladungen werden nicht gewertet.'
      }
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('gen_invite')
      .setLabel('Link erstellen')
      .setEmoji('🔗')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('check_inv')
      .setLabel('Fortschritt')
      .setEmoji('📊')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('claim')
      .setLabel('Belohnung abholen')
      .setStyle(ButtonStyle.Primary),
  );

  return {
    embeds: [embed],
    components: [row]
  };
}

module.exports = {
  buildRolesPanel,
  currentMoneyRate,
  buildVerifyPanel,
  buildTicketPanel,
  buildWebsitePanel,
  buildPanel,
  PANEL_DETECTORS,
  PANEL_REFRESH_REVISION,
  isStockMessage,
  toPanelPayload,
  messageButtons,
  panelDesignSignature,
  refreshPostedPanels,
};
