const {
  Client, GatewayIntentBits, EmbedBuilder,
  ButtonBuilder, ButtonStyle, ActionRowBuilder,
  REST, Routes, SlashCommandBuilder, PermissionFlagsBits,
  ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle,
  AttachmentBuilder, ActivityType, Partials
} = require('discord.js');

const fs = require('fs'); 
const path = require('path');
const express = require('express');
const cors = require('cors');
const { execSync } = require('child_process');
const { BrandEmbed, notice, noticeFromText, setBrandIcon } = require('./src/theme');
const guildConfig = require('./src/guildConfig');
const coreCommands = require('./src/commands/core');
const updateCommands = require('./src/commands/update');
const structureCommands = require('./src/commands/structure');
const renameCommands = require('./src/commands/rename');

// Aktueller Git-Commit, damit man sieht, ob das Auto-Update gegriffen hat.
function readGitCommitFromFiles() {
  // Fallback ohne git-Binary: Commit direkt aus .git lesen
  const gitDir = path.join(__dirname, '.git');
  const head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
  if (!head.startsWith('ref: ')) return head;

  const ref = head.slice(5);
  const refFile = path.join(gitDir, ref);
  if (fs.existsSync(refFile)) return fs.readFileSync(refFile, 'utf8').trim();

  const packed = fs.readFileSync(path.join(gitDir, 'packed-refs'), 'utf8');
  const line = packed.split('\n').find(l => l.endsWith(` ${ref}`));
  return line ? line.split(' ')[0] : '';
}

let BOT_VERSION = 'unbekannt';
try {
  BOT_VERSION = execSync('git log -1 --format="%h (%cd)" --date=format:"%d.%m.%Y %H:%M"', { cwd: __dirname, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
} catch (e) {
  console.warn('git version lookup failed:', e.message.split('\n')[0]);
  try {
    const commit = readGitCommitFromFiles();
    if (commit) BOT_VERSION = commit.slice(0, 7);
  } catch (err) {
    console.warn('git version fallback failed:', err.message);
  }
}

loadLocalEnv();

function loadLocalEnv(file = path.join(__dirname, '.env')) {
  if (!fs.existsSync(file)) return;

  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();

    if (!key || process.env[key] !== undefined) continue;
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

const PRESENCE_CONFIG_FILE = process.env.PRESENCE_CONFIG_FILE || path.join(__dirname, 'bot-presence.json');

const DEFAULT_PRESENCE_CONFIG = {
  status: 'online',
  activityType: 'Watching',
  activityName: 'HugoSMP Market',
  activityUrl: null
};

function loadPresenceConfig() {
  let config = DEFAULT_PRESENCE_CONFIG;

  try {
    if (fs.existsSync(PRESENCE_CONFIG_FILE)) {
      config = {
        ...config,
        ...JSON.parse(fs.readFileSync(PRESENCE_CONFIG_FILE, 'utf8'))
      };
    }
  } catch (e) {
    console.error('bot-presence.json error:', e.message);
  }

  try {
    const data = loadData();
    if (data.presence && typeof data.presence === 'object') {
      config = {
        ...config,
        ...data.presence
      };
    }
  } catch (e) {
    console.error('presence data error:', e.message);
  }

  return config;
}

function normalizePresenceStatus(status) {
  const value = String(status || 'online').toLowerCase();

  const statuses = {
    online: 'online',
    idle: 'idle',
    abwesend: 'idle',
    dnd: 'dnd',
    busy: 'dnd',
    beschaeftigt: 'dnd',
    beschäftigt: 'dnd',
    offline: 'invisible',
    invisible: 'invisible',
    unsichtbar: 'invisible'
  };

  return statuses[value] || 'online';
}

function getActivityType(type) {
  const value = String(type || 'Watching').toLowerCase();

  const activityTypes = {
    playing: ActivityType.Playing,
    spielt: ActivityType.Playing,
    streaming: ActivityType.Streaming,
    listening: ActivityType.Listening,
    hoert: ActivityType.Listening,
    hört: ActivityType.Listening,
    watching: ActivityType.Watching,
    schaut: ActivityType.Watching,
    competing: ActivityType.Competing
  };

  return activityTypes[value] ?? ActivityType.Watching;
}

function applyConfiguredPresence() {
  const presence = loadPresenceConfig();
  const activities = [];

  if (presence.activityName) {
    const activity = {
      name: presence.activityName,
      type: getActivityType(presence.activityType)
    };

    if (activity.type === ActivityType.Streaming && presence.activityUrl) {
      activity.url = presence.activityUrl;
    }

    activities.push(activity);
  }

  client.user.setPresence({
    status: normalizePresenceStatus(presence.status),
    activities
  });
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel]
});

// ── Config ── (src/config.js)
const {
  TOKEN,
  DATA_FILE,
  PORT,
  WEBSITE_URL,
  DASHBOARD_PASSWORD,
  DASHBOARD_URL,
  GUILD_ID,
  REVIEWS_CHANNEL_ID,
  KUNDEN_ROLE_ID,
  REQUIRED_INVITES,
  REWARD,
  RULES_CHANNEL_ID,
  VERIFY_ROLE_ID,
  REWARD_LOG_ID,
  LEADERBOARD_CHANNEL_ID,
  TICKET_CATEGORY_ID,
  CLOSED_TICKET_CATEGORY_ID,
  TICKET_LOG_CHANNEL_ID,
  DM_STAFF_CHANNEL_ID,
  DM_STAFF_MENTION,
  MAX_DASHBOARD_ATTACHMENTS,
  MAX_DASHBOARD_ATTACHMENT_BYTES,
  MAX_DASHBOARD_ATTACHMENT_TOTAL_BYTES,
  STOCK_CHANNEL_ID,
  RESTOCK_CHANNEL_ID,
  SHOP_PANEL_CHANNEL_ID,
  PUNISH_LOG_CHANNEL_ID,
  STAFF_ROLE_IDS,
  PING_ROLES,
  MIN_ACCOUNT_AGE_MS,
  STOCK_ITEMS,
} = require('./src/config');
guildConfig.init(process.env.GUILD_CONFIG_FILE || path.join(path.dirname(DATA_FILE), 'guild-config.json'));

// ── Hilfsfunktionen ── (src/util.js)
const {
  cleanUsername,
  cleanShortText,
  cleanLongText,
  normalizeStockItemId,
  parsePriceNumber,
  formatEuroValue,
  parseDuration,
  formatTimeLeft,
  joinEmbedLines,
  stockStatusText,
} = require('./src/util');

// ── Data helpers ── (src/store.js)
const {
  loadData,
  saveData,
  getInvites,
  setInvites,
  addInvite,
  hasBeenCounted,
  markAsCounted,
  setPending,
  getPending,
  removePending,
  getNextOrderId,
  getNextTicketOrderId,
  hasReviewedOrder,
  markReviewedOrder,
  hasReviewDecision,
  markReviewDecision,
  hasOrderFormSubmitted,
  markOrderFormSubmitted,
} = require('./src/store');

// ── Helpers ───────────────────────────────────────────────────────
const closingTickets = new Set();

function isStaff(member) {
  return STAFF_ROLE_IDS.some(roleId => member.roles.cache.has(roleId)) ||
    member.permissions.has(PermissionFlagsBits.Administrator);
}

function getTicketOwnerId(channel) {
  const topic = channel.topic || '';
  const match = topic.match(/owner:(\d+)/);
  return match ? match[1] : null;
}

function getTicketType(channel) {
  const topic = channel.topic || '';
  const match = topic.match(/type:([a-z]+)/);
  return match ? match[1] : 'ticket';
}

function getTicketOrderId(channel) {
  const topic = channel.topic || '';
  const match = topic.match(/order:([^;]+)/);
  return match ? match[1] : 'none';
}

async function buildTranscript(channel) {
  try {
    let allMessages = [];
    let lastId = null;

    while (true) {
      const options = { limit: 100 };
      if (lastId) options.before = lastId;

      const messages = await channel.messages.fetch(options);
      if (messages.size === 0) break;

      allMessages.push(...messages.values());
      lastId = messages.last().id;

      if (messages.size < 100) break;
    }

    const sorted = allMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    if (sorted.length === 0) {
      return 'Keine Nachrichten gefunden.';
    }

    return sorted.map(msg => {
      const time = new Date(msg.createdTimestamp).toLocaleString('de-DE');
      const author = `${msg.author.tag} (${msg.author.id})`;
      const content = msg.content || '[Embed/Anhang/Keine Textnachricht]';
      const attachments = msg.attachments.size > 0
        ? `\nAnhänge: ${msg.attachments.map(a => a.url).join(', ')}`
        : '';

      return `[${time}] ${author}: ${content}${attachments}`;
    }).join('\n');
  } catch (e) {
    console.error('buildTranscript error:', e.message);
    return 'Transcript konnte nicht erstellt werden.';
  }
}

async function sendTicketLog(guild, channel, closedBy, reason = 'Geschlossen') {
  try {
    const logChannel = guild.channels.cache.get(TICKET_LOG_CHANNEL_ID);
    if (!logChannel) return;

    const ownerId = getTicketOwnerId(channel);
    const ticketType = getTicketType(channel);
    const ticketOrderId = getTicketOrderId(channel);
    const transcript = await buildTranscript(channel);

    const attachment = new AttachmentBuilder(
      Buffer.from(transcript, 'utf8'),
      { name: `${channel.name}-transcript.txt` }
    );

    const embed = new BrandEmbed()
      .setTone('neutral')
      .setTitle('Ticket geschlossen')
      .setDescription(`\`#${channel.name}\``)
      .addFields(
        { name: 'Typ', value: String(ticketType || '—'), inline: true },
        { name: 'Bestellung', value: ticketOrderId && ticketOrderId !== 'none' ? `#${ticketOrderId}` : '—', inline: true },
        { name: 'Kunde', value: ownerId ? `<@${ownerId}>` : 'Unbekannt', inline: true },
        { name: 'Geschlossen von', value: `<@${closedBy.id}>`, inline: true },
        { name: 'Grund', value: String(reason || '—').slice(0, 1024), inline: true }
      )
      .setFooter({ text: 'Transkript im Anhang' })
      .setTimestamp();

    await logChannel.send({
      embeds: [embed],
      files: [attachment]
    });
  } catch (e) {
    console.error('sendTicketLog error:', e.message);
  }
}

async function closeTicket(channel, closedBy, reason = 'Geschlossen') {
  if (closingTickets.has(channel.id)) {
    return;
  }

  if (channel.parentId === CLOSED_TICKET_CATEGORY_ID || channel.name.startsWith('closed-')) {
    return;
  }

  closingTickets.add(channel.id);

  try {
    const ownerId = getTicketOwnerId(channel);

    await sendTicketLog(channel.guild, channel, closedBy, reason);

    if (ownerId) {
      await channel.permissionOverwrites.edit(ownerId, {
        ViewChannel: false,
        SendMessages: false,
        ReadMessageHistory: false
      }).catch(() => {});
    }

    await channel.setParent(CLOSED_TICKET_CATEGORY_ID).catch(() => {});

    if (!channel.name.startsWith('closed-')) {
      await channel.setName(`closed-${channel.name}`.slice(0, 100)).catch(() => {});
    }

    const reopenRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('reopen_ticket')
        .setLabel('Ticket wieder öffnen')
        .setEmoji('🔓')
        .setStyle(ButtonStyle.Secondary)
    );

    await channel.send({
      embeds: [notice('Dieses Ticket wurde geschlossen. Das Team kann es wieder öffnen.', 'neutral')],
      components: [reopenRow]
    }).catch(() => {});
  } finally {
    setTimeout(() => {
      closingTickets.delete(channel.id);
    }, 30000);
  }
}

