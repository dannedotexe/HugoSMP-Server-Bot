'use strict';

// Aus index.js ausgelagert.

const { cleanLongText, cleanShortText, joinEmbedLines, stockStatusText } = require('../util');
const { PING_ROLES, RESTOCK_CHANNEL_ID, STOCK_CHANNEL_ID, STOCK_ITEMS } = require('../config');
const { loadData, saveData } = require('../store');
const { BrandEmbed } = require('../theme');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { makeDashboardError } = require('./dms');
const { client } = require('../client');
const { card, emojiImageUrl } = require('../cards');

function normalizeStockEmoji(value) {
  let emoji = cleanShortText(value, 80);
  let emojiId = null;

  const customMatch = emoji.match(/<a?:([^:]+):(\d{15,20})>/);
  const rawIdMatch = emoji.match(/^(\d{15,20})$/);
  const colonMatch = emoji.match(/:?([^:\s<>]+):(\d{15,20})/);

  if (customMatch) {
    emojiId = customMatch[2];
    emoji = customMatch[0];
  } else if (rawIdMatch) {
    emojiId = rawIdMatch[1];
    emoji = `<:item:${emojiId}>`;
  } else if (colonMatch) {
    emojiId = colonMatch[2];
    emoji = `<:${colonMatch[1]}:${emojiId}>`;
  }

  return { emoji, emojiId };
}

function getMutableStockItems(data) {
  if (!Array.isArray(data.stockItems)) data.stockItems = JSON.parse(JSON.stringify(STOCK_ITEMS));
  if (!data.stock) data.stock = {};
  return data.stockItems;
}

function getLatestShopOffer(data = loadData()) {
  return Array.isArray(data.shopOffers) && data.shopOffers.length ? data.shopOffers[0] : null;
}

function buildShopPanelEmbed({ title, description, itemIds, includeSale }, data = loadData()) {
  if (Array.isArray(itemIds) && itemIds.length === 0) {
    throw makeDashboardError('Wähle mindestens ein Item aus.', 400);
  }

  const wanted = Array.isArray(itemIds) && itemIds.length
    ? new Set(itemIds.map(String))
    : null;

  const items = (data.stockItems || STOCK_ITEMS)
    .filter(item => !wanted || wanted.has(item.id))
    .slice(0, 20);

  const lines = items.map(item => {
    const amount = Number(data.stock?.[item.id] || 0);
    return `${item.emoji || ''} **${item.name}** · ${item.price}\n${stockStatusText(amount)}`;
  });

  const offer = includeSale ? getLatestShopOffer(data) : null;

  const embed = new BrandEmbed()
    .setTitle(cleanShortText(title || 'Shop', 120))
    .setDescription(
      `${cleanLongText(description || 'Wähle unten eine Kategorie und erstelle deine Bestellung.', 500)}\n\n` +
      `${offer ? `> **Angebot** · ${offer.title} – ${offer.discount}\n\n` : ''}` +
      joinEmbedLines(lines)
    )
    .setFooter({ text: 'Bestellung über die Buttons starten' })
    .setTimestamp();

  return embed;
}

function buildSaleEmbed({ title, itemName, discount, description, until }) {
  const embed = new BrandEmbed()
    .setTitle(cleanShortText(title || 'Neues Angebot', 120))
    .setDescription(cleanLongText(description || 'Sichere dir das Angebot im Shop-Ticket.', 900))
    .addFields(
      ...[
        itemName && { name: 'Item', value: String(itemName), inline: true },
        discount && { name: 'Angebot', value: String(discount), inline: true },
        until && { name: 'Gültig bis', value: String(until), inline: true }
      ].filter(Boolean)
    )
    .setFooter({ text: 'Market' })
    .setTimestamp();

  return embed;
}

// Shop-Panel als moderne Karte (Dashboard → „Shop-Panel posten“)
function buildShopPanelCard({ title, description, itemIds, includeSale }, orderRow, data = loadData()) {
  if (Array.isArray(itemIds) && itemIds.length === 0) {
    throw makeDashboardError('Wähle mindestens ein Item aus.', 400);
  }
  const wanted = Array.isArray(itemIds) && itemIds.length ? new Set(itemIds.map(String)) : null;
  const items = (data.stockItems || STOCK_ITEMS)
    .filter(item => !wanted || wanted.has(item.id))
    .slice(0, 20);

  const lines = items.map(item => {
    const amount = Number(data.stock?.[item.id] || 0);
    const status = amount === 0 ? '🔴 ausverkauft' : amount <= 5 ? `🟡 nur noch ${amount}` : `🟢 ${amount} da`;
    return `${item.emoji || '•'} **${item.name}** — ${item.price}  ·  ${status}`;
  });

  const offer = includeSale ? getLatestShopOffer(data) : null;

  return card({
    tone: 'primary',
    eyebrow: '🛒 Shop',
    title: cleanShortText(title || 'Shop', 120),
    body: cleanLongText(description || 'Wähle unten eine Kategorie und erstelle deine Bestellung.', 500),
    thumbnail: client.guilds.cache.first()?.iconURL({ size: 256 }) || null,
    blocks: [
      offer ? `🔥 **Angebot:** ${offer.title} – ${offer.discount}` : null,
      joinEmbedLines(lines) || 'Gerade keine Artikel.'
    ],
    footer: 'Bestellung über die Buttons starten',
    rows: orderRow ? [orderRow] : []
  });
}

