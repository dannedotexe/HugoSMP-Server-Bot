'use strict';

// Aus index.js ausgelagert.

const { CLOSED_TICKET_CATEGORY_ID, GUILD_ID, STAFF_ROLE_IDS, STOCK_ITEMS, TICKET_CATEGORY_ID, TICKET_LOG_CHANNEL_ID } = require('../config');
const { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const { BrandEmbed, notice } = require('../theme');
const { getNextOrderId, loadData, saveData } = require('../store');
const { cleanLongText, cleanShortText, formatEuroValue, parsePriceNumber } = require('../util');
const { client } = require('../client');
const { getUserAvatar, getUserDisplayName, getUserSummary } = require('./users');
const { getDmUserInfo, getMessageAttachments, makeDashboardError } = require('./dms');

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

module.exports = {
  closingTickets,
  isStaff,
  getTicketOwnerId,
  getTicketType,
  getTicketOrderId,
  buildTranscript,
  sendTicketLog,
  closeTicket,
  reopenTicket,
  isDashboardTicketChannel,
  getDashboardTicketChannels,
  getTicketOpenState,
  getTicketDashboardMeta,
  getOrderDashboardMeta,
  buildOrderTicketButtons,
  buildOrderStartRow,
  ticketUrl,
  serializeDashboardTicket,
  getDashboardTicketList,
  getTicketRecentMessages,
  getDashboardChannel,
  getDashboardTicketDetails,
  serializeDashboardOrder,
  getDashboardOrderList,
  getDashboardOrderDetails,
  updateDashboardOrderMeta,
  sendOrderReviewRequest,
  getDashboardStaffMembers,
  getDashboardTextChannels,
  resolveDashboardTextChannel,
  normalizeOrderItems,
  findStockItemByText,
  buildInvoiceFromOrderInput,
  buildInvoiceFromDashboardInput,
  invoiceItemsText,
  buildOrderInvoiceEmbed,
  sendOrderInvoice,
  extractOrderInvoiceDraft,
  ticketTypeLabelForInvoice,
};