async function reopenTicket(channel, reopenedBy) {
  const ownerId = getTicketOwnerId(channel);

  await channel.setParent(TICKET_CATEGORY_ID).catch(() => {});

  if (channel.name.startsWith('closed-')) {
    await channel.setName(channel.name.replace('closed-', '').slice(0, 100)).catch(() => {});
  }

  if (ownerId) {
    await channel.permissionOverwrites.edit(ownerId, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true
    }).catch(() => {});
  }

  const logChannel = channel.guild.channels.cache.get(TICKET_LOG_CHANNEL_ID);
  if (logChannel) {
    await logChannel.send({
      embeds: [notice(`Ticket <#${channel.id}> wurde von <@${reopenedBy.id}> wieder geöffnet.`, 'neutral')]
    }).catch(() => {});
  }

  await channel.send({
    embeds: [notice(`Ticket wurde von <@${reopenedBy.id}> wieder geöffnet.`, 'neutral')]
  }).catch(() => {});
}


// ── Giveaway helpers ──────────────────────────────────────────────
function isDashboardTicketChannel(channel) {
  return Boolean(
    channel &&
    channel.type === ChannelType.GuildText &&
    (
      channel.parentId === TICKET_CATEGORY_ID ||
      channel.parentId === CLOSED_TICKET_CATEGORY_ID ||
      /owner:\d{17,20}/.test(channel.topic || '')
    )
  );
}

function getDashboardTicketChannels() {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return [];

  return guild.channels.cache
    .filter(channel => isDashboardTicketChannel(channel))
    .map(channel => channel);
}

function getTicketOpenState(channel) {
  return channel.parentId === CLOSED_TICKET_CATEGORY_ID || channel.name.startsWith('closed-')
    ? 'closed'
    : 'open';
}

async function getUserSummary(userId, fetchMissingUser = true) {
  if (!userId) return null;
  let user = getCachedDashboardUser(userId);

  if (!user && fetchMissingUser) {
    user = await client.users.fetch(userId).catch(() => null);
  } else if (!user) {
    client.users.fetch(userId).catch(() => {});
  }

  return {
    userId,
    username: getUserDisplayName(user, userId),
    avatarUrl: getUserAvatar(user)
  };
}

function getTicketDashboardMeta(data, channelId) {
  data.dashboardTicketMeta = data.dashboardTicketMeta || {};
  return data.dashboardTicketMeta[channelId] || {};
}

function getOrderDashboardMeta(data, channelId) {
  data.dashboardOrderMeta = data.dashboardOrderMeta || {};
  return {
    status: 'offen',
    note: '',
    assigneeId: null,
    assigneeName: null,
    invoice: null,
    invoiceSentAt: null,
    updatedAt: null,
    completedAt: null,
    reviewOrderId: null,
    ...(data.dashboardOrderMeta[channelId] || {})
  };
}

function buildOrderTicketButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('order_assign_self')
      .setLabel('Übernehmen')
      .setEmoji('📌')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('close_ticket')
      .setLabel('Ticket schließen')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Secondary)
  );
}

function buildOrderStartRow() {
  return new ActionRowBuilder().addComponents(
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
      .setStyle(ButtonStyle.Secondary)
  );
}

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

function normalizeOrderItems(items, data = loadData()) {
  const rows = Array.isArray(items) ? items : [];

  return rows
    .map(item => {
      const name = cleanShortText(item?.name || item?.item || 'Unbekanntes Item', 80);
      const quantity = Math.max(1, Number.parseInt(item?.quantity || item?.qty || item?.amount || 1, 10) || 1);
      const stockItem = findStockItemByText(name, data);
      const price = cleanShortText(item?.price || stockItem?.price || '', 40);

      return {
        id: stockItem?.id || null,
        name,
        quantity,
        price,
        emoji: stockItem?.emoji || item?.emoji || ''
      };
    })
    .filter(item => item.name);
}