function buildSaleCard({ title, itemName, discount, description, until, itemId }, orderRow, mention, data = loadData()) {
  const item = (data.stockItems || STOCK_ITEMS).find(i => i.id === itemId);
  const facts = [
    itemName && `**Item:** ${itemName}`,
    discount && `**Angebot:** ${discount}`,
    until && `**Gültig bis:** ${until}`
  ].filter(Boolean).join('\n');

  return card({
    tone: 'warning',
    eyebrow: '🔥 Angebot',
    title: cleanShortText(title || 'Neues Angebot', 120),
    body: cleanLongText(description || 'Sichere dir das Angebot im Shop-Ticket.', 900),
    thumbnail: emojiImageUrl(item),
    blocks: [facts || null],
    footer: 'Nur solange der Vorrat reicht',
    rows: orderRow ? [orderRow] : [],
    mention: mention || null,
    allowedMentions: { roles: mention ? [mention.replace(/\D/g, '')] : [] }
  });
}

function buildStockEmbed() {
  const data = loadData();

  const items = data.stockItems || STOCK_ITEMS;
  const lines = items.map(item => {
    const amount = data.stock[item.id] ?? 0;

    return `${item.emoji} **${item.name}** · ${item.price}\n${stockStatusText(amount)}`;
  }).join('\n\n');

  return new BrandEmbed()
    .setTitle('Lagerbestand')
    .setDescription(lines)
    .setFooter({ text: 'Live-Bestand · zuletzt aktualisiert' })
    .setTimestamp();
}

function buildStockButtons() {
  const rows = [];

  const stockItemsList = loadData().stockItems || STOCK_ITEMS;
  for (let i = 0; i < stockItemsList.length; i++) {
    const item = stockItemsList[i];

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`stock_minus10_${item.id}`)
        .setLabel('-10')
        .setStyle(ButtonStyle.Danger),

      new ButtonBuilder()
        .setCustomId(`stock_minus1_${item.id}`)
        .setLabel('-1')
        .setStyle(ButtonStyle.Secondary),

      (() => {
        const btn = new ButtonBuilder()
          .setCustomId(`stock_set_${item.id}`)
          .setLabel(item.name)
          .setStyle(ButtonStyle.Primary);
        if (item.emojiId) btn.setEmoji({ id: item.emojiId });
        else if (item.emoji && !item.emoji.startsWith('<')) btn.setEmoji(item.emoji);
        return btn;
      })(),

      new ButtonBuilder()
        .setCustomId(`stock_plus1_${item.id}`)
        .setLabel('+1')
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId(`stock_plus10_${item.id}`)
        .setLabel('+10')
        .setStyle(ButtonStyle.Success)
    );

    rows.push(row);
  }

  return rows;
}

async function updateStockPanel() {
  try {
    const data = loadData();
    const embed = buildStockEmbed();
    const rows = buildStockButtons();

    if (data.stockMessageId && data.stockChannelId) {
      try {
        const channel = client.channels.cache.get(data.stockChannelId);

        if (channel) {
          const msg = await channel.messages.fetch(data.stockMessageId);

          await msg.edit({
            embeds: [embed],
            components: rows.slice(0, 5)
          });

          if (rows.length > 5) {
            // Need a second message for buttons 6-10
            if (data.stockButtonsMessageId) {
              try {
                const buttonsMsg = await channel.messages.fetch(data.stockButtonsMessageId);
                await buttonsMsg.edit({ content: '‎', components: rows.slice(5, 10) });
              } catch {
                // Message was deleted — create a new one
                const newMsg = await channel.send({ content: '‎', components: rows.slice(5, 10) });
                data.stockButtonsMessageId = newMsg.id;
                saveData(data);
              }
            } else {
              // No second message yet — create it
              const newMsg = await channel.send({ content: '‎', components: rows.slice(5, 10) });
              data.stockButtonsMessageId = newMsg.id;
              saveData(data);
            }
          } else if (data.stockButtonsMessageId) {
            // Items <= 5, delete the second message if it exists
            try {
              const buttonsMsg = await channel.messages.fetch(data.stockButtonsMessageId);
              await buttonsMsg.delete();
            } catch {}
            data.stockButtonsMessageId = null;
            saveData(data);
          }
        }
      } catch (e) {}
    }

    if (data.publicStockMessageId && data.publicStockChannelId) {
      try {
        const channel = client.channels.cache.get(data.publicStockChannelId);

        if (channel) {
          const msg = await channel.messages.fetch(data.publicStockMessageId);

          await msg.edit({
            embeds: [embed],
            components: []
          });
        }
      } catch (e) {}
    }
  } catch (e) {
    console.error('updateStockPanel error:', e.message);
  }
}

