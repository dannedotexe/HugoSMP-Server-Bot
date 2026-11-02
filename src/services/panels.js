'use strict';

// Aus index.js ausgelagert.

const { BrandEmbed } = require('../theme');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, MessageFlags } = require('discord.js');
const { card, collectButtons } = require('../cards');
const { loadData, saveData } = require('../store');
const { CLOSED_TICKET_CATEGORY_ID, REQUIRED_INVITES, REWARD, STOCK_ITEMS, TICKET_CATEGORY_ID } = require('../config');
const { client } = require('../client');
const { buildStockEmbed } = require('./stock');
const { buildRulesVerifyPanel, buildOrderInfoPanel, OLD_ORDER_INFO_TITLES } = require('./infoPanels');
const { e, buttonEmoji } = require('../emojis');

// Gleich breite Buttons, damit sie auf dem Handy rechts neben dem Text bleiben
function roleButton(id) {
  return new ButtonBuilder().setCustomId(id).setLabel('An/Aus').setEmoji(buttonEmoji('bell', '🔔')).setStyle(ButtonStyle.Secondary);
}

function buildRolesPanel() {
  return card({
    tone: 'primary',
    eyebrow: `${e('bell', '🔔')} Benachrichtigungen`,
    title: 'Worüber willst du informiert werden?',
    body: '-# Ein Klick gibt dir die Rolle, ein zweiter nimmt sie wieder weg.',
    items: [
      { text: `${e('gift', '🎉')} **Giveaways**\n-# Neue Verlosungen`, button: roleButton('role_giveaways') },
      { text: `${e('box', '📦')} **Restocks**\n-# Items wieder auf Lager`, button: roleButton('role_restocks') },
      { text: `${e('sparkle', '💰')} **Deals**\n-# Rabatte und Gratis-Aktionen`, button: roleButton('role_deals') },
      { text: `${e('news', '📰')} **News**\n-# Ankündigungen`, button: roleButton('role_news') }
    ],
    timestamp: false
  });
}

// Kurs für 1M Geld aus dem Lager (Dashboard/Stock), damit er überall gleich ist
function currentMoneyRate() {
  const items = loadData().stockItems || STOCK_ITEMS;
  const money = items.find(item => item.id === 'money');
  return money ? `1M = ${money.price}` : 'siehe Lager';
}

// Regeln + Verifizieren in EINEM Embed (src/services/infoPanels.js)
function buildVerifyPanel(guild) {
  return buildRulesVerifyPanel(guild);
}

// Hauptsache Bestellen: großer grüner Button; Support klein daneben
function buildTicketPanel() {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_cat_items_geld')
      .setLabel('Jetzt bestellen')
      .setEmoji(buttonEmoji('cart', '🛒'))
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('create_support_ticket')
      .setLabel('Nur Fragen? Support')
      .setEmoji(buttonEmoji('support', '🎧'))
      .setStyle(ButtonStyle.Secondary)
  );

  return card({
    tone: 'success',
    eyebrow: `${e('cart', '🛒')} Bestellen`,
    title: 'Hier kaufst du Items & Geld!',
    body: 'Klick auf **Jetzt bestellen**, füll das kurze Formular aus – fertig.\nWir öffnen dir einen privaten Bestell-Kanal mit dem Team.',
    thumbnail: client.guilds.cache.first()?.iconURL({ size: 256 }) || null,
    blocks: [
      [
        `${e('clipboard', '1️⃣')} **Formular ausfüllen** – Item, Menge, Ingame-Name, Zahlung`,
        `${e('card', '2️⃣')} **Bezahlen** – die Infos bekommst du im Bestell-Kanal`,
        `${e('box', '3️⃣')} **Erhalten** – die Items kommen per /orders`
      ].join('\n')
    ],
    rows: [row],
    footer: 'Fragen ohne Kauf? Dann „Support“',
    timestamp: false
  });
}

function buildWebsitePanel() {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Website öffnen')
      .setEmoji(buttonEmoji('globe', '🌐'))
      .setStyle(ButtonStyle.Link)
      .setURL('https://hugosmpmarket.store')
  );

  return card({
    tone: 'primary',
    eyebrow: `${e('globe', '🌐')} Website`,
    title: 'HugoSMP Market',
    body: 'Geld, Items, Kits und mehr – direkt über unsere Website bestellen.',
    thumbnail: client.guilds.cache.first()?.iconURL({ size: 256 }) || null,
    blocks: [`${e('user', '•')} **Anmeldung:** mit Discord\n${e('box', '•')} **Bestellung:** mit Bestellnummer\n${e('support', '•')} **Support:** <#1499132947041751181>`],
    rows: [row],
    timestamp: false
  });
}