function findStockItemByText(value, data = loadData()) {
  const needle = String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (!needle) return null;

  return (data.stockItems || STOCK_ITEMS).find(item => {
    const hay = `${item.id} ${item.name}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    return hay === needle || hay.includes(needle) || needle.includes(hay);
  }) || null;
}

function buildInvoiceFromOrderInput({
  orderId,
  ownerId,
  username,
  category,
  items,
  item,
  amount,
  total,
  payment,
  ingame,
  note
}, data = loadData()) {
  const normalizedItems = normalizeOrderItems(
    items || [{ name: item, quantity: amount || 1 }],
    data
  );

  let hasPrice = false;
  const calculatedTotal = normalizedItems.reduce((sum, row) => {
    const price = parsePriceNumber(row.price);
    if (price !== null) hasPrice = true;
    return price === null ? sum : sum + (price * row.quantity);
  }, 0);

  return {
    orderId: cleanShortText(orderId || 'none', 40),
    ownerId: ownerId || null,
    username: cleanShortText(username || '', 80),
    category: cleanShortText(category || '', 80),
    items: normalizedItems,
    itemsText: normalizedItems.length
      ? normalizedItems.map(row => `${row.name} x${row.quantity}${row.price ? ` - ${row.price}` : ''}`).join('\n')
      : cleanLongText(item || ''),
    total: cleanShortText(total || (hasPrice ? formatEuroValue(calculatedTotal) : 'Offen'), 80),
    payment: cleanShortText(payment || '', 80),
    ingame: cleanShortText(ingame || '', 80),
    note: cleanLongText(note || '', 800),
    createdAt: Date.now()
  };
}

function buildInvoiceFromDashboardInput(body, fallback = {}) {
  const itemsText = cleanLongText(body?.itemsText || fallback.itemsText || '', 1200);
  return {
    ...fallback,
    itemsText,
    total: cleanShortText(body?.total || fallback.total || 'Offen', 80),
    payment: cleanShortText(body?.payment || fallback.payment || '', 80),
    ingame: cleanShortText(body?.ingame || fallback.ingame || '', 80),
    note: cleanLongText(body?.note || fallback.note || '', 800),
    createdAt: fallback.createdAt || Date.now()
  };
}

function invoiceItemsText(invoice) {
  if (invoice?.itemsText) return invoice.itemsText;
  if (Array.isArray(invoice?.items) && invoice.items.length) {
    return invoice.items.map(row =>
      `${row.emoji ? `${row.emoji} ` : ''}${row.name} x${row.quantity}${row.price ? ` - ${row.price}` : ''}`
    ).join('\n');
  }
  return 'Noch keine Produkte eingetragen.';
}

function buildOrderInvoiceEmbed(invoice, { title = 'Rechnung' } = {}) {
  const facts = [
    invoice.ownerId && { name: 'Kunde', value: `<@${invoice.ownerId}>`, inline: true },
    invoice.category && { name: 'Kategorie', value: String(invoice.category), inline: true },
    invoice.ingame && { name: 'Ingame', value: String(invoice.ingame), inline: true },
    invoice.payment && { name: 'Zahlung', value: String(invoice.payment), inline: true }
  ].filter(Boolean);

  const embed = new BrandEmbed()
    .setTitle(`${title}${invoice.orderId && invoice.orderId !== 'none' ? ` #${invoice.orderId}` : ''}`)
    .addFields(
      ...facts,
      { name: 'Produkte', value: invoiceItemsText(invoice).slice(0, 1024), inline: false },
      { name: 'Gesamt', value: `**${invoice.total || 'Offen'}**`, inline: false }
    )
    .setFooter({ text: 'Market' })
    .setTimestamp();

  if (invoice.note) {
    embed.addFields({
      name: 'Hinweis',
      value: invoice.note.slice(0, 1024),
      inline: false
    });
  }

  return embed;
}

async function sendOrderInvoice(channel, invoice, { automatic = false } = {}) {
  await channel.send({
    content: invoice.ownerId
      ? `<@${invoice.ownerId}> ${automatic ? 'hier ist deine Bestellübersicht:' : 'hier ist deine Rechnung:'}`
      : undefined,
    embeds: [buildOrderInvoiceEmbed(invoice, { title: automatic ? 'Bestellübersicht' : 'Rechnung' })],
    allowedMentions: invoice.ownerId ? { users: [invoice.ownerId] } : undefined
  });

  updateDashboardOrderMeta(channel.id, {
    invoice,
    invoiceSentAt: Date.now()
  });
}

function extractOrderInvoiceDraft(order, messages, data = loadData()) {
  const meta = getOrderDashboardMeta(data, order.channelId);
  if (meta.invoice) {
    return {
      orderId: order.orderId,
      ownerId: order.ownerId,
      ...meta.invoice
    };
  }

  const fields = [];
  (messages || []).forEach(message => {
    (message.embeds || []).forEach(embed => {
      (embed.fields || []).forEach(field => {
        fields.push({
          name: String(field.name || '').toLowerCase(),
          value: String(field.value || '')
        });
      });
    });
  });

  const findField = names => {
    const hit = fields.find(field => names.some(name => field.name.includes(name)));
    return hit?.value || '';
  };

  return buildInvoiceFromOrderInput({
    orderId: order.orderId,
    ownerId: order.ownerId,
    username: order.owner?.username || '',
    category: ticketTypeLabelForInvoice(order.type),
    item: findField(['item', 'schematic', 'resource pack', 'produkt']),
    amount: findField(['menge']),
    payment: findField(['zahlung']),
    ingame: findField(['ingame']),
    total: findField(['gesamt'])
  }, data);
}

function ticketTypeLabelForInvoice(type) {
  return ({
    bestellung: 'Bestellung',
    reward: 'Reward',
    support: 'Support'
  })[type] || type || '';
}

async function getDashboardStaffMembers() {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return [];

  await guild.members.fetch().catch(() => null);

  return guild.members.cache
    .filter(member => !member.user.bot && isStaff(member))
    .map(member => ({
      userId: member.id,
      username: getUserDisplayName(member.user, member.id),
      avatarUrl: getUserAvatar(member.user)
    }))
    .sort((a, b) => a.username.localeCompare(b.username));
}

async function getDashboardTextChannels() {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return [];

  return guild.channels.cache
    .filter(channel => channel.type === ChannelType.GuildText)
    .map(channel => ({
      id: channel.id,
      name: channel.name,
      parentId: channel.parentId || null,
      parentName: channel.parent?.name || null
    }))
    .sort((a, b) => `${a.parentName || ''}/${a.name}`.localeCompare(`${b.parentName || ''}/${b.name}`));
}

async function resolveDashboardTextChannel(channelId) {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) throw makeDashboardError('Discord Server wurde nicht gefunden.', 500);

  const channel = guild.channels.cache.get(String(channelId || '').trim()) ||
    await client.channels.fetch(String(channelId || '').trim()).catch(() => null);

  if (!channel || channel.guild?.id !== guild.id || channel.type !== ChannelType.GuildText) {
    throw makeDashboardError('Channel nicht gefunden.', 404);
  }

  return channel;
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

function ticketUrl(channel) {
  return `https://discord.com/channels/${channel.guild.id}/${channel.id}`;
}

async function serializeDashboardTicket(channel, data = loadData(), options = {}) {
  const ownerId = getTicketOwnerId(channel);
  const owner = await getUserSummary(ownerId, options.fetchUsers !== false);
  const meta = getTicketDashboardMeta(data, channel.id);

  return {
    channelId: channel.id,
    name: channel.name,
    url: ticketUrl(channel),
    topic: channel.topic || '',
    ownerId,
    owner,
    type: getTicketType(channel),
    orderId: getTicketOrderId(channel),
    state: getTicketOpenState(channel),
    parentId: channel.parentId || null,
    createdAt: channel.createdTimestamp || null,
    lastMessageId: channel.lastMessageId || null,
    note: meta.note || '',
    pinned: Boolean(meta.pinned)
  };
}

async function getDashboardTicketList({ state = 'open', type = 'all' } = {}) {
  const data = loadData();
  const channels = getDashboardTicketChannels()
    .filter(channel => state === 'all' || getTicketOpenState(channel) === state)
    .filter(channel => type === 'all' || getTicketType(channel) === type);
  const tickets = await Promise.all(
    channels.map(channel => serializeDashboardTicket(channel, data, { fetchUsers: false }))
  );

  return tickets
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
}

async function getTicketRecentMessages(channel, limit = 40) {
  const messages = await channel.messages.fetch({ limit }).catch(() => null);
  if (!messages) return [];

  return [...messages.values()]
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
    .map(message => ({
      id: message.id,
      authorId: message.author?.id || null,
      author: getUserDisplayName(message.author, message.author?.id || 'Unbekannt'),
      avatarUrl: getUserAvatar(message.author),
      bot: Boolean(message.author?.bot),
      content: message.content || '',
      attachments: getMessageAttachments(message),
      embeds: (message.embeds || []).slice(0, 3).map(embed => ({
        title: embed.title || '',
        description: embed.description || '',
        fields: (embed.fields || []).slice(0, 8).map(field => ({
          name: field.name || '',
          value: field.value || ''
        }))
      })),
      timestamp: message.createdTimestamp
    }));
}

function getDashboardChannel(channelId) {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return null;
  const channel = guild.channels.cache.get(channelId);
  if (!isDashboardTicketChannel(channel)) return null;
  return channel;
}

async function getDashboardTicketDetails(channelId) {
  const channel = getDashboardChannel(channelId);
  if (!channel) {
    const err = new Error('Ticket nicht gefunden.');
    err.status = 404;
    throw err;
  }

  const data = loadData();
  const ticket = await serializeDashboardTicket(channel, data);
  const messages = await getTicketRecentMessages(channel);
  const ownerInfo = ticket.ownerId ? await getDmUserInfo(ticket.ownerId, data) : null;

  return { ticket, messages, ownerInfo };
}

async function serializeDashboardOrder(channel, data = loadData(), options = {}) {
  const ticket = await serializeDashboardTicket(channel, data, options);
  const meta = getOrderDashboardMeta(data, channel.id);
  const assignee = meta.assigneeId ? await getUserSummary(meta.assigneeId, options.fetchUsers !== false) : null;

  return {
    ...ticket,
    status: meta.status,
    note: meta.note,
    assigneeId: meta.assigneeId,
    assigneeName: meta.assigneeName || assignee?.username || null,
    assignee,
    invoiceSentAt: meta.invoiceSentAt || null,
    updatedAt: meta.updatedAt,
    completedAt: meta.completedAt,
    reviewOrderId: meta.reviewOrderId
  };
}

async function getDashboardOrderList({ status = 'active' } = {}) {
  const data = loadData();
  const orders = await Promise.all(
    getDashboardTicketChannels()
      .filter(channel => getTicketType(channel) === 'bestellung')
      .map(channel => serializeDashboardOrder(channel, data, { fetchUsers: false }))
  );

  return orders
    .filter(order => {
      if (status === 'all') return true;
      if (status === 'done') return order.status === 'fertig';
      if (status === 'cancelled') return order.status === 'storniert';
      return !['fertig', 'storniert'].includes(order.status);
    })
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
}

async function getDashboardOrderDetails(channelId) {
  const details = await getDashboardTicketDetails(channelId);
  const channel = getDashboardChannel(channelId);
  if (!channel || getTicketType(channel) !== 'bestellung') {
    const err = new Error('Bestellung nicht gefunden.');
    err.status = 404;
    throw err;
  }
  const data = loadData();
  const order = await serializeDashboardOrder(channel, data);
  const invoice = extractOrderInvoiceDraft(order, details.messages, data);

  return {
    ...details,
    order,
    invoice,
    staff: await getDashboardStaffMembers()
  };
}

function updateDashboardOrderMeta(channelId, patch) {
  const data = loadData();
  data.dashboardOrderMeta = data.dashboardOrderMeta || {};
  data.dashboardOrderMeta[channelId] = {
    ...getOrderDashboardMeta(data, channelId),
    ...patch,
    updatedAt: Date.now()
  };
  saveData(data);
  return data.dashboardOrderMeta[channelId];
}

async function sendOrderReviewRequest(channel, ownerId, orderId) {
  const reviewOrderId = orderId && orderId !== 'none'
    ? orderId
    : getNextOrderId();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`bewerten_${ownerId}_${reviewOrderId}`)
      .setLabel('Jetzt bewerten')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('⭐')
  );

  await channel.send({
    content:
      `✅ Bestellung für <@${ownerId}> wurde als **fertig** markiert!\n` +
      `**Order-ID:** ${reviewOrderId}\n\n` +
      `<@${ownerId}>, bitte bewerte den Shop!\n\n` +
      `> Nach der Bewertung erhältst du automatisch die **Kunden-Rolle**.`,
    components: [row],
    allowedMentions: { users: [ownerId] }
  });

  updateDashboardOrderMeta(channel.id, {
    status: 'fertig',
    completedAt: Date.now(),
    reviewOrderId
  });

  return reviewOrderId;
}

function buildGiveawayEmbed(gw, ended = false) {
  const timeLeft = ended ? 'Beendet' : formatTimeLeft(gw.endTime - Date.now());
  const reqs = [];
  if (gw.minInvites > 0) reqs.push(`Mindestens **${gw.minInvites}** Einladungen`);
  if (gw.minAccountAgeDays > 0) reqs.push(`Konto älter als **${gw.minAccountAgeDays}** Tage`);

  const embed = new BrandEmbed()
    .setColor(ended ? 'muted' : 'primary')
    .setAuthor({ name: ended ? 'Giveaway beendet' : 'Giveaway' })
    .setTitle(gw.prize)
    .addFields(
      { name: ended ? 'Endete' : 'Endet', value: `<t:${Math.floor(gw.endTime / 1000)}:R>`, inline: true },
      { name: 'Gewinner', value: String(gw.winnersCount), inline: true },
      { name: 'Teilnehmer', value: String(gw.participants.length), inline: true },
      { name: 'Veranstaltet von', value: `<@${gw.hostedBy}>`, inline: true }
    );

  if (reqs.length) embed.addFields({ name: 'Voraussetzungen', value: reqs.map(x => `• ${x}`).join('\n'), inline: false });
  if (ended) {
    embed.addFields({
      name: 'Ergebnis',
      value: gw.winners?.length ? gw.winners.map(w => `<@${w}>`).join(', ') : 'Keine gültigen Teilnehmer.',
      inline: false
    });
  }

  embed
    .setFooter({ text: ended ? 'Beendet' : 'Teilnahme über den Button' })
    .setTimestamp(new Date(gw.endTime));

  return embed;
}