async function notifyRestock(item, oldAmount, newAmount, sourceChannelId = null, options = {}) {
  const previousAmount = Number(oldAmount || 0);
  const currentAmount = Number(newAmount || 0);
  const addedAmount = currentAmount - previousAmount;

  if (!item || currentAmount <= 0 || addedAmount <= 0) return;

  const data = loadData();
  const channelId = options.channelId || data.restockChannelId || RESTOCK_CHANNEL_ID || data.publicStockChannelId || data.stockChannelId || sourceChannelId || STOCK_CHANNEL_ID;
  const channel = client.channels.cache.get(channelId) || await client.channels.fetch(channelId).catch(() => null);

  if (!channel?.send) return;

  const mention = PING_ROLES.restocks ? `<@&${PING_ROLES.restocks}>` : '';
  const shouldMention = options.mention !== false;
  const topLine = shouldMention && mention ? mention : (options.content ? `-# ${options.content}` : null);

  const orderRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_cat_items_geld')
      .setLabel('Jetzt bestellen')
      .setEmoji('🛒')
      .setStyle(ButtonStyle.Success)
  );

  const payload = card({
    tone: 'success',
    eyebrow: '📦 Restock',
    title: `${item.emoji && !emojiImageUrl(item) ? `${item.emoji} ` : ''}${item.name} ist wieder da!`,
    body:
      `**Preis:** ${item.price || '—'}\n` +
      `**Verfügbar:** ${currentAmount} Stück  ·  **neu:** +${addedAmount}`,
    thumbnail: emojiImageUrl(item),
    footer: 'Schnell sein lohnt sich',
    rows: [orderRow],
    mention: topLine,
    allowedMentions: {
      roles: shouldMention && PING_ROLES.restocks ? [PING_ROLES.restocks] : []
    }
  });

  const message = await channel.send(payload).catch(e => console.error('restock notify error:', e.message));

  return {
    channelId,
    messageId: message?.id || null
  };
}

async function sendRestockPreview(interaction) {
  const data = loadData();
  if (!data.stockItems) data.stockItems = JSON.parse(JSON.stringify(STOCK_ITEMS));

  const itemId = interaction.options.getString('id');
  const item = itemId
    ? data.stockItems.find(i => i.id === itemId)
    : data.stockItems[0];

  if (!item) {
    return interaction.reply({
      content: itemId
        ? `❌ Item \`${itemId}\` nicht gefunden. Nutze \`/stock listitems\` für die IDs.`
        : '❌ Es gibt noch keine Stock-Items für eine Vorschau.',
      ephemeral: true
    });
  }

  const oldAmount = interaction.options.getInteger('alt') ?? Number(data.stock?.[item.id] || 0);
  const newAmount = interaction.options.getInteger('neu') ?? Math.max(oldAmount + 5, 1);

  if (newAmount <= oldAmount) {
    return interaction.reply({
      content: '❌ Der neue Bestand muss größer als der alte Bestand sein, sonst wäre es kein Restock.',
      ephemeral: true
    });
  }

  const preview = await notifyRestock(item, oldAmount, newAmount, interaction.channelId, {
    mention: false,
    content: 'Vorschau - kein Rollen-Ping'
  });

  if (!preview?.channelId) {
    return interaction.reply({
      content: '❌ Vorschau konnte nicht gesendet werden. Prüfe, ob der Bot in den Restock-Channel schreiben darf.',
      ephemeral: true
    });
  }

  const messageLink = preview.messageId
    ? `\nNachricht: https://discord.com/channels/${interaction.guildId}/${preview.channelId}/${preview.messageId}`
    : '';

  return interaction.reply({
    content: `✅ Vorschau ohne Rollen-Ping in <#${preview.channelId}> gesendet.${messageLink}`,
    ephemeral: true
  });
}

module.exports = {
  normalizeStockEmoji,
  getMutableStockItems,
  getLatestShopOffer,
  buildShopPanelEmbed,
  buildSaleEmbed,
  buildShopPanelCard,
  buildSaleCard,
  buildStockEmbed,
  buildStockButtons,
  updateStockPanel,
  notifyRestock,
  sendRestockPreview,
};