// Nach einem Update sucht der Bot seine bereits geposteten Panels und
// ersetzt sie in-place durch die aktuelle Version – kein neues Posten
// nötig. Läuft nur, wenn sich das Panel-Design geändert hat.
const PANEL_DETECTORS = [
  {
    name: 'Bestell-Info',
    match: (ids, urls, message) => OLD_ORDER_INFO_TITLES.includes(message?.embeds?.[0]?.title || ''),
    build: guild => toPanelPayload(buildOrderInfoPanel(guild))
  },
  { name: 'Tickets', match: ids => ids.includes('create_support_ticket'), build: () => buildTicketPanel() },
  { name: 'Verifizierung', match: ids => ids.includes('verify_member'), build: guild => toPanelPayload(buildVerifyPanel(guild)) },
  { name: 'Benachrichtigungen', match: ids => ids.includes('role_giveaways'), build: () => buildRolesPanel() },
  { name: 'Invite Rewards', match: ids => ids.includes('gen_invite'), build: () => buildPanel() },
  {
    name: 'Website',
    match: (ids, urls) => ids.length === 0 && urls.some(url => url.includes('hugosmpmarket.store')),
    build: () => buildWebsitePanel()
  }
];

// Erhöhen, wenn sich die Erkennung ändert, damit alle Kanäle neu
// durchsucht werden, auch ohne Design-Änderung.
const PANEL_REFRESH_REVISION = 11;

function isStockMessage(message) {
  const title = message.embeds?.[0]?.title || '';
  return /lagerbestand/i.test(title);
}

function toPanelPayload({ embed, row }) {
  return { embeds: [embed], components: [row] };
}

function messageButtons(message) {
  return collectButtons(message);
}

function panelDesignSignature() {
  const placeholderGuild = { iconURL: () => null };
  const payloads = PANEL_DETECTORS.map(d => {
    const payload = d.build(placeholderGuild);
    return {
      embeds: (payload.embeds || []).map(e => ({ ...e.toJSON(), footer: undefined })),
      components: payload.components.map(c => c.toJSON())
    };
  });
  return require('crypto').createHash('sha1').update(JSON.stringify({ PANEL_REFRESH_REVISION, payloads })).digest('hex');
}

// Altes Embed-Panel → Karte: erst bearbeiten versuchen; lässt Discord das
// nicht zu, neu senden und das alte löschen.
async function replacePanelMessage(message, payload) {
  const isCard = Boolean(Number(payload.flags || 0) & MessageFlags.IsComponentsV2);
  if (!isCard) return message.edit(payload);
  try {
    await message.edit(message.content ? { ...payload, content: '', embeds: [] } : { ...payload, embeds: [] });
  } catch (e) {
    console.log(`Panel wird neu gesendet (${e.message})`);
    await message.channel.send(payload);
    await message.delete().catch(() => {});
  }
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
        const detector = PANEL_DETECTORS.find(d => d.match(ids, urls, message));
        if (!detector) continue;

        try {
          await replacePanelMessage(message, detector.build(guild));
          updated.push(`${detector.name} in #${channel.name}`);
          // Regeln stehen jetzt im Verifizierungs-Embed → altes Regel-Embed entfernen
          if (detector.name === 'Verifizierung') {
            for (const old of messages.values()) {
              const title = old.embeds?.[0]?.title || '';
              if (old.author?.id === client.user.id && !old.components?.length && /server-regeln/i.test(title)) {
                await old.delete().catch(() => {});
                updated.push(`altes Regel-Embed in #${channel.name} entfernt`);
              }
            }
          }
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
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('gen_invite').setLabel('Link erstellen').setEmoji(buttonEmoji('link', '🔗')).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('check_inv').setLabel('Fortschritt').setEmoji(buttonEmoji('chart', '📊')).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('claim').setLabel('Belohnung abholen').setEmoji(buttonEmoji('gift', '🎁')).setStyle(ButtonStyle.Success)
  );

  return card({
    tone: 'success',
    eyebrow: `${e('gift', '🎁')} Einladungs-Belohnungen`,
    title: 'Freunde einladen & belohnt werden',
    body: 'Lade Freunde ein und sichere dir eine Belohnung, sobald sie sich verifiziert haben.',
    blocks: [
      `${e('user', '•')} **Ziel:** ${REQUIRED_INVITES} verifizierte Einladungen\n${e('gift', '•')} **Belohnung:** ${REWARD}`,
      `${e('warn', '⚠️')} Es zählen nur Links über **Link erstellen** – normale Discord-Einladungen zählen nicht.`
    ],
    rows: [row],
    timestamp: false
  });
}

module.exports = {
  buildRolesPanel,
  currentMoneyRate,
  buildVerifyPanel,
  buildOrderInfoPanel,
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