async function endGiveaway(messageId) {
  const data = loadData();
  const gw = data.giveaways[messageId];
  if (!gw || gw.ended) return;

  gw.ended = true;

  let pool = [...gw.participants];
  const winners = [];

  // If zinked, that person wins
  if (gw.zinkedWinner) {
    winners.push(gw.zinkedWinner);
    pool = pool.filter(p => p !== gw.zinkedWinner);
  }

  // Fill remaining winner slots
  const remaining = gw.winnersCount - winners.length;
  for (let i = 0; i < remaining && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    winners.push(pool[idx]);
    pool.splice(idx, 1);
  }

  gw.winners = winners;
  saveData(data);

  try {
    const channel = client.channels.cache.get(gw.channelId);
    if (!channel) return;
    const msg = await channel.messages.fetch(messageId).catch(() => null);
    if (!msg) return;

    const endedEmbed = buildGiveawayEmbed(gw, true);
    await msg.edit({ embeds: [endedEmbed], components: [] });

    if (winners.length > 0) {
      await channel.send({
        content: winners.map(w => `<@${w}>`).join(' '),
        embeds: [notice(`Glückwunsch! Ihr habt **${gw.prize}** gewonnen.`, 'success')]
      });
    } else {
      await channel.send({ embeds: [notice(`Das Giveaway **${gw.prize}** ist beendet – es gab keine gültigen Teilnehmer.`, 'muted')] });
    }
  } catch (e) {
    console.error('endGiveaway error:', e.message);
  }
}



// ── Welcome / Leave helpers ───────────────────────────────────────
function buildWelcomeLeaveEmbed(template, member, color) {
  const text = template
    .replace(/{user}/g, `<@${member.id}>`)
    .replace(/{username}/g, member.user.username)
    .replace(/{server}/g, member.guild.name)
    .replace(/{count}/g, member.guild.memberCount.toString());

  return new BrandEmbed()
    .setColor(color || 'primary')
    .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL({ size: 64 }) })
    .setDescription(text)
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .setFooter({ text: `Mitglied #${member.guild.memberCount}` })
    .setTimestamp();
}

// ── Punish / Moderation helpers ──────────────────────────────────
function addWarning(userId, moderatorId, reason) {
  const data = loadData();
  if (!data.warnings[userId]) data.warnings[userId] = [];
  data.warnings[userId].push({
    id: Date.now(),
    moderatorId,
    reason,
    timestamp: Date.now()
  });
  saveData(data);
  return data.warnings[userId].length;
}

function getWarnings(userId) {
  const data = loadData();
  return data.warnings[userId] || [];
}

function clearWarnings(userId) {
  const data = loadData();
  data.warnings[userId] = [];
  saveData(data);
}

async function sendPunishLog(guild, { action, color, target, moderator, reason, duration, extra }) {
  const logChannelId = guildConfig.get(guild.id).modLogChannelId || PUNISH_LOG_CHANNEL_ID;
  const logChannel = guild.channels.cache.get(logChannelId);
  if (!logChannel) return;

  const embed = new BrandEmbed()
    .setColor(color)
    .setAuthor({ name: 'Moderation' })
    .setTitle(action)
    .addFields(
      { name: 'User', value: `<@${target.id}>\n-# ${target.tag || target.id}`, inline: true },
      { name: 'Moderator', value: `<@${moderator.id}>`, inline: true },
      { name: 'Grund', value: reason || 'Kein Grund angegeben', inline: false }
    )
    .setTimestamp();

  if (duration) embed.addFields({ name: 'Dauer', value: duration, inline: true });
  if (extra) embed.addFields({ name: 'Info', value: extra, inline: false });

  await logChannel.send({ embeds: [embed] }).catch(() => {});
}

async function tryDM(user, embed) {
  try { await user.send({ embeds: [embed] }); } catch {}
}

const MAX_DM_MESSAGES_PER_THREAD = 200;

function getUserDisplayName(user, fallbackId) {
  return user?.tag || user?.username || fallbackId;
}

function getUserAvatar(user) {
  try {
    return user?.displayAvatarURL?.({ size: 128 }) || null;
  } catch {
    return null;
  }
}

function ensureDmThread(data, user, userId) {
  data.dmThreads = data.dmThreads || {};

  const id = String(user?.id || userId || '').trim();
  if (!id) return null;

  const thread = data.dmThreads[id] || {
    userId: id,
    username: id,
    globalName: null,
    avatarUrl: null,
    unreadCount: 0,
    archived: false,
    archivedAt: null,
    answeredAt: null,
    lastMessageAt: null,
    messages: []
  };

  thread.userId = id;
  thread.username = getUserDisplayName(user, thread.username || id);
  thread.globalName = user?.globalName || thread.globalName || null;
  thread.avatarUrl = getUserAvatar(user) || thread.avatarUrl || null;
  thread.messages = Array.isArray(thread.messages) ? thread.messages : [];
  thread.unreadCount = Number(thread.unreadCount || 0);
  thread.archived = Boolean(thread.archived);
  thread.archivedAt = thread.archivedAt || null;
  thread.answeredAt = thread.answeredAt || null;

  data.dmThreads[id] = thread;
  return thread;
}

function cleanDmContent(content) {
  return String(content || '').trim().slice(0, 1800);
}

function getMessageAttachments(message) {
  if (!message?.attachments?.size) return [];

  return [...message.attachments.values()].slice(0, 8).map(attachment => ({
    name: attachment.name || 'attachment',
    url: attachment.url,
    contentType: attachment.contentType || null,
    size: attachment.size || 0
  }));
}

function makeDashboardError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function sanitizeDashboardFileName(name) {
  return String(name || 'attachment')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'attachment';
}

function normalizeDashboardAttachments(input) {
  const attachments = Array.isArray(input) ? input : [];
  if (attachments.length > MAX_DASHBOARD_ATTACHMENTS) {
    throw makeDashboardError(`Maximal ${MAX_DASHBOARD_ATTACHMENTS} Anhänge pro Nachricht.`);
  }

  const files = [];
  let totalBytes = 0;

  for (const item of attachments) {
    const raw = String(item?.data || '').trim();
    if (!raw) continue;

    const base64 = raw.includes(',') ? raw.slice(raw.indexOf(',') + 1) : raw;
    if (!/^[a-z0-9+/=\r\n]+$/i.test(base64)) {
      throw makeDashboardError('Ein Anhang konnte nicht gelesen werden.');
    }

    const buffer = Buffer.from(base64, 'base64');
    if (!buffer.length) continue;

    if (buffer.length > MAX_DASHBOARD_ATTACHMENT_BYTES) {
      throw makeDashboardError('Ein Anhang ist zu groß. Maximal 8 MB pro Datei.');
    }

    totalBytes += buffer.length;
    if (totalBytes > MAX_DASHBOARD_ATTACHMENT_TOTAL_BYTES) {
      throw makeDashboardError('Die Anhänge sind zusammen zu groß. Maximal 12 MB pro Nachricht.');
    }

    files.push({
      attachment: buffer,
      name: sanitizeDashboardFileName(item?.name)
    });
  }

  return files;
}

function isDmThreadAnswered(thread) {
  const messages = Array.isArray(thread?.messages) ? thread.messages : [];
  let lastIn = 0;
  let lastOut = 0;

  for (const message of messages) {
    if (message.direction === 'in') lastIn = Math.max(lastIn, Number(message.timestamp || 0));
    if (message.direction === 'out') lastOut = Math.max(lastOut, Number(message.timestamp || 0));
  }

  return lastOut > 0 && lastOut >= lastIn;
}

function addDmThreadMessage({ user, userId, direction, content, discordMessageId, attachments = [] }) {
  const cleanContent = cleanDmContent(content);
  if (!cleanContent && attachments.length === 0) return null;

  const data = loadData();
  const thread = ensureDmThread(data, user, userId);
  if (!thread) return null;

  const timestamp = Date.now();
  const message = {
    id: discordMessageId || `${timestamp}-${Math.random().toString(16).slice(2)}`,
    direction,
    content: cleanContent,
    attachments,
    timestamp
  };

  thread.messages.push(message);
  if (thread.messages.length > MAX_DM_MESSAGES_PER_THREAD) {
    thread.messages = thread.messages.slice(-MAX_DM_MESSAGES_PER_THREAD);
  }

  thread.lastMessageAt = timestamp;
  if (direction === 'in') {
    thread.unreadCount = (thread.unreadCount || 0) + 1;
    thread.archived = false;
    thread.archivedAt = null;
  } else if (direction === 'out') {
    thread.answeredAt = timestamp;
    thread.unreadCount = 0;
  }

  saveData(data);
  return { thread, message };
}

function serializeDmThread(thread, includeMessages = false) {
  const messages = Array.isArray(thread.messages) ? thread.messages : [];
  const lastMessage = messages[messages.length - 1] || null;

  const base = {
    userId: thread.userId,
    username: thread.username || thread.userId,
    globalName: thread.globalName || null,
    avatarUrl: thread.avatarUrl || null,
    unreadCount: Number(thread.unreadCount || 0),
    archived: Boolean(thread.archived),
    archivedAt: thread.archivedAt || null,
    answeredAt: thread.answeredAt || null,
    answered: isDmThreadAnswered(thread),
    messageCount: messages.length,
    lastMessageAt: thread.lastMessageAt || lastMessage?.timestamp || null,
    lastMessage
  };

  if (includeMessages) {
    base.messages = messages;
  }

  return base;
}

async function getDmUserInfo(userId, data = loadData()) {
  const user = await client.users.fetch(userId).catch(() => null);
  const guild = client.guilds.cache.get(GUILD_ID) || null;
  const member = guild
    ? await guild.members.fetch(userId).catch(() => null)
    : null;

  const roles = member
    ? member.roles.cache
      .filter(role => role.id !== guild.id)
      .sort((a, b) => b.position - a.position)
      .map(role => ({
        id: role.id,
        name: role.name,
        color: role.hexColor && role.hexColor !== '#000000' ? role.hexColor : null
      }))
      .slice(0, 15)
    : [];

  const warnings = Array.isArray(data.warnings?.[userId]) ? data.warnings[userId] : [];
  const recentWarnings = warnings.slice(-5).reverse().map((warning, index) => ({
    number: warnings.length - index,
    reason: warning.reason || 'Kein Grund angegeben',
    moderatorId: warning.moderatorId || null,
    timestamp: warning.timestamp || null
  }));

  return {
    userId,
    tag: getUserDisplayName(user, userId),
    avatarUrl: getUserAvatar(user),
    inGuild: Boolean(member),
    joinedAt: member?.joinedTimestamp || null,
    createdAt: user?.createdTimestamp || null,
    roles,
    invites: Number(data.invites?.[userId] || 0),
    warningsCount: warnings.length,
    warnings: recentWarnings
  };
}

async function notifyStaffAboutDm(saved) {
  if (!saved?.thread || !saved?.message || !DM_STAFF_CHANNEL_ID) return;

  try {
    const channel = await client.channels.fetch(DM_STAFF_CHANNEL_ID).catch(() => null);
    if (!channel?.isTextBased?.()) return;

    const { thread, message } = saved;
    const contentPreview = message.content
      ? message.content.slice(0, 1000)
      : `${message.attachments?.length || 0} Anhang/Anhänge`;

    const embed = new BrandEmbed()
      .setTone('neutral')
      .setTitle('Neue Direktnachricht')
      .setDescription(contentPreview || 'Neue Nachricht erhalten.')
      .addFields(
        { name: 'User', value: `<@${thread.userId}>`, inline: true },
        { name: 'User-ID', value: thread.userId, inline: true },
        { name: 'Ungelesen', value: String(thread.unreadCount || 1), inline: true }
      )
      .setTimestamp();

    if (thread.avatarUrl) embed.setThumbnail(thread.avatarUrl);
    if (message.attachments?.length) {
      embed.addFields({
        name: 'Anhänge',
        value: message.attachments.map(file => file.name || 'Anhang').slice(0, 5).join(', '),
        inline: false
      });
    }

    const components = DASHBOARD_URL
      ? [new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setURL(DASHBOARD_URL)
            .setLabel('Dashboard öffnen')
        )]
      : [];

    await channel.send({
      content: DM_STAFF_MENTION || undefined,
      embeds: [embed],
      components
    }).catch(() => {});
  } catch (e) {
    console.error('dm staff notify error:', e.message);
  }
}

// ── Invite cache ──────────────────────────────────────────────────
const cachedInvites = new Map();

async function cacheInvites(guild) {
  try {
    const invites = await guild.invites.fetch();

    invites.forEach(inv => {
      cachedInvites.set(inv.code, {
        inviterId: inv.inviter?.id ?? null,
        uses: inv.uses ?? 0
      });
    });

    console.log(`📋 Cached ${invites.size} invites for ${guild.name}`);
  } catch (e) {
    console.error('cacheInvites error:', e.message);
  }
}

// ── Leaderboard ───────────────────────────────────────────────────
function buildLeaderboardEmbed(data = loadData()) {
  const botId = client.user.id;

  const sorted = Object.entries(data.invites)
    .filter(([userId, v]) => v > 0 && userId !== botId)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  // Format "**N** invite(s)" bleibt, importInvitesFromLeaderboardMessage liest es.
  const lines = sorted.length > 0
    ? sorted.map(([userId, count], i) =>
        `\`${String(i + 1).padStart(2, '0')}\`  <@${userId}> · **${count}** invite${count === 1 ? '' : 's'}`
      ).join('\n')
    : '-# Noch keine Einladungen vorhanden.';

  return new BrandEmbed()
    .setTitle('Invite Leaderboard')
    .setDescription(lines)
    .setFooter({ text: `Ziel: ${REQUIRED_INVITES} verifizierte Einladungen · ${REWARD}` })
    .setTimestamp();
}

function importInvitesFromLeaderboardMessage(data, message) {
  const description = message.embeds?.[0]?.description;
  if (!description) return false;

  let changed = false;

  for (const line of description.split('\n')) {
    const userMatch = line.match(/<@!?(\d{17,20})>/);
    const countMatch = line.match(/(?:\*\*)?(\d+)(?:\*\*)?\s+invite/i);

    if (!userMatch || !countMatch) continue;

    const userId = userMatch[1];
    const count = Number(countMatch[1]);

    if (!Number.isFinite(count)) continue;

    if (data.invites[userId] === undefined) {
      data.invites[userId] = count;
      changed = true;
    }
  }

  return changed;
}

function leaderboardMessageHasInviteCounts(message) {
  const description = message.embeds?.[0]?.description;
  if (!description) return false;

  return description
    .split('\n')
    .some(line =>
      /<@!?\d{17,20}>/.test(line) &&
      /(?:\*\*)?\d+(?:\*\*)?\s+invite/i.test(line)
    );
}

async function findExistingLeaderboardMessage(channel, preferWithInvites = false) {
  const messages = await channel.messages.fetch({ limit: 100 });
  const leaderboards = messages
    .filter(msg =>
      msg.author?.id === client.user.id &&
      msg.embeds?.some(msgEmbed => (msgEmbed.title || '').includes('Invite Leaderboard'))
    )
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp);

  if (preferWithInvites) {
    const messageWithInvites = leaderboards.find(leaderboardMessageHasInviteCounts);
    if (messageWithInvites) return messageWithInvites;
  }

  return leaderboards.first() || null;
}

async function updateLeaderboard() {
  try {
    const channel = client.channels.cache.get(LEADERBOARD_CHANNEL_ID);
    if (!channel) return;

    const data = loadData();
    let leaderboardMessage = null;
    const shouldPreferImportSource = Object.keys(data.invites || {}).length === 0;

    if (data.leaderboardMessageId) {
      try {
        leaderboardMessage = await channel.messages.fetch(data.leaderboardMessageId);
      } catch (e) {}
    }

    if (
      !leaderboardMessage ||
      (shouldPreferImportSource && !leaderboardMessageHasInviteCounts(leaderboardMessage))
    ) {
      const foundLeaderboardMessage = await findExistingLeaderboardMessage(channel, shouldPreferImportSource);
      if (foundLeaderboardMessage) {
        leaderboardMessage = foundLeaderboardMessage;
      }
    }

    if (leaderboardMessage && importInvitesFromLeaderboardMessage(data, leaderboardMessage)) {
      saveData(data);
    }

    const embed = buildLeaderboardEmbed(data);

    if (leaderboardMessage) {
      await leaderboardMessage.edit({ embeds: [embed] });
      data.leaderboardMessageId = leaderboardMessage.id;
      saveData(data);
      return leaderboardMessage;
    }

    leaderboardMessage = await channel.send({ embeds: [embed] });
    data.leaderboardMessageId = leaderboardMessage.id;
    saveData(data);
    return leaderboardMessage;
  } catch (e) {
    console.error('updateLeaderboard error:', e.message);
  }
}

// ── Stock ─────────────────────────────────────────────────────────
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

// ── Commands ──────────────────────────────────────────────────────
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
  const embed = new BrandEmbed()
    .setAuthor({ name: 'Restock' })
    .setTitle(item.name)
    .setDescription(`${item.emoji ? `${item.emoji} ` : ''}Wieder auf Lager – bestell über das Ticket-Panel.`)
    .addFields(
      { name: 'Preis', value: item.price || '—', inline: true },
      { name: 'Verfügbar', value: `${currentAmount}`, inline: true },
      { name: 'Neu', value: `+${addedAmount}`, inline: true }
    )
    .setTimestamp();

  const message = await channel.send({
    content: shouldMention && mention ? mention : options.content,
    embeds: [embed],
    allowedMentions: {
      roles: shouldMention && PING_ROLES.restocks ? [PING_ROLES.restocks] : []
    }
  }).catch(e => console.error('restock notify error:', e.message));

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

async function registerCommands(guildId) {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  const commands = buildCommandDefinitions();
  await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: commands });
  console.log(`✅ Commands registered for guild ${guildId}`);
}

// Alle Slash-Befehle (die eigenen + die aus src/commands)
function buildCommandDefinitions() {
  return [
    new SlashCommandBuilder()
      .setName('setupinviterewards')
      .setDescription('Send the invite rewards panel to this channel. Admin only.')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON(),

    new SlashCommandBuilder()
      .setName('setupleaderboard')
      .setDescription('Send the live leaderboard to this channel. Admin only.')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON(),

    new SlashCommandBuilder()
      .setName('setupstock')
      .setDescription('Send the public stock panel without buttons.')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON(),

    new SlashCommandBuilder()
      .setName('setupstockpanel')
      .setDescription('Send the staff stock panel with buttons.')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON(),

    new SlashCommandBuilder()
      .setName('setuptickets')
      .setDescription('Send the ticket panel.')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON(),

    new SlashCommandBuilder()
      .setName('setupverify')
      .setDescription('Send the verify panel.')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON(),

    new SlashCommandBuilder()
      .setName('setuproles')
      .setDescription('Send the ping roles panel.')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON(),

    new SlashCommandBuilder()
      .setName('say')
      .setDescription('Send a message as the bot.')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption(opt =>
        opt.setName('text')
          .setDescription('Message to send')
          .setRequired(true)
      )
      .toJSON(),

    new SlashCommandBuilder()
  .setName('website')
  .setDescription('Sendet den HugoSMP Market Website-Post.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .toJSON(),

    new SlashCommandBuilder()
      .setName('dashboard')
      .setDescription('Schickt dir den Bot-Dashboard-Link.')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON(),

    new SlashCommandBuilder()
      .setName('version')
      .setDescription('Zeigt, welche Bot-Version gerade läuft.')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON(),
    
    new SlashCommandBuilder()
      .setName('getorder')
      .setDescription('Sendet die Bestell-Anleitung.')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON(),

    new SlashCommandBuilder()
      .setName('embed')
      .setDescription('Send an embed as the bot.')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption(opt =>
        opt.setName('title')
          .setDescription('Embed title')
          .setRequired(true)
      )
      .addStringOption(opt =>
        opt.setName('text')
          .setDescription('Embed text')
          .setRequired(true)
      )
      .toJSON(),

    new SlashCommandBuilder()
      .setName('clear')
      .setDescription('Delete messages in this channel.')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .addIntegerOption(opt =>
        opt.setName('amount')
          .setDescription('Amount of messages to delete')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(100)
      )
      .toJSON(),

    new SlashCommandBuilder()
      .setName('inviterewards')
      .setDescription('Invite your friends to earn rewards!')
      .toJSON(),

    new SlashCommandBuilder()
      .setName('leaderboard')
      .setDescription('Show the top inviters!')
      .toJSON(),

    new SlashCommandBuilder()
      .setName('fertig')
      .setDescription('Bestellung als fertig markieren + Bewertung anfordern')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption(opt =>
        opt.setName('user')
          .setDescription('Der Käufer')
          .setRequired(true)
      )
      .toJSON(),

    new SlashCommandBuilder()
      .setName('adduser')
      .setDescription('Einen User zum aktuellen Ticket hinzufügen.')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption(opt =>
        opt.setName('user')
          .setDescription('Welcher User soll hinzugefügt werden?')
          .setRequired(true)
      )
      .toJSON(),

    new SlashCommandBuilder()
      .setName('close')
      .setDescription('Ticket schließen — aktuelles oder von einem bestimmten User.')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption(o => o.setName('user').setDescription('Ticket dieses Users schließen (optional)'))
      .toJSON(),


    new SlashCommandBuilder()
      .setName('setwelcome')
      .setDescription('Willkommensnachrichten konfigurieren')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addSubcommand(sub =>
        sub.setName('set')
          .setDescription('Willkommensnachricht einrichten')
          .addChannelOption(o => o.setName('channel').setDescription('Kanal für Willkommensnachrichten').setRequired(true))
          .addStringOption(o => o.setName('nachricht').setDescription('Nachricht. Nutze {user}, {server}, {count}').setRequired(true))
          .addStringOption(o => o.setName('farbe').setDescription('Embed-Farbe (Hex, z.B. #00ff00)'))
      )
      .addSubcommand(sub =>
        sub.setName('disable').setDescription('Willkommensnachrichten deaktivieren')
      )
      .addSubcommand(sub =>
        sub.setName('preview').setDescription('Vorschau der aktuellen Willkommensnachricht')
      )
      .addSubcommand(sub =>
        sub.setName('info').setDescription('Aktuelle Konfiguration anzeigen')
      )
      .toJSON(),

    new SlashCommandBuilder()
      .setName('setleave')
      .setDescription('Leave-Nachrichten konfigurieren')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addSubcommand(sub =>
        sub.setName('set')
          .setDescription('Leave-Nachricht einrichten')
          .addChannelOption(o => o.setName('channel').setDescription('Kanal für Leave-Nachrichten').setRequired(true))
          .addStringOption(o => o.setName('nachricht').setDescription('Nachricht. Nutze {user}, {server}, {count}').setRequired(true))
          .addStringOption(o => o.setName('farbe').setDescription('Embed-Farbe (Hex, z.B. #ff0000)'))
      )
      .addSubcommand(sub =>
        sub.setName('disable').setDescription('Leave-Nachrichten deaktivieren')
      )
      .addSubcommand(sub =>
        sub.setName('preview').setDescription('Vorschau der aktuellen Leave-Nachricht')
      )
      .addSubcommand(sub =>
        sub.setName('info').setDescription('Aktuelle Konfiguration anzeigen')
      )
      .toJSON(),

    new SlashCommandBuilder()
      .setName('stock')
      .setDescription('Stock-Panel Items verwalten')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addSubcommand(sub =>
        sub.setName('additem')
          .setDescription('Neues Item zum Stock-Panel hinzufügen')
          .addStringOption(o => o.setName('name').setDescription('Item-Name').setRequired(true))
          .addStringOption(o => o.setName('preis').setDescription('Preis z.B. 1,50 €').setRequired(true))
          .addStringOption(o => o.setName('emoji').setDescription('Emoji (Standard ✅ oder custom <:Name:ID>)').setRequired(true))
          .addIntegerOption(o => o.setName('menge').setDescription('Startmenge (Standard: 0)').setMinValue(0))
      )
      .addSubcommand(sub =>
        sub.setName('removeitem')
          .setDescription('Item aus dem Stock-Panel entfernen')
          .addStringOption(o => o.setName('id').setDescription('Item-ID (aus /stock listitems)').setRequired(true))
      )
      .addSubcommand(sub =>
        sub.setName('edititem')
          .setDescription('Bestehendes Item bearbeiten')
          .addStringOption(o => o.setName('id').setDescription('Item-ID (aus /stock listitems)').setRequired(true))
          .addStringOption(o => o.setName('name').setDescription('Neuer Name'))
          .addStringOption(o => o.setName('preis').setDescription('Neuer Preis'))
          .addStringOption(o => o.setName('emoji').setDescription('Neues Emoji'))
      )
      .addSubcommand(sub =>
        sub.setName('listitems').setDescription('Alle Stock-Items anzeigen')
      )
      .toJSON(),

    new SlashCommandBuilder()
      .setName('preview')
      .setDescription('Vorschauen ohne Ping testen')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addSubcommand(sub =>
        sub.setName('restock')
          .setDescription('Restock-Nachricht ohne Rollen-Ping testen')
          .addStringOption(o => o.setName('id').setDescription('Item-ID aus /stock listitems'))
          .addIntegerOption(o => o.setName('alt').setDescription('Alter Bestand').setMinValue(0))
          .addIntegerOption(o => o.setName('neu').setDescription('Neuer Bestand').setMinValue(1))
      )
      .toJSON(),

    new SlashCommandBuilder()
      .setName('warn')
      .setDescription('Einem User eine Verwarnung geben')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
      .addStringOption(o => o.setName('grund').setDescription('Grund der Verwarnung').setRequired(true))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('warnings')
      .setDescription('Verwarnungen eines Users anzeigen')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('clearwarnings')
      .setDescription('Alle Verwarnungen eines Users löschen')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('mute')
      .setDescription('Einen User timeouten (stummschalten)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
      .addStringOption(o => o.setName('dauer').setDescription('Dauer z.B. 10m, 1h, 1d (max 28d)').setRequired(true))
      .addStringOption(o => o.setName('grund').setDescription('Grund'))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('unmute')
      .setDescription('Timeout eines Users aufheben')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
      .addStringOption(o => o.setName('grund').setDescription('Grund'))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('kick')
      .setDescription('Einen User vom Server kicken')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
      .addStringOption(o => o.setName('grund').setDescription('Grund'))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('ban')
      .setDescription('Einen User bannen')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
      .addStringOption(o => o.setName('grund').setDescription('Grund'))
      .addStringOption(o => o.setName('dauer').setDescription('Dauer z.B. 1h, 7d (leer = permanent)'))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('unban')
      .setDescription('Einen User entbannen')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption(o => o.setName('user_id').setDescription('User-ID des gebannten Users').setRequired(true))
      .addStringOption(o => o.setName('grund').setDescription('Grund'))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('modlog')
      .setDescription('Alle Strafen eines Users anzeigen')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('botstatus')
      .setDescription('Bot-Status und Aktivität ändern.')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption(o =>
        o.setName('status')
          .setDescription('Online-Status')
          .setRequired(true)
          .addChoices(
            { name: 'Online', value: 'online' },
            { name: 'Abwesend', value: 'idle' },
            { name: 'Nicht stören', value: 'dnd' },
            { name: 'Offline anzeigen', value: 'offline' }
          )
      )
      .addStringOption(o =>
        o.setName('aktivität')
          .setDescription('Was Discord neben dem Bot anzeigen soll')
          .setRequired(true)
          .addChoices(
            { name: 'Spielt', value: 'Playing' },
            { name: 'Schaut', value: 'Watching' },
            { name: 'Hört', value: 'Listening' },
            { name: 'Streamt', value: 'Streaming' },
            { name: 'Tritt an', value: 'Competing' }
          )
      )
      .addStringOption(o =>
        o.setName('text')
          .setDescription('Text neben dem Status')
          .setRequired(true)
          .setMaxLength(128)
      )
      .addStringOption(o =>
        o.setName('url')
          .setDescription('Nur für Streaming: Twitch/YouTube URL')
      )
      .toJSON(),

    new SlashCommandBuilder()
      .setName('setinvites')
      .setDescription('Set invites manually. Admin only.')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption(opt =>
        opt.setName('user')
          .setDescription('User whose invites should be changed')
          .setRequired(true)
      )
      .addIntegerOption(opt =>
        opt.setName('amount')
          .setDescription('New invite amount')
          .setRequired(true)
          .setMinValue(0)
      )
      .toJSON(),

    new SlashCommandBuilder()
      .setName('giveaway')
      .setDescription('Giveaway verwalten')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addSubcommand(sub =>
        sub.setName('start').setDescription('Neues Giveaway starten')
          .addChannelOption(o => o.setName('channel').setDescription('Kanal').setRequired(true))
          .addStringOption(o => o.setName('preis').setDescription('Was wird verlost?').setRequired(true))
          .addStringOption(o => o.setName('dauer').setDescription('Dauer z.B. 1h, 30m, 7d').setRequired(true))
          .addIntegerOption(o => o.setName('gewinner').setDescription('Anzahl Gewinner').setMinValue(1).setMaxValue(20))
          .addIntegerOption(o => o.setName('min_invites').setDescription('Mindest-Invites zum Teilnehmen').setMinValue(0))
          .addIntegerOption(o => o.setName('min_age_tage').setDescription('Mindest-Kontoalter in Tagen').setMinValue(0))
      )
      .addSubcommand(sub =>
        sub.setName('end').setDescription('Giveaway vorzeitig beenden')
          .addStringOption(o => o.setName('message_id').setDescription('Message-ID des Giveaways').setRequired(true))
      )
      .addSubcommand(sub =>
        sub.setName('reroll').setDescription('Neuen Gewinner auslosen')
          .addStringOption(o => o.setName('message_id').setDescription('Message-ID des Giveaways').setRequired(true))
      )
      .addSubcommand(sub =>
        sub.setName('zinken').setDescription('Gewinner vorher festlegen (nur Admin)')
          .addStringOption(o => o.setName('message_id').setDescription('Message-ID des Giveaways').setRequired(true))
          .addUserOption(o => o.setName('user').setDescription('Dieser User gewinnt garantiert').setRequired(true))
      )
      .addSubcommand(sub =>
        sub.setName('list').setDescription('Alle Teilnehmer eines Giveaways anzeigen')
          .addStringOption(o => o.setName('message_id').setDescription('Message-ID des Giveaways').setRequired(true))
      )
      .addSubcommand(sub =>
        sub.setName('removeuser').setDescription('Einen User aus dem Giveaway entfernen')
          .addStringOption(o => o.setName('message_id').setDescription('Message-ID des Giveaways').setRequired(true))
          .addUserOption(o => o.setName('user').setDescription('Welcher User soll entfernt werden?').setRequired(true))
      )
      .toJSON(),

    ...coreCommands.definitions(),
    ...updateCommands.definitions(),
    ...structureCommands.definitions(),
    ...renameCommands.definitions()
  ];
}

// ── Panels ────────────────────────────────────────────────────────
function buildRolesPanel() {
  const embed = new BrandEmbed()
    .setTitle('Benachrichtigungen')
    .setDescription(
      'Wähle selbst, worüber du informiert werden möchtest.\n' +
      'Ein Klick fügt die Rolle hinzu, ein zweiter entfernt sie wieder.'
    )
    .addFields(
      { name: '🎉  Giveaways', value: 'Neue Verlosungen', inline: true },
      { name: '📦  Restocks', value: 'Items wieder auf Lager', inline: true },
      { name: '\u200b', value: '\u200b', inline: true },
      { name: '💰  Deals', value: 'Rabatte & Freebies', inline: true },
      { name: '📰  News', value: 'Ankündigungen', inline: true },
      { name: '\u200b', value: '\u200b', inline: true }
    );

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

function buildVerifyPanel(guild) {
  const embed = new BrandEmbed()
    .setTitle('Verifizierung')
    .setDescription(
      'Willkommen bei **HugoSMP Market**.\n' +
      'Bestätige kurz, dass du ein Mensch bist, um alle Kanäle freizuschalten.'
    )
    .addFields({ name: 'Kurs', value: '1M = 1,50 €', inline: true })
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
    .setDescription(
      'Wähle unten eine Kategorie – wir öffnen dir einen privaten Kanal mit dem Team.\n' +
      '-# Bitte pro Anliegen nur ein Ticket öffnen.'
    )
    .addFields(
      { name: '💰  Items & Geld', value: 'Ingame-Items und Geld kaufen', inline: true },
      { name: '📐  Schematics', value: 'Baupläne bestellen', inline: true },
      { name: '\u200b', value: '\u200b', inline: true },
      { name: '🎨  Resource Pack', value: 'Texture- und Resource-Packs', inline: true },
      { name: '🎫  Support', value: 'Fragen und Probleme', inline: true },
      { name: '\u200b', value: '\u200b', inline: true }
    );

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

// ── Panels automatisch erneuern ───────────────────────────────────
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

// ── Invite Rewards Panel ──────────────────────────────────────────
function buildPanel() {
  const embed = new BrandEmbed()
    .setTitle('Invite Rewards')
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

// ── Ready ─────────────────────────────────────────────────────────
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  setBrandIcon(client.user.displayAvatarURL({ size: 128 }));
  applyConfiguredPresence();

  for (const guild of client.guilds.cache.values()) {
    try {
      await registerCommands(guild.id);
      await cacheInvites(guild);
    } catch (e) {
      console.error(`Guild error (${guild.name}):`, e);
    }
  }

  await updateStockPanel();
  await updateLeaderboard();
  await refreshPostedPanels().catch(e => console.error('panel refresh error:', e.message));

  // Tempban expiry checker
  setInterval(async () => {
    const data = loadData();
    const now = Date.now();
    for (const [userId, ban] of Object.entries(data.tempbans)) {
      if (ban.expiresAt && now >= ban.expiresAt) {
        try {
          const guild = client.guilds.cache.get(ban.guildId);
          if (guild) {
            await guild.members.unban(userId, 'Tempban abgelaufen');
            await sendPunishLog(guild, {
              action: 'Tempban abgelaufen — Auto-Unban',
              color: 'success',
              target: { id: userId, tag: ban.userTag },
              moderator: client.user,
              reason: `Tempban von ${ban.duration} abgelaufen`
            });
          }
        } catch {}
        delete data.tempbans[userId];
        saveData(data);
      }
    }
  }, 30000);

  // Giveaway timer
  setInterval(async () => {
    const data = loadData();
    for (const [msgId, gw] of Object.entries(data.giveaways)) {
      if (!gw.ended && Date.now() >= gw.endTime) {
        await endGiveaway(msgId);
      }
    }
  }, 10000);
});

client.on('guildCreate', async guild => {
  try {
    await registerCommands(guild.id);
    await cacheInvites(guild);
  } catch (e) {
    console.error('guildCreate error:', e.message);
  }
});

client.on('inviteCreate', inv => {
  cachedInvites.set(inv.code, {
    inviterId: inv.inviter?.id ?? null,
    uses: inv.uses ?? 0
  });
});

client.on('inviteDelete', inv => {
  cachedInvites.delete(inv.code);
});

client.on('messageCreate', async message => {
  try {
    if (message.author?.bot) return;
    if (message.channel?.type !== ChannelType.DM) return;

    const saved = addDmThreadMessage({
      user: message.author,
      direction: 'in',
      content: message.content,
      discordMessageId: message.id,
      attachments: getMessageAttachments(message)
    });

    await notifyStaffAboutDm(saved);
  } catch (e) {
    console.error('dm messageCreate error:', e.message);
  }
});

// ── Member joins ──────────────────────────────────────────────────
client.on('guildMemberAdd', async member => {
  await coreCommands.applyAutoRoles(member);

  try {
    const accountAge = Date.now() - member.user.createdTimestamp;

    if (accountAge < MIN_ACCOUNT_AGE_MS) {
      console.log(`🚫 Alt blocked: ${member.user.tag}`);
      return;
    }

    if (hasBeenCounted(member.id)) {
      console.log(`🔁 Already counted: ${member.user.tag}`);
      return;
    }

    const newInvites = await member.guild.invites.fetch();

    let usedInviterId = null;
    let usedCode = null;

    newInvites.forEach(inv => {
      const cached = cachedInvites.get(inv.code);

      if (cached && inv.uses > cached.uses) {
        usedInviterId = cached.inviterId;
        usedCode = inv.code;
      }
    });

    newInvites.forEach(inv => {
      cachedInvites.set(inv.code, {
        inviterId: inv.inviter?.id ?? null,
        uses: inv.uses ?? 0
      });
    });

    if (usedInviterId === member.id) {
      console.log(`🚫 Self-invite blocked: ${member.user.tag}`);
      return;
    }

    if (usedInviterId) {
      setPending(member.id, usedInviterId);
      console.log(`📥 ${member.user.tag} joined via ${usedCode} — pending verify`);
    } else {
      console.log(`⚠️ No invite found for ${member.user.tag}`);
    }
    // Welcome message
    const data = loadData();
    const wc = data.welcomeConfig;
    if (wc.enabled && wc.channelId) {
      const wChannel = member.guild.channels.cache.get(wc.channelId);
      if (wChannel) {
        const inviterText = usedInviterId
          ? `\n-# Eingeladen von <@${usedInviterId}>`
          : '';
        const embed = buildWelcomeLeaveEmbed(
          (wc.message || 'Willkommen {user} auf **{server}**.') + inviterText,
          member,
          wc.color
        );
        await wChannel.send({ embeds: [embed] }).catch(() => {});
      }
    }

  } catch (e) {
    console.error('guildMemberAdd error:', e.message);
  }
});

// ── Leave message ────────────────────────────────────────────────────
client.on('guildMemberRemove', async member => {
  try {
    const data = loadData();
    const lc = data.leaveConfig;
    if (!lc.enabled || !lc.channelId) return;

    const lChannel = member.guild.channels.cache.get(lc.channelId);
    if (!lChannel) return;

    const embed = buildWelcomeLeaveEmbed(
      lc.message || '**{username}** hat den Server verlassen.',
      member,
      lc.color || 'neutral'
    );
    await lChannel.send({ embeds: [embed] }).catch(() => {});
  } catch (e) {
    console.error('guildMemberRemove error:', e.message);
  }
});

// ── Verify role gives invite count ────────────────────────────────────
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  try {
    const gotVerifyRole =
      !oldMember.roles.cache.has(VERIFY_ROLE_ID) &&
      newMember.roles.cache.has(VERIFY_ROLE_ID);

    if (!gotVerifyRole) return;

    const inviterId = getPending(newMember.id);
    if (!inviterId) return;

    markAsCounted(newMember.id);
    removePending(newMember.id);

    const total = addInvite(inviterId);

    console.log(`✅ ${newMember.user.tag} verified — invite counted for ${inviterId} (total: ${total})`);

    await updateLeaderboard();
  } catch (e) {
    console.error('guildMemberUpdate error:', e.message);
  }
});

// ── Interactions ──────────────────────────────────────────────────
const coreContext = {
  getInviteCount: userId => Number(loadData().invites?.[userId] || 0),
  getWarningCount: userId => getWarnings(userId).length,
  getWelcomeConfig: () => loadData().welcomeConfig || {},
  getLeaveConfig: () => loadData().leaveConfig || {},
  defaultModLogChannelId: PUNISH_LOG_CHANNEL_ID
};

// Kurze, private Statusmeldungen ("✅ …", "❌ …") automatisch im
// einheitlichen Embed-Stil senden statt als nackten Text.
function styleNotice(options, ephemeral) {
  if (!ephemeral) return options;
  if (typeof options === 'string') {
    const embed = noticeFromText(options);
    return embed ? { content: '', embeds: [embed] } : options;
  }
  if (!options || typeof options !== 'object' || options.embeds?.length) return options;
  const embed = noticeFromText(options.content);
  return embed ? { ...options, content: '', embeds: [embed] } : options;
}

// Discord gibt nur 3 Sekunden für die erste Antwort. Antwortet ein
// Handler nicht rechtzeitig (langsamer Server, viel Arbeit vorab), wird
// die Interaktion nach AUTO_DEFER_MS automatisch bestätigt und spätere
// reply()/update()-Aufrufe werden passend umgeleitet – so erscheint nie
// mehr "Die Anwendung reagiert nicht".
const AUTO_DEFER_MS = 2000;

function decorateInteraction(interaction) {
  if (!interaction.isRepliable()) return;

  const isEphemeral = options =>
    Boolean(options?.ephemeral) || (Number(options?.flags) & 64) === 64;

  const original = {
    reply: interaction.reply.bind(interaction),
    editReply: interaction.editReply.bind(interaction),
    followUp: interaction.followUp.bind(interaction),
    deferReply: interaction.deferReply.bind(interaction),
    deleteReply: interaction.deleteReply.bind(interaction),
    update: interaction.update?.bind(interaction),
    deferUpdate: interaction.deferUpdate?.bind(interaction),
    showModal: interaction.showModal?.bind(interaction)
  };

  let autoDeferred = null;
  const timer = setTimeout(() => {
    if (interaction.replied || interaction.deferred) return;
    // Immer als private "denkt nach"-Antwort – so kann ein späteres
    // editReply nie versehentlich ein Panel überschreiben.
    autoDeferred = original.deferReply({ ephemeral: true })
      .catch(e => console.error('auto defer error:', e.message));
  }, AUTO_DEFER_MS);
  const settle = () => clearTimeout(timer);

  interaction.reply = async options => {
    settle();
    if (!autoDeferred) return original.reply(styleNotice(options, isEphemeral(options)));

    await autoDeferred;
    const styled = styleNotice(options, isEphemeral(options));
    if (isEphemeral(options)) return original.editReply(styled);
    // Platzhalter war privat, Antwort soll öffentlich sein.
    const message = await original.followUp(styled);
    await original.deleteReply().catch(() => {});
    return message;
  };

  interaction.deferReply = async options => {
    settle();
    if (autoDeferred) return autoDeferred;
    return original.deferReply(options);
  };

  interaction.editReply = async options => {
    settle();
    if (autoDeferred) await autoDeferred;
    return original.editReply(styleNotice(options, interaction.ephemeral));
  };

  interaction.followUp = async options => {
    settle();
    if (autoDeferred) await autoDeferred;
    return original.followUp(styleNotice(options, isEphemeral(options)));
  };

  if (original.update) {
    interaction.update = async options => {
      settle();
      if (!autoDeferred) return original.update(options);
      await autoDeferred;
      // Ursprüngliche Nachricht bearbeiten, Platzhalter entfernen.
      try {
        const message = await interaction.message.edit(options);
        await original.deleteReply().catch(() => {});
        return message;
      } catch {
        return original.editReply(options);
      }
    };
  }

  if (original.deferUpdate) {
    interaction.deferUpdate = async options => {
      settle();
      if (autoDeferred) return autoDeferred;
      return original.deferUpdate(options);
    };
  }

  if (original.showModal) {
    interaction.showModal = async (...args) => {
      settle();
      return original.showModal(...args);
    };
  }
}

const renameContext = {
  ticketCategoryId: TICKET_CATEGORY_ID,
  closedTicketCategoryId: CLOSED_TICKET_CATEGORY_ID,
  pingRoles: PING_ROLES
};

async function replyWithError(interaction, error) {
  console.error(`interaction error (${interaction.commandName || interaction.customId || interaction.type}):`, error);
  if (!interaction.isRepliable()) return;

  const payload = {
    content: '❌ Da ist etwas schiefgelaufen. Bitte versuche es gleich noch einmal.',
    ephemeral: true
  };

  try {
    if (interaction.deferred && !interaction.replied) await interaction.editReply(payload);
    else if (interaction.replied) await interaction.followUp(payload);
    else await interaction.reply(payload);
  } catch {}
}

client.on('interactionCreate', async interaction => {
  decorateInteraction(interaction);

  try {
    if (interaction.isChatInputCommand() && await coreCommands.handleCommand(interaction, coreContext)) return;
    if (interaction.isChatInputCommand() && await updateCommands.handleCommand(interaction)) return;
    if (interaction.isChatInputCommand() && await structureCommands.handleCommand(interaction)) return;
    if (interaction.isChatInputCommand() && await renameCommands.handleCommand(interaction, renameContext)) return;
    if (interaction.isMessageComponent() && await renameCommands.handleComponent(interaction)) return;
    if (interaction.isMessageComponent() && await coreCommands.handleComponent(interaction)) return;

    await handleInteraction(interaction);
  } catch (error) {
    await replyWithError(interaction, error);
  }
});

// Gemeinsame Hilfsfunktionen und Werte für die Module in src/features und src/web
function buildCtx() {
  return {
    ActionRowBuilder,
    BOT_VERSION,
    BrandEmbed,
    ButtonBuilder,
    ButtonStyle,
    CLOSED_TICKET_CATEGORY_ID,
    ChannelType,
    DASHBOARD_PASSWORD,
    DASHBOARD_URL,
    DEFAULT_PRESENCE_CONFIG,
    GUILD_ID,
    KUNDEN_ROLE_ID,
    ModalBuilder,
    PING_ROLES,
    PermissionFlagsBits,
    REQUIRED_INVITES,
    REVIEWS_CHANNEL_ID,
    REWARD,
    REWARD_LOG_ID,
    RULES_CHANNEL_ID,
    SHOP_PANEL_CHANNEL_ID,
    STAFF_ROLE_IDS,
    STOCK_ITEMS,
    TICKET_CATEGORY_ID,
    TextInputBuilder,
    TextInputStyle,
    VERIFY_ROLE_ID,
    WEBSITE_URL,
    addDmThreadMessage,
    addWarning,
    applyConfiguredPresence,
    buildGiveawayEmbed,
    buildInvoiceFromDashboardInput,
    buildInvoiceFromOrderInput,
    buildLeaderboardEmbed,
    buildOrderStartRow,
    buildOrderTicketButtons,
    buildPanel,
    buildRolesPanel,
    buildSaleEmbed,
    buildShopPanelEmbed,
    buildStockButtons,
    buildStockEmbed,
    buildTicketPanel,
    buildTranscript,
    buildVerifyPanel,
    buildWebsitePanel,
    cachedInvites,
    cleanDmContent,
    cleanLongText,
    cleanShortText,
    cleanUsername,
    clearWarnings,
    client,
    closeTicket,
    cors,
    endGiveaway,
    express,
    getCachedDashboardUser,
    getDashboardChannel,
    getDashboardOrderDetails,
    getDashboardOrderList,
    getDashboardStaffMembers,
    getDashboardTextChannels,
    getDashboardTicketDetails,
    getDashboardTicketList,
    getDmUserInfo,
    getInvites,
    getLatestShopOffer,
    getMessageAttachments,
    getMutableStockItems,
    getNextOrderId,
    getNextTicketOrderId,
    getOrderDashboardMeta,
    getTicketDashboardMeta,
    getTicketOrderId,
    getTicketOwnerId,
    getTicketType,
    getUserAvatar,
    getUserDisplayName,
    getWarnings,
    hasOrderFormSubmitted,
    hasReviewDecision,
    hasReviewedOrder,
    isStaff,
    loadData,
    loadPresenceConfig,
    makeDashboardError,
    markOrderFormSubmitted,
    markReviewDecision,
    markReviewedOrder,
    normalizeDashboardAttachments,
    normalizePresenceStatus,
    normalizeStockEmoji,
    normalizeStockItemId,
    notice,
    notifyRestock,
    parseDuration,
    path,
    reopenTicket,
    resolveDashboardTextChannel,
    saveData,
    sendOrderInvoice,
    sendOrderReviewRequest,
    sendPunishLog,
    sendRestockPreview,
    serializeDashboardTicket,
    serializeDmThread,
    setInvites,
    tryDM,
    updateDashboardOrderMeta,
    updateLeaderboard,
    updateStockPanel,
  };
}

let features = null;
function getFeatures() {
  if (!features) {
    const ctx = buildCtx();
    features = ['giveaways', 'admin', 'roles', 'tickets', 'shop', 'invites', 'moderation', 'welcome']
      .map((name) => require(`./src/features/${name}`)(ctx));
  }
  return features;
}

async function handleInteraction(interaction) {
  // Jede Funktion des Bots liegt in src/features/<name>.js
  const feature = getFeatures().find((f) => {
    if (interaction.isChatInputCommand()) return f.commands?.includes(interaction.commandName);
    if (interaction.isButton()) return f.buttons?.some((r) => r.test(interaction.customId));
    if (interaction.isModalSubmit()) return f.modals?.some((r) => r.test(interaction.customId));
    return false;
  });
  if (!feature) return;
  if (interaction.isChatInputCommand()) return feature.command(interaction);
  if (interaction.isButton()) return feature.button(interaction);
  if (interaction.isModalSubmit()) return feature.modal(interaction);
}


function getCachedDashboardUser(userId) {
  const guild = client.guilds.cache.get(GUILD_ID);
  return guild?.members.cache.get(userId)?.user || client.users.cache.get(userId) || null;
}

// ── Website API ── (src/web/api.js)
const app = require('./src/web/api')(buildCtx());

// Selbsttest (npm test): Jeder eigene Befehl muss bei einem Modul ankommen.
if (process.env.HSB_SELFTEST) {
  const external = new Set([coreCommands, updateCommands, structureCommands, renameCommands].flatMap(m => m.definitions().map(d => d.name)));
  const handled = new Set(getFeatures().flatMap(f => f.commands || []));
  const missing = buildCommandDefinitions().map(d => d.name).filter(n => !external.has(n) && !handled.has(n));
  console.log(`SELFTEST features=${getFeatures().length} missing=${missing.join(',') || '-'}`);
}

// HOST=127.0.0.1 → nur noch über Caddy (HTTPS) erreichbar, nicht direkt über die IP
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`🌐 Website API läuft auf ${HOST}:${PORT} – Version ${BOT_VERSION}`);
  if (!DASHBOARD_URL) {
    console.warn('⚠️ DASHBOARD_URL ist nicht gesetzt – Dashboard-Links in Discord sind deaktiviert.');
  }
});

// Ein Fehler beim Discord-Login darf die Website nicht mitreißen.
process.on('unhandledRejection', err => {
  console.error('unhandled rejection:', err?.message || err);
});

client.on('error', err => {
  console.error('discord client error:', err?.message || err);
});

async function loginDiscord() {
  try {
    await client.login(TOKEN);
  } catch (e) {
    console.error(`discord login error: ${e.message} – neuer Versuch in 60s`);
    setTimeout(loginDiscord, 60 * 1000);
  }
}

loginDiscord();
