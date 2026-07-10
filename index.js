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

// ── Config ────────────────────────────────────────────────────────
const TOKEN = process.env.DISCORD_TOKEN;
const DATA_FILE = process.env.DATA_FILE || '/app/data/data.json';
const PORT = process.env.PORT || 3000;
const WEBSITE_URL = process.env.WEBSITE_URL || '*';
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || '';
const GUILD_ID = '1499129162378514524';

const REVIEWS_CHANNEL_ID = '1499131549826813962';
const KUNDEN_ROLE_ID = '1499472189420732421';

const REQUIRED_INVITES = 8;
const REWARD = '$1m on HugoSMP';

const RULES_CHANNEL_ID = '1499135456133255239';
const VERIFY_ROLE_ID = '1499149656951885956';
const REWARD_LOG_ID = '1500479671031169144';
const LEADERBOARD_CHANNEL_ID = '1499132426947919903';

const TICKET_CATEGORY_ID = '1499147835528974356';
const CLOSED_TICKET_CATEGORY_ID = '1499148006270963732';
const TICKET_LOG_CHANNEL_ID = '1499147413355626646';

const STOCK_CHANNEL_ID = '1502271613968846878';

const PUNISH_LOG_CHANNEL_ID = '1506807507564232714'; // ← Mod-Log Channel ID eintragen

const STAFF_ROLE_IDS = [
  '1499146219946250241',
  '1499159379902074880'
];

const PING_ROLES = {
  giveaways: '1501296933732618360',
  restocks: '1501297036719423700',
  deals: '1501297197113938100',
  news: '1501297279804641474'
};

const MIN_ACCOUNT_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// ── Stock items ───────────────────────────────────────────────────
const STOCK_ITEMS = [
  {
    id: 'money',
    name: '1M Money',
    emoji: '<:Money:1502281700774772908>',
    emojiId: '1502281700774772908',
    price: '1,50 €'
  },
  {
    id: 'elytra',
    name: 'Elytra',
    emoji: '<:Elytra:1502281765492883497>',
    emojiId: '1502281765492883497',
    price: '110 €'
  },
  {
    id: 'mace',
    name: 'Mace mit Windburst I',
    emoji: '<:Mace:1502281825131692163>',
    emojiId: '1502281825131692163',
    price: '1,50 €'
  },
  {
    id: 'deepslate',
    name: 'Deepslate Emerald Ore',
    emoji: '<:DeepslateEmeraldOre:1502281747667353610>',
    emojiId: '1502281747667353610',
    price: '0,70 €'
  },
  {
    id: 'ancient',
    name: 'Ancient Debris',
    emoji: '<:Ancient:1502281804780933293>',
    emojiId: '1502281804780933293',
    price: '0,08 €'
  },
  {
    id: 'gilded',
    name: 'Gilded Blackstone',
    emoji: '<:GildedBlackstone:1502281854051680469>',
    emojiId: '1502281854051680469',
    price: '0,04 €'
  },
  {
    id: 'skeleton_spawner',
    name: 'Skeleton Spawner',
    emoji: '<:SkeletonSpawner:1504552157053980793>',
    emojiId: '1504552157053980793',
    price: '6 €'
  },
];

// ── Data helpers ──────────────────────────────────────────────────
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

      data.invites = data.invites || {};
      data.counted = data.counted || [];
      data.pending = data.pending || {};

      data.leaderboardMessageId = data.leaderboardMessageId || null;

      data.stockMessageId = data.stockMessageId || null;
      data.stockButtonsMessageId = data.stockButtonsMessageId || null;
      data.stockChannelId = data.stockChannelId || STOCK_CHANNEL_ID;

      data.publicStockMessageId = data.publicStockMessageId || null;
      data.publicStockChannelId = data.publicStockChannelId || null;

      if (typeof data.nextOrderId !== 'number') data.nextOrderId = 1;
      if (typeof data.nextTicketOrderId !== 'number') data.nextTicketOrderId = 1;

      data.reviewedOrders = data.reviewedOrders || [];
      data.giveaways = data.giveaways || {};
      data.warnings = data.warnings || {};
      data.tempbans = data.tempbans || {};
      data.welcomeConfig = data.welcomeConfig || {};
      data.leaveConfig = data.leaveConfig || {};
      data.presence = data.presence || null;
      data.dmThreads = data.dmThreads || {};
      data.reviewTicketDecisions = data.reviewTicketDecisions || [];
      data.orderFormsSubmitted = data.orderFormsSubmitted || {};

      if (!data.stock) data.stock = {};

      // Migrate hardcoded STOCK_ITEMS into data.stockItems on first run
      if (!data.stockItems || data.stockItems.length === 0) {
        data.stockItems = JSON.parse(JSON.stringify(STOCK_ITEMS));
      }

      // Fix any items where emoji was stored as a raw ID number
      data.stockItems.forEach(item => {
        if (item.emoji && /^d{15,20}$/.test(item.emoji.trim())) {
          // Raw ID stored as emoji — build proper format
          item.emojiId = item.emoji.trim();
          item.emoji = `<:item:${item.emojiId}>`;
        } else if (item.emoji) {
          // Re-extract emojiId in case it got lost
          const m = item.emoji.match(/<a?:([^:]+):(d+)>/);
          if (m) item.emojiId = m[2];
        }
      });

      data.stockItems.forEach(item => {
        if (typeof data.stock[item.id] !== 'number') {
          data.stock[item.id] = 0;
        }
      });

      return data;
    }
  } catch (e) {
    console.error('loadData error:', e.message);
  }

  const initial = {
    invites: {},
    counted: [],
    pending: {},
    leaderboardMessageId: null,

    stockMessageId: null,
    stockButtonsMessageId: null,
    stockChannelId: STOCK_CHANNEL_ID,

    publicStockMessageId: null,
    publicStockChannelId: null,

    nextOrderId: 1,
    nextTicketOrderId: 1,

    reviewedOrders: [],
    reviewTicketDecisions: [],
    orderFormsSubmitted: {},
    giveaways: {},
    warnings: {},
    tempbans: {},
    welcomeConfig: {},
    leaveConfig: {},
    presence: null,
    dmThreads: {},

    stock: {},
    stockItems: JSON.parse(JSON.stringify(STOCK_ITEMS))
  };

  STOCK_ITEMS.forEach(item => {
    initial.stock[item.id] = 0;
  });

  return initial;
}

function saveData(data) {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('saveData error:', e.message);
  }
}

function getInvites(userId) {
  return loadData().invites[userId] ?? 0;
}

function setInvites(userId, amount) {
  const data = loadData();
  data.invites[userId] = Math.max(0, amount);
  saveData(data);
}

function addInvite(userId) {
  const data = loadData();
  data.invites[userId] = (data.invites[userId] ?? 0) + 1;
  saveData(data);
  return data.invites[userId];
}

function hasBeenCounted(memberId) {
  return loadData().counted?.includes(memberId) ?? false;
}

function markAsCounted(memberId) {
  const data = loadData();
  if (!data.counted) data.counted = [];
  if (!data.counted.includes(memberId)) data.counted.push(memberId);
  saveData(data);
}

function setPending(memberId, inviterId) {
  const data = loadData();
  if (!data.pending) data.pending = {};
  data.pending[memberId] = inviterId;
  saveData(data);
}

function getPending(memberId) {
  return loadData().pending?.[memberId] ?? null;
}

function removePending(memberId) {
  const data = loadData();
  if (data.pending) delete data.pending[memberId];
  saveData(data);
}

function getNextOrderId() {
  const data = loadData();
  const orderId = `#${String(data.nextOrderId).padStart(4, '0')}`;
  data.nextOrderId += 1;
  saveData(data);
  return orderId;
}

function getNextTicketOrderId() {
  const data = loadData();
  const orderId = String(data.nextTicketOrderId).padStart(4, '0');
  data.nextTicketOrderId += 1;
  saveData(data);
  return orderId;
}

function hasReviewedOrder(orderId) {
  return loadData().reviewedOrders.includes(orderId);
}

function markReviewedOrder(orderId) {
  const data = loadData();
  if (!data.reviewedOrders.includes(orderId)) {
    data.reviewedOrders.push(orderId);
  }
  saveData(data);
}

function hasReviewDecision(id) {
  return loadData().reviewTicketDecisions.includes(id);
}

function markReviewDecision(id) {
  const data = loadData();
  if (!data.reviewTicketDecisions.includes(id)) {
    data.reviewTicketDecisions.push(id);
  }
  saveData(data);
}

function hasOrderFormSubmitted(channelId) {
  return !!loadData().orderFormsSubmitted[channelId];
}

function markOrderFormSubmitted(channelId) {
  const data = loadData();
  data.orderFormsSubmitted[channelId] = true;
  saveData(data);
}

// ── Helpers ───────────────────────────────────────────────────────
const closingTickets = new Set();

function isStaff(member) {
  return STAFF_ROLE_IDS.some(roleId => member.roles.cache.has(roleId)) ||
    member.permissions.has(PermissionFlagsBits.Administrator);
}

function cleanUsername(username) {
  return username
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '')
    .slice(0, 80);
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

    const embed = new EmbedBuilder()
      .setColor('#b10de7')
      .setTitle('🔒 Ticket geschlossen')
      .setDescription(
        `**Ticket:** ${channel.name}\n` +
        `**Typ:** ${ticketType}\n` +
        `**Order:** ${ticketOrderId}\n` +
        `**Owner:** ${ownerId ? `<@${ownerId}>` : 'Unbekannt'}\n` +
        `**Geschlossen von:** <@${closedBy.id}>\n` +
        `**Grund:** ${reason}`
      )
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
        .setStyle(ButtonStyle.Success)
    );

    await channel.send({
      content: '🔒 Dieses Ticket wurde geschlossen. Staff kann es wieder öffnen.',
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
      content: `🔓 Ticket wieder geöffnet: <#${channel.id}> von <@${reopenedBy.id}>`
    }).catch(() => {});
  }

  await channel.send({
    content: `🔓 Ticket wurde von <@${reopenedBy.id}> wieder geöffnet.`
  }).catch(() => {});
}


// ── Giveaway helpers ──────────────────────────────────────────────
function parseDuration(str) {
  const match = str.match(/^(\d+)([smhd])$/i);
  if (!match) return null;
  const n = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const ms = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[unit];
  return n * ms;
}

function formatTimeLeft(ms) {
  if (ms <= 0) return 'Beendet';
  const d = Math.floor(ms / 86400000); ms %= 86400000;
  const h = Math.floor(ms / 3600000); ms %= 3600000;
  const m = Math.floor(ms / 60000); ms %= 60000;
  const s = Math.floor(ms / 1000);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s && !d) parts.push(`${s}s`);
  return parts.join(' ') || '< 1s';
}

function buildGiveawayEmbed(gw, ended = false) {
  const timeLeft = ended ? 'Beendet' : formatTimeLeft(gw.endTime - Date.now());
  const reqs = [];
  if (gw.minInvites > 0) reqs.push(`📨 Mindestens **${gw.minInvites}** Einladungen`);
  if (gw.minAccountAgeDays > 0) reqs.push(`🗓️ Account älter als **${gw.minAccountAgeDays}** Tage`);

  const embed = new EmbedBuilder()
    .setColor(ended ? '#888888' : '#b10de7')
    .setTitle(`🎉 GIVEAWAY — ${gw.prize}`)
    .setDescription(
      (reqs.length ? `**Voraussetzungen:**\n${reqs.join('\n')}\n\n` : '') +
      `**Gewinner:** ${gw.winnersCount}\n` +
      `**Teilnehmer:** ${gw.participants.length}\n` +
      `**Endet:** ${ended ? 'Beendet' : `<t:${Math.floor(gw.endTime / 1000)}:R>`}\n` +
      `**Veranstaltet von:** <@${gw.hostedBy}>` +
      (ended ? `\n\n${gw.winners?.length ? `🏆 **Gewinner:** ${gw.winners.map(w => `<@${w}>`).join(', ')}` : '❌ Keine gültigen Teilnehmer.'}` : '')
    )
    .setFooter({ text: ended ? `Beendet` : `Klicke 🎉 um teilzunehmen` })
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
        content: `🎉 Herzlichen Glückwunsch ${winners.map(w => `<@${w}>`).join(', ')}! Ihr habt **${gw.prize}** gewonnen!`
      });
    } else {
      await channel.send({ content: `❌ Das Giveaway für **${gw.prize}** hat geendet, aber es gab keine gültigen Teilnehmer.` });
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

  return new EmbedBuilder()
    .setColor(color || '#b10de7')
    .setDescription(text)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .setFooter({ text: member.guild.name, iconURL: member.guild.iconURL() })
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
  const logChannel = guild.channels.cache.get(PUNISH_LOG_CHANNEL_ID);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`🔨 ${action}`)
    .addFields(
      { name: '👤 User', value: `<@${target.id}> (${target.tag || target.id})`, inline: true },
      { name: '🛡️ Moderator', value: `<@${moderator.id}>`, inline: true },
      { name: '📝 Grund', value: reason || 'Kein Grund angegeben', inline: false }
    )
    .setTimestamp();

  if (duration) embed.addFields({ name: '⏱️ Dauer', value: duration, inline: true });
  if (extra) embed.addFields({ name: '📋 Info', value: extra, inline: false });

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
    lastMessageAt: null,
    messages: []
  };

  thread.userId = id;
  thread.username = getUserDisplayName(user, thread.username || id);
  thread.globalName = user?.globalName || thread.globalName || null;
  thread.avatarUrl = getUserAvatar(user) || thread.avatarUrl || null;
  thread.messages = Array.isArray(thread.messages) ? thread.messages : [];
  thread.unreadCount = Number(thread.unreadCount || 0);

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
    lastMessageAt: thread.lastMessageAt || lastMessage?.timestamp || null,
    lastMessage
  };

  if (includeMessages) {
    base.messages = messages;
  }

  return base;
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

  const medals = ['🥇', '🥈', '🥉'];

  const lines = sorted.length > 0
    ? sorted.map(([userId, count], i) =>
        `${medals[i] ?? `**${i + 1}.**`} <@${userId}> — **${count}** invite${count === 1 ? '' : 's'}`
      ).join('\n')
    : '*Noch keine Einladungen vorhanden.*';

  return new EmbedBuilder()
    .setColor('#b10de7')
    .setTitle('🏆 Invite Leaderboard')
    .setDescription(lines)
    .setFooter({ text: `Ziel: ${REQUIRED_INVITES} verifizierte Einladungen → ${REWARD}` })
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

    const status = amount === 0
      ? '🔴 Ausverkauft'
      : amount <= 5
        ? `🟡 ${amount} auf Lager`
        : `🟢 ${amount} auf Lager`;

    return `${item.emoji} **${item.name}** — ${item.price}\n┗ ${status}`;
  }).join('\n\n');

  return new EmbedBuilder()
    .setColor('#b10de7')
    .setTitle('🏪 Hugo Shop — Lagerbestand')
    .setDescription(lines)
    .setFooter({ text: 'Zuletzt aktualisiert' })
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
async function registerCommands(guildId) {
  const rest = new REST({ version: '10' }).setToken(TOKEN);

  const commands = [
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

  ];

  await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: commands });
  console.log(`✅ Commands registered for guild ${guildId}`);
}

// ── Invite Rewards Panel ──────────────────────────────────────────
function buildPanel() {
  const embed = new EmbedBuilder()
    .setColor('#b10de7')
    .setTitle('🎁 Invite Rewards')
    .setDescription(
      'Lade deine Freunde auf den Server ein und verdiene Belohnungen!\n\n' +
      `**Ziel:** ${REQUIRED_INVITES} Verifizierte Einladungen\n` +
      `**Belohnung:** ${REWARD}\n\n` +
      '⚠️ **WICHTIG:**\n' +
      'Nur Einladungen die über den Button unten generiert werden zählen!\n' +
      'Normale Discord Einladungslinks zählen **NICHT**.\n\n' +
      'Klicke unten auf die Buttons um deinen persönlichen Link zu erstellen oder deinen Fortschritt zu prüfen.'
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('gen_invite')
      .setLabel('Generate Invite Link')
      .setEmoji('🔗')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('check_inv')
      .setLabel('Check Invites')
      .setEmoji('📊')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('claim')
      .setLabel(`Claim ${REWARD}`)
      .setEmoji('💰')
      .setStyle(ButtonStyle.Success),
  );

  return {
    embeds: [embed],
    components: [row]
  };
}

// ── Ready ─────────────────────────────────────────────────────────
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
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
              color: '#00ff88',
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

    addDmThreadMessage({
      user: message.author,
      direction: 'in',
      content: message.content,
      discordMessageId: message.id,
      attachments: getMessageAttachments(message)
    });
  } catch (e) {
    console.error('dm messageCreate error:', e.message);
  }
});

// ── Member joins ──────────────────────────────────────────────────
client.on('guildMemberAdd', async member => {
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
          ? `\n👤 **Eingeladen von:** <@${usedInviterId}>`
          : '\n👤 **Eingeladen von:** Unbekannt';
        const embed = buildWelcomeLeaveEmbed(
          (wc.message || 'Willkommen {user} auf **{server}**! 🎉') + inviterText,
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
      lc.message || '**{username}** hat den Server verlassen. 👋',
      member,
      lc.color || '#ff4444'
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
client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {


    if (interaction.commandName === 'giveaway') {
      const sub = interaction.options.getSubcommand();

      if (sub === 'start') {
        const channel = interaction.options.getChannel('channel');
        const prize = interaction.options.getString('preis');
        const durStr = interaction.options.getString('dauer');
        const winnersCount = interaction.options.getInteger('gewinner') || 1;
        const minInvites = interaction.options.getInteger('min_invites') || 0;
        const minAccountAgeDays = interaction.options.getInteger('min_age_tage') || 0;

        const durMs = parseDuration(durStr);
        if (!durMs) {
          return interaction.reply({ content: '❌ Ungültige Dauer! Beispiele: `30m`, `1h`, `2h`, `7d`', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const endTime = Date.now() + durMs;
        const gw = {
          channelId: channel.id,
          guildId: interaction.guild.id,
          prize,
          endTime,
          winnersCount,
          minInvites,
          minAccountAgeDays,
          participants: [],
          ended: false,
          zinkedWinner: null,
          hostedBy: interaction.user.id,
          winners: []
        };

        const embed = buildGiveawayEmbed(gw, false);
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('giveaway_enter_PLACEHOLDER')
            .setLabel('Teilnehmen')
            .setEmoji('🎉')
            .setStyle(ButtonStyle.Primary)
        );

        const msg = await channel.send({ embeds: [embed], components: [row] });

        // Fix button with real message ID
        const realRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`giveaway_enter_${msg.id}`)
            .setLabel('Teilnehmen')
            .setEmoji('🎉')
            .setStyle(ButtonStyle.Primary)
        );
        await msg.edit({ embeds: [embed], components: [realRow] });

        const data = loadData();
        data.giveaways[msg.id] = gw;
        saveData(data);

        return interaction.editReply(`✅ Giveaway gestartet in <#${channel.id}>!`);
      }

      if (sub === 'end') {
        const msgId = interaction.options.getString('message_id');
        const data = loadData();
        if (!data.giveaways[msgId]) {
          return interaction.reply({ content: '❌ Giveaway nicht gefunden!', ephemeral: true });
        }
        if (data.giveaways[msgId].ended) {
          return interaction.reply({ content: '❌ Giveaway ist bereits beendet!', ephemeral: true });
        }
        await interaction.deferReply({ ephemeral: true });
        await endGiveaway(msgId);
        return interaction.editReply('✅ Giveaway wurde vorzeitig beendet!');
      }

      if (sub === 'reroll') {
        const msgId = interaction.options.getString('message_id');
        const data = loadData();
        const gw = data.giveaways[msgId];
        if (!gw || !gw.ended) {
          return interaction.reply({ content: '❌ Giveaway nicht gefunden oder noch nicht beendet!', ephemeral: true });
        }
        await interaction.deferReply({ ephemeral: true });

        const pool = gw.participants.filter(p => !gw.winners.includes(p));
        if (pool.length === 0) {
          return interaction.editReply('❌ Keine weiteren Teilnehmer für Reroll vorhanden!');
        }
        const newWinner = pool[Math.floor(Math.random() * pool.length)];
        gw.winners.push(newWinner);
        saveData(data);

        const channel = client.channels.cache.get(gw.channelId);
        if (channel) {
          await channel.send({ content: `🔁 **Reroll!** Neuer Gewinner: <@${newWinner}> — Herzlichen Glückwunsch! 🎉` });
        }
        return interaction.editReply(`✅ Neuer Gewinner: <@${newWinner}>`);
      }

      if (sub === 'zinken') {
        const msgId = interaction.options.getString('message_id');
        const user = interaction.options.getUser('user');
        const data = loadData();
        const gw = data.giveaways[msgId];
        if (!gw) {
          return interaction.reply({ content: '❌ Giveaway nicht gefunden!', ephemeral: true });
        }
        if (gw.ended) {
          return interaction.reply({ content: '❌ Giveaway ist bereits beendet!', ephemeral: true });
        }
        gw.zinkedWinner = user.id;
        saveData(data);
        return interaction.reply({ content: `🎰 Gezinkt! <@${user.id}> wird das Giveaway **${gw.prize}** gewinnen.`, ephemeral: true });
      }

      if (sub === 'list') {
        const msgId = interaction.options.getString('message_id');
        const data = loadData();
        const gw = data.giveaways[msgId];
        if (!gw) {
          return interaction.reply({ content: '❌ Giveaway nicht gefunden!', ephemeral: true });
        }

        if (gw.participants.length === 0) {
          return interaction.reply({ content: `📋 **${gw.prize}** — Noch keine Teilnehmer.`, ephemeral: true });
        }

        // Split into pages of 30 to avoid hitting embed limits
        const chunkSize = 30;
        const chunks = [];
        for (let i = 0; i < gw.participants.length; i += chunkSize) {
          chunks.push(gw.participants.slice(i, i + chunkSize));
        }

        const embed = new EmbedBuilder()
          .setColor('#b10de7')
          .setTitle(`🎉 Teilnehmer — ${gw.prize}`)
          .setDescription(
            chunks[0].map((id, i) => `**${i + 1}.** <@${id}>`).join('\n')
          )
          .setFooter({ text: `${gw.participants.length} Teilnehmer gesamt${gw.zinkedWinner ? ` • 🎰 Gezinkt: ${gw.zinkedWinner}` : ''}` });

        if (chunks.length > 1) {
          embed.addFields(
            ...chunks.slice(1).map((chunk, ci) => ({
              name: '​',
              value: chunk.map((id, i) => `**${ci * chunkSize + 30 + i + 1}.** <@${id}>`).join('\n'),
              inline: false
            }))
          );
        }

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (sub === 'removeuser') {
        const msgId = interaction.options.getString('message_id');
        const user = interaction.options.getUser('user');
        const data = loadData();
        const gw = data.giveaways[msgId];
        if (!gw) {
          return interaction.reply({ content: '❌ Giveaway nicht gefunden!', ephemeral: true });
        }
        if (gw.ended) {
          return interaction.reply({ content: '❌ Giveaway ist bereits beendet!', ephemeral: true });
        }

        if (!gw.participants.includes(user.id)) {
          return interaction.reply({ content: `❌ <@${user.id}> ist gar nicht im Giveaway!`, ephemeral: true });
        }

        gw.participants = gw.participants.filter(p => p !== user.id);

        // Also remove zinken if it was this user
        if (gw.zinkedWinner === user.id) {
          gw.zinkedWinner = null;
        }

        saveData(data);

        // Update the giveaway embed with new count
        try {
          const ch = client.channels.cache.get(gw.channelId);
          if (ch) {
            const msg = await ch.messages.fetch(msgId).catch(() => null);
            if (msg) await msg.edit({ embeds: [buildGiveawayEmbed(gw, false)] });
          }
        } catch {}

        return interaction.reply({
          content: `✅ <@${user.id}> wurde aus dem Giveaway **${gw.prize}** entfernt. (Noch ${gw.participants.length} Teilnehmer)`,
          ephemeral: true
        });
      }
    }

    if (interaction.commandName === 'website') {
  const embed = new EmbedBuilder()
    .setColor('#9B30FF')
    .setTitle('🌐 HugoSMP Market ist online!')
    .setDescription(
      'Bestelle HugoSMP Geld, Items, Kits und mehr direkt über unsere Website.\n\n' +
      '✅ Schnell & einfach bestellen\n' +
      '✅ Discord Login\n' +
      '✅ Sichere Bestellnummer\n' +
      '✅ Support per Ticket\n\n' +
      '🎟️ Bei Fragen öffnet ein Ticket in <#1499132947041751181>'
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('🌐 Website öffnen')
      .setStyle(ButtonStyle.Link)
      .setURL('https://hugosmpmarket.store')
  );

  await interaction.channel.send({
    embeds: [embed],
    components: [row]
  });

  return interaction.reply({
    content: '✅ Website-Post gesendet!',
    ephemeral: true
  });
}
    
    if (interaction.commandName === 'say') {
      const text = interaction.options.getString('text');

      await interaction.channel.send(text);

      return interaction.reply({
        content: '✅ Nachricht gesendet!',
        ephemeral: true
      });
    }

    if (interaction.commandName === 'getorder') {
      const embed = new EmbedBuilder()
        .setColor('#b10de7')
        .setTitle('✨ — DEINE BESTELLUNG ERHALTEN — ✨')
        .setDescription(
          '**SOBALD GEZAHLT WURDE** 💸\n' +
          '↓\n\n' +
          '🧮 **KURZRECHNUNG:**\n' +
          'Bestellung (z.B: 5 Mio) ÷ Ancient-Wert (z.B. 40k) = Menge (125 Stück)\n\n' +
          '🛠️ **DEINE AUFGABE:**\n' +
          '↳ Order Ingame erstellen (Menge laut Rechnung)\n' +
          '↳ Preis pro Stück: 1$\n' +
          '↳ Steuern: Sind so gut wie keine Vorhanden!\n\n' +
          '*Das ganze Ancient machst du dann in die höchste Order rein und\n' +
          'somit hast du dein gekauftes Geld!*'
        );

      await interaction.channel.send({
        embeds: [embed]
      });

      return interaction.reply({
        content: '✅ Bestell-Anleitung gesendet!',
        ephemeral: true
      });
    }

    if (interaction.commandName === 'embed') {
      const title = interaction.options.getString('title');
      const text = interaction.options.getString('text');

      const embed = new EmbedBuilder()
        .setColor('#b10de7')
        .setTitle(title)
        .setDescription(text)
        .setTimestamp();

      await interaction.channel.send({
        embeds: [embed]
      });

      return interaction.reply({
        content: '✅ Embed gesendet!',
        ephemeral: true
      });
    }

    if (interaction.commandName === 'clear') {
      const amount = interaction.options.getInteger('amount');

      try {
        const deleted = await interaction.channel.bulkDelete(amount, true);

        return interaction.reply({
          content: `✅ ${deleted.size} Nachrichten gelöscht.`,
          ephemeral: true
        });
      } catch (e) {
        console.error('clear error:', e);

        return interaction.reply({
          content: '❌ Fehler beim Löschen. Nachrichten dürfen nicht älter als 14 Tage sein.',
          ephemeral: true
        });
      }
    }

    if (interaction.commandName === 'setuproles') {
      const embed = new EmbedBuilder()
        .setColor('#b10de7')
        .setDescription(
          '**Reagiert mit dem Emoji auf diese Nachricht, von dessen Kategorie ihr zukünftig gepingt werden möchtet:**\n\n' +
          '🎉 = Giveaways\n\n' +
          '📦 = Item Restocks\n\n' +
          '💰 = Deals, Rabatte & Freebies\n\n' +
          '📰 = News & Ankündigungen'
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('role_giveaways')
          .setLabel('Giveaways')
          .setEmoji('🎉')
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId('role_restocks')
          .setLabel('Item Restocks')
          .setEmoji('📦')
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId('role_deals')
          .setLabel('Deals')
          .setEmoji('💰')
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId('role_news')
          .setLabel('News')
          .setEmoji('📰')
          .setStyle(ButtonStyle.Primary)
      );

      await interaction.channel.send({
        embeds: [embed],
        components: [row]
      });

      return interaction.reply({
        content: '✅ Rollen-Panel gesendet!',
        ephemeral: true
      });
    }

    if (interaction.commandName === 'setupverify') {
      const embed = new EmbedBuilder()
        .setColor('#b10de7')
        .setTitle('Captcha Verification')
        .setDescription(
          'Press to Verify\n⬇️\n\n' +
          '**1M = 1.5€ | HugoSMP Market • Verification**'
        )
        .setThumbnail('https://cdn.discordapp.com/attachments/1499135826624249996/1501579033291522299/Hugo_SMP_Shop_Icon.jpg');

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('verify_member')
          .setLabel('Verify')
          .setEmoji('✅')
          .setStyle(ButtonStyle.Primary)
      );

      await interaction.channel.send({
        embeds: [embed],
        components: [row]
      });

      return interaction.reply({
        content: '✅ Verify Panel gesendet!',
        ephemeral: true
      });
    }

    if (interaction.commandName === 'setuptickets') {
      const embed = new EmbedBuilder()
        .setColor('#b10de7')
        .setTitle('Ticket System')
        .setDescription(
          '**Create Ticket**\n\n' +
          '⬇️ Wähle eine Kategorie um ein Ticket zu öffnen.'
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_cat_items_geld')
          .setLabel('Items & Geld')
          .setEmoji('💰')
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId('ticket_cat_schematics')
          .setLabel('Schematics')
          .setEmoji('📐')
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId('ticket_cat_resource_pack')
          .setLabel('Resource Pack')
          .setEmoji('🎨')
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId('create_support_ticket')
          .setLabel('Support')
          .setEmoji('🎫')
          .setStyle(ButtonStyle.Primary)
      );

      await interaction.channel.send({
        embeds: [embed],
        components: [row]
      });

      return interaction.reply({
        content: '✅ Ticket Panel gesendet!',
        ephemeral: true
      });
    }

    if (interaction.commandName === 'setupinviterewards') {
      await interaction.deferReply({ ephemeral: true });

      try {
        await interaction.channel.send(buildPanel());

        return interaction.editReply('✅ Invite Rewards panel sent!');
      } catch (e) {
        return interaction.editReply('❌ Could not send panel.');
      }
    }

    if (interaction.commandName === 'setupleaderboard') {
      await interaction.deferReply({ ephemeral: true });

      try {
        await updateLeaderboard();

        return interaction.editReply('✅ Live Leaderboard aktualisiert!');
      } catch (e) {
        return interaction.editReply('❌ Fehler.');
      }
    }

    if (interaction.commandName === 'setupstock') {
      await interaction.deferReply({ ephemeral: true });

      try {
        const msg = await interaction.channel.send({
          embeds: [buildStockEmbed()]
        });

        const data = loadData();
        data.publicStockMessageId = msg.id;
        data.publicStockChannelId = interaction.channel.id;
        saveData(data);

        return interaction.deleteReply();
      } catch (e) {
        console.error('setupstock error:', e);

        return interaction.editReply({
          content: '❌ Fehler beim Senden des Stock Panels.'
        });
      }
    }

    if (interaction.commandName === 'setupstockpanel') {
      await interaction.deferReply({ ephemeral: true });

      try {
        const rows = buildStockButtons();

        const msg = await interaction.channel.send({
          embeds: [buildStockEmbed()],
          components: rows.slice(0, 5)
        });

        let buttonsMsg = null;

        if (rows.length > 5) {
          buttonsMsg = await interaction.channel.send({
            content: '‎',
            components: rows.slice(5)
          });
        }

        const data = loadData();

        data.stockMessageId = msg.id;
        data.stockButtonsMessageId = buttonsMsg ? buttonsMsg.id : null;
        data.stockChannelId = interaction.channel.id;

        saveData(data);

        return interaction.deleteReply();
      } catch (e) {
        console.error('setupstockpanel error:', e);

        return interaction.editReply({
          content: '❌ Fehler beim Senden des Staff Stock Panels.'
        });
      }
    }

    if (interaction.commandName === 'inviterewards') {
      return interaction.reply(buildPanel());
    }

    if (interaction.commandName === 'leaderboard') {
      await interaction.deferReply();

      return interaction.editReply({
        embeds: [buildLeaderboardEmbed()]
      });
    }

    if (interaction.commandName === 'adduser') {
      const user = interaction.options.getUser('user');
      const channel = interaction.channel;

      // Check it's a ticket channel
      const ownerId = getTicketOwnerId(channel);
      if (!ownerId) {
        return interaction.reply({
          content: '❌ Dieser Befehl kann nur in einem Ticket-Channel verwendet werden.',
          ephemeral: true
        });
      }

      try {
        await channel.permissionOverwrites.edit(user.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true
        });

        await channel.send({
          content: `✅ <@${user.id}> wurde von <@${interaction.user.id}> zum Ticket hinzugefügt.`
        });

        return interaction.reply({
          content: `✅ <@${user.id}> wurde zum Ticket hinzugefügt!`,
          ephemeral: true
        });
      } catch (e) {
        console.error('adduser error:', e);
        return interaction.reply({
          content: '❌ Fehler beim Hinzufügen des Users. Prüfe die Bot-Rechte.',
          ephemeral: true
        });
      }
    }

    if (interaction.commandName === 'adduser') {
      const user = interaction.options.getUser('user');
      const channel = interaction.channel;
      const ownerId = getTicketOwnerId(channel);

      if (!ownerId) {
        return interaction.reply({
          content: '❌ Dieser Befehl kann nur in einem Ticket-Channel verwendet werden.',
          ephemeral: true
        });
      }

      try {
        await channel.permissionOverwrites.edit(user.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true
        });

        await channel.send({
          content: `✅ <@${user.id}> wurde von <@${interaction.user.id}> zum Ticket hinzugefügt.`
        });

        return interaction.reply({
          content: `✅ <@${user.id}> wurde zum Ticket hinzugefügt!`,
          ephemeral: true
        });
      } catch (e) {
        console.error('adduser error:', e);
        return interaction.reply({
          content: '❌ Fehler beim Hinzufügen des Users. Prüfe die Bot-Rechte.',
          ephemeral: true
        });
      }
    }

    if (interaction.commandName === 'close') {
      const targetUser = interaction.options.getUser('user');

      if (targetUser) {
        // Find the ticket channel of that user
        const ticketChannel = interaction.guild.channels.cache.find(c => {
          const owner = getTicketOwnerId(c);
          return owner === targetUser.id && !c.name.startsWith('closed-');
        });

        if (!ticketChannel) {
          return interaction.reply({
            content: `❌ Kein offenes Ticket für <@${targetUser.id}> gefunden.`,
            ephemeral: true
          });
        }

        await interaction.reply({
          content: `🔒 Ticket von <@${targetUser.id}> wird geschlossen...`,
          ephemeral: true
        });

        await closeTicket(ticketChannel, interaction.user, `Von ${interaction.user.tag} per /close geschlossen`);
        return;
      }

      // No user specified — close current channel
      const channel = interaction.channel;
      const ownerId = getTicketOwnerId(channel);

      if (!ownerId) {
        return interaction.reply({
          content: '❌ Dieser Befehl kann nur in einem Ticket-Channel verwendet werden (oder gib einen User an).',
          ephemeral: true
        });
      }

      if (channel.parentId === CLOSED_TICKET_CATEGORY_ID || channel.name.startsWith('closed-')) {
        return interaction.reply({
          content: '❌ Dieses Ticket ist bereits geschlossen.',
          ephemeral: true
        });
      }

      await interaction.reply({
        content: '🔒 Ticket wird geschlossen...',
        ephemeral: true
      });

      await closeTicket(channel, interaction.user, `Von ${interaction.user.tag} per /close geschlossen`);
      return;
    }



    // ── /stock ─────────────────────────────────────────────────────────
    if (interaction.commandName === 'stock') {
      const sub = interaction.options.getSubcommand();
      const data = loadData();
      if (!data.stockItems) data.stockItems = JSON.parse(JSON.stringify(STOCK_ITEMS));

      if (sub === 'listitems') {
        if (data.stockItems.length === 0) {
          return interaction.reply({ content: '📭 Keine Items im Stock-Panel.', ephemeral: true });
        }
        const list = data.stockItems.map((item, i) =>
          `**${i + 1}.** ${item.emoji} **${item.name}** — ${item.price}\n└ ID: \`${item.id}\` | Lager: ${data.stock[item.id] ?? 0}`
        ).join('\n\n');

        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor('#b10de7')
            .setTitle('📦 Stock-Items')
            .setDescription(list)],
          ephemeral: true
        });
      }

      if (sub === 'additem') {
        const name   = interaction.options.getString('name');
        const preis  = interaction.options.getString('preis');
        const emoji  = interaction.options.getString('emoji');
        const menge  = interaction.options.getInteger('menge') ?? 0;

        // Generate ID from name
        const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').slice(0, 30);

        if (data.stockItems.find(i => i.id === id)) {
          return interaction.reply({ content: `❌ Ein Item mit der ID \`${id}\` existiert bereits! Nutze einen anderen Namen.`, ephemeral: true });
        }

        // Normalize emoji input — support <:Name:ID>, raw ID number, or standard emoji
        let finalEmoji = emoji.trim();
        let emojiId = null;

        const customMatch = finalEmoji.match(/<a?:([^:]+):(d+)>/);
        const rawIdMatch  = finalEmoji.match(/^(d{15,20})$/);
        const colonMatch  = finalEmoji.match(/:([^:]+):(d+)/);

        if (customMatch) {
          emojiId = customMatch[2];
        } else if (rawIdMatch) {
          emojiId = rawIdMatch[1];
          finalEmoji = `<:item:${emojiId}>`;
        } else if (colonMatch) {
          emojiId = colonMatch[2];
          finalEmoji = `<:${colonMatch[1]}:${emojiId}>`;
        }

        const newItem = { id, name, emoji: finalEmoji, emojiId, price: preis };
        data.stockItems.push(newItem);
        data.stock[id] = menge;
        saveData(data);
        await updateStockPanel();

        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor('#00ff88')
            .setTitle('✅ Item hinzugefügt')
            .addFields(
              { name: '📦 Name', value: name, inline: true },
              { name: '💰 Preis', value: preis, inline: true },
              { name: '🔢 Startmenge', value: `${menge}`, inline: true },
              { name: '🆔 ID', value: `\`${id}\``, inline: true },
              { name: '😀 Emoji', value: emoji, inline: true }
            )],
          ephemeral: true
        });
      }

      if (sub === 'removeitem') {
        const id = interaction.options.getString('id');
        const idx = data.stockItems.findIndex(i => i.id === id);

        if (idx === -1) {
          return interaction.reply({ content: `❌ Kein Item mit ID \`${id}\` gefunden. Nutze \`/stock listitems\` für alle IDs.`, ephemeral: true });
        }

        const removed = data.stockItems.splice(idx, 1)[0];
        delete data.stock[id];
        saveData(data);
        await updateStockPanel();

        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor('#ff4444')
            .setDescription(`✅ **${removed.name}** wurde aus dem Stock-Panel entfernt.`)],
          ephemeral: true
        });
      }

      if (sub === 'edititem') {
        const id    = interaction.options.getString('id');
        const name  = interaction.options.getString('name');
        const preis = interaction.options.getString('preis');
        const emoji = interaction.options.getString('emoji');

        const item = data.stockItems.find(i => i.id === id);
        if (!item) {
          return interaction.reply({ content: `❌ Kein Item mit ID \`${id}\` gefunden. Nutze \`/stock listitems\` für alle IDs.`, ephemeral: true });
        }

        if (name)  item.name  = name;
        if (preis) item.price = preis;
        if (emoji) {
          item.emoji = emoji;
          const editMatch = emoji.match(/<a?:([^:]+):(d+)>/);
          const editRaw = emoji.match(/^(d{15,20})$/);
          if (editMatch) {
            item.emojiId = editMatch[2];
          } else if (editRaw) {
            item.emojiId = editRaw[1];
            item.emoji = `<:item:${item.emojiId}>`;
          }
        }

        saveData(data);
        await updateStockPanel();

        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor('#b10de7')
            .setTitle('✅ Item aktualisiert')
            .addFields(
              { name: '📦 Name', value: item.name, inline: true },
              { name: '💰 Preis', value: item.price, inline: true },
              { name: '😀 Emoji', value: item.emoji, inline: true },
              { name: '🆔 ID', value: `\`${item.id}\``, inline: true }
            )],
          ephemeral: true
        });
      }
    }

    // ── /warn ──────────────────────────────────────────────────────

    // ── /setwelcome ────────────────────────────────────────────────
    if (interaction.commandName === 'setwelcome') {
      const sub = interaction.options.getSubcommand();
      const data = loadData();

      if (sub === 'set') {
        const channel = interaction.options.getChannel('channel');
        const nachricht = interaction.options.getString('nachricht');
        const farbe = interaction.options.getString('farbe') || '#b10de7';

        data.welcomeConfig = { enabled: true, channelId: channel.id, message: nachricht, color: farbe };
        saveData(data);

        const previewEmbed = new EmbedBuilder()
          .setColor(farbe)
          .setTitle('✅ Willkommensnachricht gespeichert')
          .addFields(
            { name: '📢 Kanal', value: `<#${channel.id}>`, inline: true },
            { name: '🎨 Farbe', value: farbe, inline: true },
            { name: '📝 Nachricht', value: nachricht }
          )
          .setFooter({ text: 'Platzhalter: {user} {username} {server} {count}' });

        return interaction.reply({ embeds: [previewEmbed], ephemeral: true });
      }

      if (sub === 'disable') {
        data.welcomeConfig = { enabled: false };
        saveData(data);
        return interaction.reply({ content: '✅ Willkommensnachrichten **deaktiviert**.', ephemeral: true });
      }

      if (sub === 'preview') {
        const wc = data.welcomeConfig;
        if (!wc?.enabled) return interaction.reply({ content: '❌ Willkommensnachrichten sind nicht eingerichtet.', ephemeral: true });

        const fakeEmbed = new EmbedBuilder()
          .setColor(wc.color || '#b10de7')
          .setDescription(
            (wc.message || 'Willkommen {user} auf **{server}**! 🎉')
              .replace(/{user}/g, `<@${interaction.user.id}>`)
              .replace(/{username}/g, interaction.user.username)
              .replace(/{server}/g, interaction.guild.name)
              .replace(/{count}/g, interaction.guild.memberCount.toString())
          )
          .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
          .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() })
          .setTimestamp();

        return interaction.reply({ content: '👀 **Vorschau:**', embeds: [fakeEmbed], ephemeral: true });
      }

      if (sub === 'info') {
        const wc = data.welcomeConfig;
        if (!wc?.enabled) return interaction.reply({ content: '❌ Willkommensnachrichten sind nicht eingerichtet.', ephemeral: true });

        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(wc.color || '#b10de7')
            .setTitle('📋 Willkommens-Konfiguration')
            .addFields(
              { name: '📢 Kanal', value: `<#${wc.channelId}>`, inline: true },
              { name: '🎨 Farbe', value: wc.color || '#b10de7', inline: true },
              { name: '📝 Nachricht', value: wc.message || '(Standard)' }
            )
            .setFooter({ text: 'Platzhalter: {user} {username} {server} {count}' })],
          ephemeral: true
        });
      }
    }

    // ── /setleave ──────────────────────────────────────────────────
    if (interaction.commandName === 'setleave') {
      const sub = interaction.options.getSubcommand();
      const data = loadData();

      if (sub === 'set') {
        const channel = interaction.options.getChannel('channel');
        const nachricht = interaction.options.getString('nachricht');
        const farbe = interaction.options.getString('farbe') || '#ff4444';

        data.leaveConfig = { enabled: true, channelId: channel.id, message: nachricht, color: farbe };
        saveData(data);

        const previewEmbed = new EmbedBuilder()
          .setColor(farbe)
          .setTitle('✅ Leave-Nachricht gespeichert')
          .addFields(
            { name: '📢 Kanal', value: `<#${channel.id}>`, inline: true },
            { name: '🎨 Farbe', value: farbe, inline: true },
            { name: '📝 Nachricht', value: nachricht }
          )
          .setFooter({ text: 'Platzhalter: {user} {username} {server} {count}' });

        return interaction.reply({ embeds: [previewEmbed], ephemeral: true });
      }

      if (sub === 'disable') {
        data.leaveConfig = { enabled: false };
        saveData(data);
        return interaction.reply({ content: '✅ Leave-Nachrichten **deaktiviert**.', ephemeral: true });
      }

      if (sub === 'preview') {
        const lc = data.leaveConfig;
        if (!lc?.enabled) return interaction.reply({ content: '❌ Leave-Nachrichten sind nicht eingerichtet.', ephemeral: true });

        const fakeEmbed = new EmbedBuilder()
          .setColor(lc.color || '#ff4444')
          .setDescription(
            (lc.message || '**{username}** hat den Server verlassen. 👋')
              .replace(/{user}/g, `<@${interaction.user.id}>`)
              .replace(/{username}/g, interaction.user.username)
              .replace(/{server}/g, interaction.guild.name)
              .replace(/{count}/g, interaction.guild.memberCount.toString())
          )
          .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
          .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() })
          .setTimestamp();

        return interaction.reply({ content: '👀 **Vorschau:**', embeds: [fakeEmbed], ephemeral: true });
      }

      if (sub === 'info') {
        const lc = data.leaveConfig;
        if (!lc?.enabled) return interaction.reply({ content: '❌ Leave-Nachrichten sind nicht eingerichtet.', ephemeral: true });

        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(lc.color || '#ff4444')
            .setTitle('📋 Leave-Konfiguration')
            .addFields(
              { name: '📢 Kanal', value: `<#${lc.channelId}>`, inline: true },
              { name: '🎨 Farbe', value: lc.color || '#ff4444', inline: true },
              { name: '📝 Nachricht', value: lc.message || '(Standard)' }
            )
            .setFooter({ text: 'Platzhalter: {user} {username} {server} {count}' })],
          ephemeral: true
        });
      }
    }

    if (interaction.commandName === 'warn') {
      const target = interaction.options.getUser('user');
      const grund = interaction.options.getString('grund');
      const member = await interaction.guild.members.fetch(target.id).catch(() => null);

      if (!member) return interaction.reply({ content: '❌ User nicht auf dem Server gefunden.', ephemeral: true });

      const warnCount = addWarning(target.id, interaction.user.id, grund);

      const dmEmbed = new EmbedBuilder()
        .setColor('#ffaa00')
        .setTitle('⚠️ Du wurdest verwarnt!')
        .setDescription(`**Server:** ${interaction.guild.name}`)
        .addFields(
          { name: '📝 Grund', value: grund },
          { name: '📊 Verwarnungen gesamt', value: `${warnCount}` }
        )
        .setTimestamp();

      await tryDM(target, dmEmbed);
      await sendPunishLog(interaction.guild, {
        action: `Verwarnung #${warnCount}`,
        color: '#ffaa00',
        target,
        moderator: interaction.user,
        reason: grund,
        extra: `Gesamt: **${warnCount}** Verwarnung(en)`
      });

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#ffaa00')
          .setDescription(`✅ <@${target.id}> wurde verwarnt. (Verwarnung #${warnCount})
📝 Grund: **${grund}**`)],
        ephemeral: true
      });
    }

    // ── /warnings ──────────────────────────────────────────────────
    if (interaction.commandName === 'warnings') {
      const target = interaction.options.getUser('user');
      const warns = getWarnings(target.id);

      if (warns.length === 0) {
        return interaction.reply({ content: `✅ <@${target.id}> hat keine Verwarnungen.`, ephemeral: true });
      }

      const list = warns.map((w, i) =>
        `**#${i + 1}** — ${w.reason}\n└ Von <@${w.moderatorId}> • <t:${Math.floor(w.timestamp / 1000)}:R>`
      ).join('\n\n');

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#ffaa00')
          .setTitle(`⚠️ Verwarnungen von ${target.tag || target.username}`)
          .setDescription(list.slice(0, 4000))
          .setFooter({ text: `${warns.length} Verwarnung(en) gesamt` })],
        ephemeral: true
      });
    }

    // ── /clearwarnings ─────────────────────────────────────────────
    if (interaction.commandName === 'clearwarnings') {
      const target = interaction.options.getUser('user');
      const before = getWarnings(target.id).length;
      clearWarnings(target.id);

      await sendPunishLog(interaction.guild, {
        action: 'Verwarnungen gelöscht',
        color: '#888888',
        target,
        moderator: interaction.user,
        reason: `${before} Verwarnung(en) wurden gelöscht`
      });

      return interaction.reply({ content: `✅ **${before}** Verwarnung(en) von <@${target.id}> gelöscht.`, ephemeral: true });
    }

    // ── /mute ──────────────────────────────────────────────────────
    if (interaction.commandName === 'mute') {
      const target = interaction.options.getUser('user');
      const durStr = interaction.options.getString('dauer');
      const grund = interaction.options.getString('grund') || 'Kein Grund angegeben';
      const member = await interaction.guild.members.fetch(target.id).catch(() => null);

      if (!member) return interaction.reply({ content: '❌ User nicht gefunden.', ephemeral: true });

      const durMs = parseDuration(durStr);
      if (!durMs) return interaction.reply({ content: '❌ Ungültige Dauer! Beispiele: `10m`, `1h`, `1d`', ephemeral: true });

      const maxMs = 28 * 24 * 60 * 60 * 1000;
      if (durMs > maxMs) return interaction.reply({ content: '❌ Maximale Timeout-Dauer ist 28 Tage.', ephemeral: true });

      try {
        await member.timeout(durMs, grund);

        const dmEmbed = new EmbedBuilder()
          .setColor('#ff6600')
          .setTitle('🔇 Du wurdest gemutet!')
          .setDescription(`**Server:** ${interaction.guild.name}`)
          .addFields(
            { name: '⏱️ Dauer', value: durStr },
            { name: '📝 Grund', value: grund }
          ).setTimestamp();

        await tryDM(target, dmEmbed);
        await sendPunishLog(interaction.guild, { action: 'Mute / Timeout', color: '#ff6600', target, moderator: interaction.user, reason: grund, duration: durStr });

        return interaction.reply({
          embeds: [new EmbedBuilder().setColor('#ff6600')
            .setDescription(`✅ <@${target.id}> wurde für **${durStr}** gemutet.
📝 Grund: **${grund}**`)],
          ephemeral: true
        });
      } catch (e) {
        return interaction.reply({ content: `❌ Fehler: ${e.message}`, ephemeral: true });
      }
    }

    // ── /unmute ────────────────────────────────────────────────────
    if (interaction.commandName === 'unmute') {
      const target = interaction.options.getUser('user');
      const grund = interaction.options.getString('grund') || 'Kein Grund angegeben';
      const member = await interaction.guild.members.fetch(target.id).catch(() => null);

      if (!member) return interaction.reply({ content: '❌ User nicht gefunden.', ephemeral: true });

      try {
        await member.timeout(null, grund);
        await sendPunishLog(interaction.guild, { action: 'Unmute', color: '#00ff88', target, moderator: interaction.user, reason: grund });
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor('#00ff88').setDescription(`✅ <@${target.id}> wurde entmutet.`)],
          ephemeral: true
        });
      } catch (e) {
        return interaction.reply({ content: `❌ Fehler: ${e.message}`, ephemeral: true });
      }
    }

    // ── /kick ──────────────────────────────────────────────────────
    if (interaction.commandName === 'kick') {
      const target = interaction.options.getUser('user');
      const grund = interaction.options.getString('grund') || 'Kein Grund angegeben';
      const member = await interaction.guild.members.fetch(target.id).catch(() => null);

      if (!member) return interaction.reply({ content: '❌ User nicht auf dem Server.', ephemeral: true });

      const dmEmbed = new EmbedBuilder()
        .setColor('#ff4444')
        .setTitle('👢 Du wurdest gekickt!')
        .setDescription(`**Server:** ${interaction.guild.name}`)
        .addFields({ name: '📝 Grund', value: grund })
        .setTimestamp();

      await tryDM(target, dmEmbed);

      try {
        await member.kick(grund);
        await sendPunishLog(interaction.guild, { action: 'Kick', color: '#ff4444', target, moderator: interaction.user, reason: grund });
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor('#ff4444').setDescription(`✅ <@${target.id}> wurde gekickt.
📝 Grund: **${grund}**`)],
          ephemeral: true
        });
      } catch (e) {
        return interaction.reply({ content: `❌ Fehler: ${e.message}`, ephemeral: true });
      }
    }

    // ── /ban ───────────────────────────────────────────────────────
    if (interaction.commandName === 'ban') {
      const target = interaction.options.getUser('user');
      const grund = interaction.options.getString('grund') || 'Kein Grund angegeben';
      const durStr = interaction.options.getString('dauer');
      const member = await interaction.guild.members.fetch(target.id).catch(() => null);

      const durMs = durStr ? parseDuration(durStr) : null;
      if (durStr && !durMs) return interaction.reply({ content: '❌ Ungültige Dauer! Beispiele: `1h`, `7d`', ephemeral: true });

      const dmEmbed = new EmbedBuilder()
        .setColor('#cc0000')
        .setTitle('🔨 Du wurdest gebannt!')
        .setDescription(`**Server:** ${interaction.guild.name}`)
        .addFields(
          { name: '📝 Grund', value: grund },
          { name: '⏱️ Dauer', value: durStr || 'Permanent' }
        ).setTimestamp();

      if (member) await tryDM(target, dmEmbed);

      try {
        await interaction.guild.members.ban(target.id, { reason: grund, deleteMessageSeconds: 86400 });

        if (durMs) {
          const data = loadData();
          data.tempbans[target.id] = {
            guildId: interaction.guild.id,
            userTag: target.tag || target.username,
            expiresAt: Date.now() + durMs,
            duration: durStr,
            reason: grund
          };
          saveData(data);
        }

        await sendPunishLog(interaction.guild, {
          action: durStr ? `Tempban (${durStr})` : 'Permanenter Ban',
          color: '#cc0000',
          target,
          moderator: interaction.user,
          reason: grund,
          duration: durStr || 'Permanent'
        });

        return interaction.reply({
          embeds: [new EmbedBuilder().setColor('#cc0000')
            .setDescription(`✅ <@${target.id}> wurde ${durStr ? `für **${durStr}**` : '**permanent**'} gebannt.
📝 Grund: **${grund}**`)],
          ephemeral: true
        });
      } catch (e) {
        return interaction.reply({ content: `❌ Fehler: ${e.message}`, ephemeral: true });
      }
    }

    // ── /unban ─────────────────────────────────────────────────────
    if (interaction.commandName === 'unban') {
      const userId = interaction.options.getString('user_id').trim();
      const grund = interaction.options.getString('grund') || 'Kein Grund angegeben';

      try {
        const bannedUser = await interaction.guild.bans.fetch(userId).catch(() => null);
        if (!bannedUser) return interaction.reply({ content: '❌ Dieser User ist nicht gebannt.', ephemeral: true });

        await interaction.guild.members.unban(userId, grund);

        const data = loadData();
        delete data.tempbans[userId];
        saveData(data);

        await sendPunishLog(interaction.guild, {
          action: 'Unban',
          color: '#00ff88',
          target: bannedUser.user,
          moderator: interaction.user,
          reason: grund
        });

        return interaction.reply({
          embeds: [new EmbedBuilder().setColor('#00ff88').setDescription(`✅ **${bannedUser.user.tag || userId}** wurde entbannt.
📝 Grund: **${grund}**`)],
          ephemeral: true
        });
      } catch (e) {
        return interaction.reply({ content: `❌ Fehler: ${e.message}`, ephemeral: true });
      }
    }

    // ── /modlog ────────────────────────────────────────────────────
    if (interaction.commandName === 'modlog') {
      const target = interaction.options.getUser('user');
      const warns = getWarnings(target.id);
      const data = loadData();
      const tempban = data.tempbans[target.id];

      const lines = [];

      if (warns.length > 0) {
        lines.push(`**⚠️ Verwarnungen (${warns.length})**`);
        warns.slice(-5).forEach((w, i) => {
          lines.push(`#${i + 1} ${w.reason} — <t:${Math.floor(w.timestamp / 1000)}:R> von <@${w.moderatorId}>`);
        });
        if (warns.length > 5) lines.push(`_...und ${warns.length - 5} weitere_`);
      }

      if (tempban) {
        lines.push(`
**🔨 Aktiver Tempban**`);
        lines.push(`Läuft ab: <t:${Math.floor(tempban.expiresAt / 1000)}:R> | Grund: ${tempban.reason}`);
      }

      if (lines.length === 0) {
        return interaction.reply({ content: `✅ <@${target.id}> hat keine Einträge im Modlog.`, ephemeral: true });
      }

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#b10de7')
          .setTitle(`📋 Modlog — ${target.username}`)
          .setThumbnail(target.displayAvatarURL())
          .setDescription(lines.join('\n'))
          .setTimestamp()],
        ephemeral: true
      });
    }

    if (interaction.commandName === 'botstatus') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: 'Dafür brauchst du Administrator-Rechte.', ephemeral: true });
      }

      const status = interaction.options.getString('status');
      const activityType = interaction.options.getString('aktivität') || interaction.options.getString('aktivitaet');
      const activityName = interaction.options.getString('text');
      const rawUrl = interaction.options.getString('url');
      const activityUrl = activityType === 'Streaming' ? rawUrl : null;

      if (activityType === 'Streaming' && !activityUrl) {
        return interaction.reply({ content: 'Beim Typ Streaming brauchst du eine Twitch- oder YouTube-URL.', ephemeral: true });
      }

      if (activityUrl && !/^https?:\/\//i.test(activityUrl)) {
        return interaction.reply({ content: 'Die Streaming-URL muss mit http:// oder https:// anfangen.', ephemeral: true });
      }

      const data = loadData();
      data.presence = {
        status,
        activityType,
        activityName,
        activityUrl
      };
      saveData(data);
      applyConfiguredPresence();

      const labels = {
        online: 'Online',
        idle: 'Abwesend',
        dnd: 'Nicht stören',
        offline: 'Offline anzeigen',
        Playing: 'Spielt',
        Watching: 'Schaut',
        Listening: 'Hört',
        Streaming: 'Streamt',
        Competing: 'Tritt an'
      };

      return interaction.reply({
        content: `Gespeichert: **${labels[status] || status}** - **${labels[activityType] || activityType} ${activityName}**`,
        ephemeral: true
      });
    }

    if (interaction.commandName === 'setinvites') {
      const user = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');

      setInvites(user.id, amount);
      await updateLeaderboard();

      return interaction.reply({
        content: `✅ Set invite count for <@${user.id}> to **${amount}**.`,
        ephemeral: true
      });
    }

    if (interaction.commandName === 'fertig') {
      const user = interaction.options.getUser('user');
      const orderId = getNextOrderId();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`bewerten_${user.id}_${orderId}`)
          .setLabel('Jetzt bewerten')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('⭐')
      );

      return interaction.reply({
        content:
          `✅ Bestellung für ${user} wurde als **fertig** markiert!\n` +
          `**Order-ID:** ${orderId}\n\n` +
          `${user}, bitte bewertete den Shop!\n\n` +
          `> Nach der Bewertung erhältst du automatisch die **Kunden-Rolle**.`,
        components: [row]
      });
    }
  }

  if (interaction.isButton()) {

    if (interaction.customId.startsWith('giveaway_enter_')) {
      const msgId = interaction.customId.replace('giveaway_enter_', '');
      const data = loadData();
      const gw = data.giveaways[msgId];

      if (!gw || gw.ended) {
        return interaction.reply({ content: '❌ Dieses Giveaway ist bereits beendet!', ephemeral: true });
      }

      if (gw.participants.includes(interaction.user.id)) {
        // Toggle: remove if already in
        gw.participants = gw.participants.filter(p => p !== interaction.user.id);
        saveData(data);
        return interaction.reply({ content: '❌ Du hast deine Teilnahme zurückgezogen!', ephemeral: true });
      }

      // Check min invites
      if (gw.minInvites > 0) {
        const userInvites = getInvites(interaction.user.id);
        if (userInvites < gw.minInvites) {
          return interaction.reply({
            content: `❌ Du brauchst mindestens **${gw.minInvites}** Einladungen! Du hast: **${userInvites}**`,
            ephemeral: true
          });
        }
      }

      // Check min account age
      if (gw.minAccountAgeDays > 0) {
        const ageDays = (Date.now() - interaction.user.createdTimestamp) / 86400000;
        if (ageDays < gw.minAccountAgeDays) {
          return interaction.reply({
            content: `❌ Dein Account muss mindestens **${gw.minAccountAgeDays}** Tage alt sein! (Deiner: **${Math.floor(ageDays)}** Tage)`,
            ephemeral: true
          });
        }
      }

      gw.participants.push(interaction.user.id);
      saveData(data);

      // Update embed with new participant count
      try {
        const msg = await interaction.channel.messages.fetch(msgId).catch(() => null);
        if (msg) {
          const updatedEmbed = buildGiveawayEmbed(gw, false);
          await msg.edit({ embeds: [updatedEmbed] });
        }
      } catch {}

      return interaction.reply({ content: `✅ Du nimmst am Giveaway für **${gw.prize}** teil! 🎉`, ephemeral: true });
    }

    if (interaction.customId.startsWith('role_')) {
      const roleKey = interaction.customId.replace('role_', '');
      const roleId = PING_ROLES[roleKey];

      if (!roleId) {
        return interaction.reply({
          content: '❌ Rolle nicht gefunden.',
          ephemeral: true
        });
      }

      const member = interaction.member;
      const hasRole = member.roles.cache.has(roleId);

      try {
        if (hasRole) {
          await member.roles.remove(roleId);

          return interaction.reply({
            content: `❌ Rolle entfernt: <@&${roleId}>`,
            ephemeral: true
          });
        }

        await member.roles.add(roleId);

        return interaction.reply({
          content: `✅ Rolle erhalten: <@&${roleId}>`,
          ephemeral: true
        });
      } catch (e) {
        console.error('role button error:', e);

        return interaction.reply({
          content: '❌ Ich konnte die Rolle nicht ändern. Prüfe meine Rollen-Rechte.',
          ephemeral: true
        });
      }
    }

    if (interaction.customId === 'verify_member') {
      try {
        if (interaction.member.roles.cache.has(VERIFY_ROLE_ID)) {
          return interaction.reply({
            content: '✅ Du bist bereits verifiziert.',
            ephemeral: true
          });
        }

        await interaction.member.roles.add(VERIFY_ROLE_ID);

        return interaction.reply({
          content: '✅ Du wurdest erfolgreich verifiziert!',
          ephemeral: true
        });
      } catch (e) {
        console.error('verify_member error:', e);

        return interaction.reply({
          content: '❌ Ich konnte dir die Rolle nicht geben. Prüfe meine Rechte.',
          ephemeral: true
        });
      }
    }


    if (interaction.customId === 'create_support_ticket') {
      const cleanName = cleanUsername(interaction.user.username);
      const ticketName = `support-${cleanName}`.slice(0, 100);

      const existing = interaction.guild.channels.cache.find(c =>
        c.name === ticketName &&
        c.type === ChannelType.GuildText &&
        c.parentId === TICKET_CATEGORY_ID &&
        !c.name.startsWith('closed-')
      );

      if (existing) {
        return interaction.reply({
          content: `❌ Du hast bereits ein offenes Support-Ticket: <#${existing.id}>`,
          ephemeral: true
        });
      }

      try {
        const ticket = await interaction.guild.channels.create({
          name: ticketName,
          type: ChannelType.GuildText,
          parent: TICKET_CATEGORY_ID,
          topic: `owner:${interaction.user.id};type:support;order:none`,
          permissionOverwrites: [
            { id: interaction.guild.id, deny: ['ViewChannel'] },
            { id: interaction.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
            ...STAFF_ROLE_IDS.map(roleId => ({ id: roleId, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] })),
            { id: client.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageChannels'] }
          ]
        });

        const ticketEmbed = new EmbedBuilder()
          .setColor('#b10de7')
          .setTitle('🎫 Support')
          .setDescription('Willkommen beim Support! Bitte beschreibe dein Anliegen so genau wie möglich.')
          .setTimestamp();

        const ticketButtons = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('close_ticket').setLabel('Ticket schließen').setEmoji('🔒').setStyle(ButtonStyle.Danger)
        );

        await ticket.send({
          content: `<@${interaction.user.id}> <@&${STAFF_ROLE_IDS[0]}> <@&${STAFF_ROLE_IDS[1]}>`,
          embeds: [ticketEmbed],
          components: [ticketButtons]
        });

        return interaction.reply({ content: `✅ Support-Ticket erstellt: <#${ticket.id}>`, ephemeral: true });
      } catch (e) {
        console.error('create support ticket error:', e);
        return interaction.reply({ content: '❌ Fehler beim Erstellen des Tickets. Prüfe die Bot-Rechte.', ephemeral: true });
      }
    }

    if (interaction.customId.startsWith('ticket_cat_')) {
      const catMap = {
        'ticket_cat_items_geld': { label: 'Items & Geld', emoji: '💰' },
        'ticket_cat_schematics': { label: 'Schematics', emoji: '📐' },
        'ticket_cat_resource_pack': { label: 'Resource Pack', emoji: '🎨' }
      };
      const cat = catMap[interaction.customId];
      if (!cat) return;

      // Check for existing ticket before showing modal
      const existingCheck = interaction.guild.channels.cache.find(c => {
        const owner = getTicketOwnerId(c);
        return owner === interaction.user.id && c.type === ChannelType.GuildText &&
          (c.parentId === TICKET_CATEGORY_ID) && !c.name.startsWith('closed-');
      });
      if (existingCheck) {
        return interaction.reply({ content: `❌ Du hast bereits ein offenes Ticket: <#${existingCheck.id}>`, ephemeral: true });
      }

      // Show category-specific modal BEFORE creating the ticket
      const modal = new ModalBuilder()
        .setCustomId(`pre_order_modal_${interaction.customId}`)
        .setTitle(`Bestellung — ${cat.label}`);

      if (interaction.customId === 'ticket_cat_items_geld') {
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('item').setLabel('Was möchtest du kaufen?')
              .setStyle(TextInputStyle.Short).setPlaceholder('z.B. 1M Money, Elytra, Ancient Debris').setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('amount').setLabel('Menge')
              .setStyle(TextInputStyle.Short).setPlaceholder('z.B. 5 Stück / 10M').setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('ingame').setLabel('Ingame-Name')
              .setStyle(TextInputStyle.Short).setPlaceholder('Dein Minecraft Name').setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('payment').setLabel('Zahlungsmethode')
              .setStyle(TextInputStyle.Short).setPlaceholder('z.B. PayPal, Paysafecard').setRequired(true)
          )
        );
      } else if (interaction.customId === 'ticket_cat_schematics') {
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('item').setLabel('Welche Schematic möchtest du kaufen?')
              .setStyle(TextInputStyle.Short).setPlaceholder('z.B. Castle Schematic v2').setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('ingame').setLabel('Ingame-Name')
              .setStyle(TextInputStyle.Short).setPlaceholder('Dein Minecraft Name').setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('payment').setLabel('Zahlungsmethode')
              .setStyle(TextInputStyle.Short).setPlaceholder('z.B. PayPal, Paysafecard').setRequired(true)
          )
        );
      } else if (interaction.customId === 'ticket_cat_resource_pack') {
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('item').setLabel('Welches Resource Pack möchtest du kaufen?')
              .setStyle(TextInputStyle.Short).setPlaceholder('z.B. HugoSMP Default Pack v3').setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('ingame').setLabel('Ingame-Name')
              .setStyle(TextInputStyle.Short).setPlaceholder('Dein Minecraft Name').setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('payment').setLabel('Zahlungsmethode')
              .setStyle(TextInputStyle.Short).setPlaceholder('z.B. PayPal, Paysafecard').setRequired(true)
          )
        );
      }

      return interaction.showModal(modal);
    }

    if (interaction.customId === 'order_form') {
      const ownerId = getTicketOwnerId(interaction.channel);

      if (ownerId && interaction.user.id !== ownerId) {
        return interaction.reply({
          content: '❌ Nur der Ticket-Ersteller kann das Bestellformular ausfüllen.',
          ephemeral: true
        });
      }

      if (hasOrderFormSubmitted(interaction.channel.id)) {
        return interaction.reply({
          content: '❌ Das Bestellformular wurde in diesem Ticket bereits abgesendet.',
          ephemeral: true
        });
      }

      const modal = new ModalBuilder()
        .setCustomId('order_form_modal')
        .setTitle('Bestellformular');

      const itemInput = new TextInputBuilder()
        .setCustomId('item')
        .setLabel('Was möchtest du kaufen?')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('z.B. 1M Money, Elytra, Ancient Debris')
        .setRequired(true);

      const amountInput = new TextInputBuilder()
        .setCustomId('amount')
        .setLabel('Menge')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('z.B. 5')
        .setRequired(true);

      const ingameInput = new TextInputBuilder()
        .setCustomId('ingame')
        .setLabel('Ingame-Name')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Dein Minecraft Name')
        .setRequired(true);

      const paymentInput = new TextInputBuilder()
        .setCustomId('payment')
        .setLabel('Zahlungsmethode')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('z.B. PayPal, Paysafecard')
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(itemInput),
        new ActionRowBuilder().addComponents(amountInput),
        new ActionRowBuilder().addComponents(ingameInput),
        new ActionRowBuilder().addComponents(paymentInput)
      );

      return interaction.showModal(modal);
    }

    if (interaction.customId === 'close_ticket') {
      const ownerId = getTicketOwnerId(interaction.channel);

      if (!ownerId) {
        return interaction.reply({
          content: '❌ Ticket-Ersteller konnte nicht gefunden werden.',
          ephemeral: true
        });
      }

      if (!isStaff(interaction.member) && interaction.user.id !== ownerId) {
        return interaction.reply({
          content: '❌ Du darfst dieses Ticket nicht schließen.',
          ephemeral: true
        });
      }

      if (interaction.channel.parentId === CLOSED_TICKET_CATEGORY_ID || interaction.channel.name.startsWith('closed-')) {
        return interaction.reply({
          content: '❌ Dieses Ticket ist bereits geschlossen.',
          ephemeral: true
        });
      }

      if (interaction.user.id === ownerId) {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('confirm_close_ticket')
            .setLabel('Ja, schließen')
            .setEmoji('✅')
            .setStyle(ButtonStyle.Danger),

          new ButtonBuilder()
            .setCustomId('cancel_close_ticket')
            .setLabel('Abbrechen')
            .setEmoji('❌')
            .setStyle(ButtonStyle.Secondary)
        );

        return interaction.reply({
          content: 'Möchtest du dieses Ticket wirklich schließen?',
          components: [row],
          ephemeral: true
        });
      }

      const stamp = Date.now().toString();
      const requestId = `close_${interaction.channel.id}_${ownerId}_${stamp}`;

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket_close_yes_${ownerId}_${stamp}`)
          .setLabel('Ticket schließen')
          .setEmoji('🔒')
          .setStyle(ButtonStyle.Danger),

        new ButtonBuilder()
          .setCustomId(`ticket_close_no_${ownerId}_${stamp}`)
          .setLabel('Offen lassen')
          .setEmoji('📌')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.reply({
        content: `✅ Anfrage an <@${ownerId}> gesendet.`,
        ephemeral: true
      });

      await interaction.channel.send({
        content:
          `<@${ownerId}> soll dieses Ticket geschlossen werden?\n` +
          `⏳ Wenn du nichts auswählst, wird das Ticket in **5 Minuten** automatisch geschlossen.`,
        components: [row]
      });

      setTimeout(async () => {
        try {
          if (hasReviewDecision(requestId)) return;

          markReviewDecision(requestId);
          await closeTicket(interaction.channel, interaction.user, 'Auto-Close nach Staff-Anfrage');
        } catch (e) {
          console.error('ticket close auto error:', e.message);
        }
      }, 5 * 60 * 1000);

      return;
    }

    if (interaction.customId.startsWith('ticket_close_yes_')) {
      const parts = interaction.customId.split('_');
      const ownerId = parts[3];
      const stamp = parts[4];

      if (interaction.user.id !== ownerId) {
        return interaction.reply({
          content: '❌ Nur der Ticket-Ersteller kann das bestätigen.',
          ephemeral: true
        });
      }

      const requestId = `close_${interaction.channel.id}_${ownerId}_${stamp}`;
      markReviewDecision(requestId);

      await interaction.update({
        content: '🔒 Ticket wird geschlossen...',
        components: []
      });

      setTimeout(async () => {
        try {
          await closeTicket(interaction.channel, interaction.user, 'Ticket-Ersteller hat Schließen bestätigt');
        } catch (e) {
          console.error('ticket owner close yes error:', e.message);
        }
      }, 2000);

      return;
    }

    if (interaction.customId.startsWith('ticket_close_no_')) {
      const parts = interaction.customId.split('_');
      const ownerId = parts[3];
      const stamp = parts[4];

      if (interaction.user.id !== ownerId) {
        return interaction.reply({
          content: '❌ Nur der Ticket-Ersteller kann das auswählen.',
          ephemeral: true
        });
      }

      const requestId = `close_${interaction.channel.id}_${ownerId}_${stamp}`;
      markReviewDecision(requestId);

      return interaction.update({
        content: '📌 Das Ticket bleibt offen.',
        components: []
      });
    }

    if (interaction.customId === 'cancel_close_ticket') {
      return interaction.update({
        content: '❌ Schließen abgebrochen.',
        components: []
      });
    }

    if (interaction.customId === 'confirm_close_ticket') {
      const ownerId = getTicketOwnerId(interaction.channel);
      const allowed = isStaff(interaction.member) || interaction.user.id === ownerId;

      if (!allowed) {
        return interaction.reply({
          content: '❌ Du darfst dieses Ticket nicht schließen.',
          ephemeral: true
        });
      }

      await interaction.update({
        content: '🔒 Ticket wird geschlossen...',
        components: []
      });

      setTimeout(async () => {
        try {
          await closeTicket(interaction.channel, interaction.user, 'Manuell geschlossen');
        } catch (e) {
          console.error('confirm close error:', e.message);
        }
      }, 2000);

      return;
    }

    if (interaction.customId === 'reopen_ticket') {
      if (!isStaff(interaction.member)) {
        return interaction.reply({
          content: '❌ Nur Staff kann Tickets wieder öffnen.',
          ephemeral: true
        });
      }

      await interaction.reply({
        content: '🔓 Ticket wird wieder geöffnet...',
        ephemeral: true
      });

      await reopenTicket(interaction.channel, interaction.user);
      return;
    }

    if (interaction.customId.startsWith('review_keep_open_')) {
      const buyerId = interaction.customId.replace('review_keep_open_', '');

      if (interaction.user.id !== buyerId) {
        return interaction.reply({
          content: '❌ Nur der Käufer kann das auswählen.',
          ephemeral: true
        });
      }

      const reviewDecisionId = `${interaction.channel.id}_${interaction.user.id}`;
      markReviewDecision(reviewDecisionId);

      return interaction.update({
        content: '📌 Das Ticket bleibt offen.',
        components: []
      });
    }

    if (interaction.customId.startsWith('review_close_ticket_')) {
      const buyerId = interaction.customId.replace('review_close_ticket_', '');

      if (interaction.user.id !== buyerId) {
        return interaction.reply({
          content: '❌ Nur der Käufer kann das Ticket schließen.',
          ephemeral: true
        });
      }

      const reviewDecisionId = `${interaction.channel.id}_${interaction.user.id}`;
      markReviewDecision(reviewDecisionId);

      await interaction.update({
        content: '🔒 Ticket wird geschlossen...',
        components: []
      });

      setTimeout(async () => {
        try {
          await closeTicket(interaction.channel, interaction.user, 'Nach Review geschlossen');
        } catch (e) {
          console.error('review close ticket error:', e.message);
        }
      }, 3000);

      return;
    }

    if (interaction.customId.startsWith('stock_')) {
      const isStaffMember = isStaff(interaction.member);

      if (!isStaffMember) {
        return interaction.reply({
          content: '❌ Nur Admins können den Bestand bearbeiten!',
          ephemeral: true
        });
      }

      const parts = interaction.customId.split('_');
      const action = parts[1];
      const itemId = parts.slice(2).join('_');

      if (action === 'set') {
        const item = (loadData().stockItems || STOCK_ITEMS).find(i => i.id === itemId);

        if (!item) {
          return interaction.reply({
            content: '❌ Item nicht gefunden.',
            ephemeral: true
          });
        }

        const modal = new ModalBuilder()
          .setCustomId(`stock_modal_${itemId}`)
          .setTitle(item.name + ' - Bestand setzen');

        const input = new TextInputBuilder()
          .setCustomId('amount')
          .setLabel('Neuer Bestand (Zahl eingeben)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('z.B. 50')
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));

        return interaction.showModal(modal);
      }

      await interaction.deferReply({ ephemeral: true });

      const data = loadData();
      const current = data.stock[itemId] ?? 0;

      let delta = 0;

      if (action === 'plus1') delta = 1;
      else if (action === 'plus10') delta = 10;
      else if (action === 'minus1') delta = -1;
      else if (action === 'minus10') delta = -10;

      data.stock[itemId] = Math.max(0, current + delta);

      saveData(data);
      await updateStockPanel();

      const item = (data.stockItems || STOCK_ITEMS).find(i => i.id === itemId);

      if (!item) {
        return interaction.editReply(`✅ Bestand aktualisiert: ${current} → **${data.stock[itemId]}**`);
      }

      return interaction.editReply(
        `✅ **${item.name}**: ${current} → **${data.stock[itemId]}**`
      );
    }

    if (interaction.customId === 'gen_invite') {
      await interaction.deferReply({ ephemeral: true });

      try {
        const rulesChannel =
          interaction.guild.channels.cache.get(RULES_CHANNEL_ID) ??
          interaction.channel;

        const invite = await rulesChannel.createInvite({
          maxAge: 0,
          maxUses: 0,
          unique: true
        });

        cachedInvites.set(invite.code, {
          inviterId: interaction.user.id,
          uses: 0
        });

        return interaction.editReply(
          `✅ Here is your personal invite link: https://discord.gg/${invite.code}\n\n` +
          `Make sure your friends **verify** after joining!`
        );
      } catch (e) {
        return interaction.editReply('❌ Could not create invite. Missing permissions?');
      }
    }

    if (interaction.customId === 'check_inv') {
      await interaction.deferReply({ ephemeral: true });

      const count = getInvites(interaction.user.id);

      return interaction.editReply(
        `📊 You currently have **${count}** verified invite${count === 1 ? '' : 's'}!`
      );
    }

    if (interaction.customId === 'claim') {
      await interaction.deferReply({ ephemeral: true });

      const count = getInvites(interaction.user.id);

      if (count < REQUIRED_INVITES) {
        return interaction.editReply(
          `❌ You don't have enough verified invites yet!\n\n` +
          `**${count}/${REQUIRED_INVITES}** — You need **${REQUIRED_INVITES - count}** more.`
        );
      }

      const cleanName = cleanUsername(interaction.user.username);
      const ticketName = `1m-${cleanName}`.slice(0, 100);

      const existingTicket =
        interaction.guild.channels.cache.find(c =>
          c.name === ticketName || c.name === `closed-${ticketName}`
        );

      if (existingTicket) {
        return interaction.editReply(`❌ You already have an open ticket: <#${existingTicket.id}>`);
      }

      try {
        const ticket = await interaction.guild.channels.create({
          name: ticketName,
          type: ChannelType.GuildText,
          parent: TICKET_CATEGORY_ID,
          topic: `owner:${interaction.user.id};type:reward;order:none`,
          permissionOverwrites: [
            {
              id: interaction.guild.id,
              deny: ['ViewChannel']
            },
            {
              id: interaction.user.id,
              allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
            },
            {
              id: STAFF_ROLE_IDS[0],
              allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
            },
            {
              id: STAFF_ROLE_IDS[1],
              allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
            },
            {
              id: client.user.id,
              allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageChannels']
            }
          ]
        });

        const ticketEmbed = new EmbedBuilder()
          .setColor('#b10de7')
          .setTitle('✨ — DEIN REWARD EINLÖSEN — ✨')
          .setDescription(
            `💎 **Belohnungswert:** 1.000.000 $\n\n` +
            `🧮 **KURZRECHNUNG:**\n` +
            `Reward (1 Mio) ÷ Ancient-Wert (z.B. 40k) = Menge (25 Stück)\n\n` +
            `🛠️ **DEINE AUFGABE:**\n` +
            `↳ Order Ingame erstellen (Menge laut Rechnung)\n` +
            `↳ Preis pro Stück: 1$\n` +
            `↳ Steuern: Sind so gut wie keine Vorhanden!\n\n` +
            `📩 **SCHREIB UNS:**\n` +
            `• Ingame-Name:\n` +
            `• Status: "Ich habe die Order reingestellt!"`
          )
          .setTimestamp();

        const closeRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('Ticket schließen')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Danger)
        );

        await ticket.send({
          content: `<@${interaction.user.id}> <@&${STAFF_ROLE_IDS[0]}> <@&${STAFF_ROLE_IDS[1]}>`,
          embeds: [ticketEmbed],
          components: [closeRow]
        });

        const remaining = Math.max(0, count - REQUIRED_INVITES);

        setInvites(interaction.user.id, remaining);
        await updateLeaderboard();

        const log = interaction.guild.channels.cache.get(REWARD_LOG_ID);

        if (log) {
          await log.send(
            `💰 **${interaction.user.tag}** (<@${interaction.user.id}>) claimed **${REWARD}** with **${count} verified invites**!\n` +
            `🎫 Ticket: <#${ticket.id}>\n📊 Remaining invites: **${remaining}**`
          );
        }

        return interaction.editReply(
          `✅ Ticket created: <#${ticket.id}>\n📊 Remaining invites: **${remaining}**`
        );
      } catch (e) {
        console.error('claim ticket error:', e);

        return interaction.editReply(
          '❌ Fehler beim Erstellen des Tickets. Bitte kontaktiere einen Admin!'
        );
      }
    }

    if (interaction.customId.startsWith('bewerten_')) {
      const parts = interaction.customId.split('_');
      const buyerId = parts[1];
      const orderId = parts[2] || 'Unbekannt';

      if (interaction.user.id !== buyerId) {
        return interaction.reply({
          content: '❌ Du darfst nur deine eigene Bestellung bewerten!',
          ephemeral: true
        });
      }

      if (hasReviewedOrder(orderId)) {
        return interaction.reply({
          content: '❌ Diese Bestellung wurde bereits bewertet!',
          ephemeral: true
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(`review_modal_${buyerId}_${orderId}`)
        .setTitle('HugoSMP Market Bewertung');

      const stars = new TextInputBuilder()
        .setCustomId('stars')
        .setLabel('Sterne (1-5)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('5')
        .setRequired(true)
        .setMaxLength(1);

      const purchasedItem = new TextInputBuilder()
        .setCustomId('purchased_item')
        .setLabel('Was hast du gekauft?')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('z.B. 5M Money, Elytra, Resource Pack...')
        .setRequired(true)
        .setMaxLength(100);

      const text = new TextInputBuilder()
        .setCustomId('text')
        .setLabel('Deine Bewertung')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('War alles schnell, kein Scam...')
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(stars),
        new ActionRowBuilder().addComponents(purchasedItem),
        new ActionRowBuilder().addComponents(text)
      );

      return interaction.showModal(modal);
    }
  }

  if (interaction.isModalSubmit()) {


    if (interaction.customId.startsWith('pre_order_modal_')) {
      const catKey = interaction.customId.replace('pre_order_modal_', '');
      const catMap = {
        'ticket_cat_items_geld': { label: 'Items & Geld', emoji: '💰' },
        'ticket_cat_schematics': { label: 'Schematics', emoji: '📐' },
        'ticket_cat_resource_pack': { label: 'Resource Pack', emoji: '🎨' }
      };
      const cat = catMap[catKey];
      if (!cat) return;

      const item    = interaction.fields.getTextInputValue('item');
      const amount  = catKey === 'ticket_cat_items_geld' ? interaction.fields.getTextInputValue('amount') : null;
      const ingame  = interaction.fields.getTextInputValue('ingame');
      const payment = interaction.fields.getTextInputValue('payment');

      await interaction.deferReply({ ephemeral: true });

      const cleanName = cleanUsername(interaction.user.username);
      const ticketOrderId = getNextTicketOrderId();
      const ticketName = `order-${ticketOrderId}-${cleanName}`.slice(0, 100);

      try {
        const ticket = await interaction.guild.channels.create({
          name: ticketName,
          type: ChannelType.GuildText,
          parent: TICKET_CATEGORY_ID,
          topic: `owner:${interaction.user.id};type:bestellung;order:${ticketOrderId}`,
          permissionOverwrites: [
            { id: interaction.guild.id, deny: ['ViewChannel'] },
            { id: interaction.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
            ...STAFF_ROLE_IDS.map(roleId => ({ id: roleId, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] })),
            { id: client.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageChannels'] }
          ]
        });

        // Header embed
        const headerEmbed = new EmbedBuilder()
          .setColor('#b10de7')
          .setTitle(`🛒 Bestellung #${ticketOrderId} — ${cat.emoji} ${cat.label}`)
          .setDescription(
            `**Kategorie:** ${cat.emoji} ${cat.label}\n` +
            `**Käufer:** <@${interaction.user.id}>\n\n` +
            'Das Bestellformular wurde bereits ausgefüllt. Du kannst noch weitere Infos in den Chat schreiben.'
          )
          .setTimestamp();

        // Form data embed — fields differ per category
        const formFields = [];
        if (catKey === 'ticket_cat_items_geld') {
          formFields.push(
            { name: '🛍️ Item', value: item, inline: true },
            { name: '🔢 Menge', value: amount, inline: true },
            { name: '⚔️ Ingame-Name', value: ingame, inline: true },
            { name: '💳 Zahlungsmethode', value: payment, inline: true }
          );
        } else if (catKey === 'ticket_cat_schematics') {
          formFields.push(
            { name: '📐 Schematic', value: item, inline: true },
            { name: '⚔️ Ingame-Name', value: ingame, inline: true },
            { name: '💳 Zahlungsmethode', value: payment, inline: true }
          );
        } else {
          formFields.push(
            { name: '🎨 Resource Pack', value: item, inline: true },
            { name: '⚔️ Ingame-Name', value: ingame, inline: true },
            { name: '💳 Zahlungsmethode', value: payment, inline: true }
          );
        }
        const formEmbed = new EmbedBuilder()
          .setColor('#b10de7')
          .setTitle(`📋 Bestellformular #${ticketOrderId}`)
          .addFields(...formFields)
          .setTimestamp();

        // Only close button — no order form button needed
        const ticketButtons = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('close_ticket').setLabel('Ticket schließen').setEmoji('🔒').setStyle(ButtonStyle.Danger)
        );

        await ticket.send({
          content: `<@${interaction.user.id}> <@&${STAFF_ROLE_IDS[0]}> <@&${STAFF_ROLE_IDS[1]}>`,
          embeds: [headerEmbed, formEmbed],
          components: [ticketButtons]
        });

        markOrderFormSubmitted(ticket.id);

        return interaction.editReply({ content: `✅ Ticket erstellt: <#${ticket.id}>` });
      } catch (e) {
        console.error('pre_order_modal error:', e);
        return interaction.editReply({ content: '❌ Fehler beim Erstellen des Tickets. Prüfe die Bot-Rechte.' });
      }
    }

    if (interaction.customId === 'order_form_modal') {
      const ownerId = getTicketOwnerId(interaction.channel);

      if (ownerId && interaction.user.id !== ownerId) {
        return interaction.reply({
          content: '❌ Nur der Ticket-Ersteller kann das Bestellformular absenden.',
          ephemeral: true
        });
      }

      if (hasOrderFormSubmitted(interaction.channel.id)) {
        return interaction.reply({
          content: '❌ Das Bestellformular wurde in diesem Ticket bereits abgesendet.',
          ephemeral: true
        });
      }

      const item = interaction.fields.getTextInputValue('item');
      const amount = interaction.fields.getTextInputValue('amount');
      const ingame = interaction.fields.getTextInputValue('ingame');
      const payment = interaction.fields.getTextInputValue('payment');
      const orderId = getTicketOrderId(interaction.channel);

      markOrderFormSubmitted(interaction.channel.id);

      const embed = new EmbedBuilder()
        .setColor('#b10de7')
        .setTitle(`🛒 Neue Bestellung${orderId !== 'none' ? ` #${orderId}` : ''}`)
        .addFields(
          { name: 'Item', value: item, inline: true },
          { name: 'Menge', value: amount, inline: true },
          { name: 'Ingame-Name', value: ingame, inline: true },
          { name: 'Zahlungsmethode', value: payment, inline: true },
          { name: 'Käufer', value: `<@${interaction.user.id}>`, inline: true }
        )
        .setTimestamp();

      await interaction.channel.send({
        embeds: [embed]
      });

      return interaction.reply({
        content: '✅ Bestellformular gesendet!',
        ephemeral: true
      });
    }

    if (interaction.customId.startsWith('stock_modal_')) {
      const itemId = interaction.customId.replace('stock_modal_', '');
      const amountStr = interaction.fields.getTextInputValue('amount');
      const amount = parseInt(amountStr);

      if (isNaN(amount) || amount < 0) {
        return interaction.reply({
          content: '❌ Bitte eine gültige Zahl (≥ 0) eingeben!',
          ephemeral: true
        });
      }

      const data = loadData();
      const old = data.stock[itemId] ?? 0;

      data.stock[itemId] = amount;

      saveData(data);
      await updateStockPanel();

      const item = STOCK_ITEMS.find(i => i.id === itemId);

      if (!item) {
        return interaction.reply({
          content: '❌ Item nicht gefunden.',
          ephemeral: true
        });
      }

      return interaction.reply({
        content: `✅ **${item.name}**: ${old} → **${amount}**`,
        ephemeral: true
      });
    }

    if (interaction.customId.startsWith('review_modal_')) {
      const parts = interaction.customId.split('_');
      const buyerId = parts[2];
      const orderId = parts[3] || 'Unbekannt';

      const starsStr = interaction.fields.getTextInputValue('stars');
      const purchasedItem = interaction.fields.getTextInputValue('purchased_item');
      const text = interaction.fields.getTextInputValue('text');
      const stars = parseInt(starsStr);

      if (isNaN(stars) || stars < 1 || stars > 5) {
        return interaction.reply({
          content: '❌ Bitte eine Zahl zwischen **1** und **5** eingeben!',
          ephemeral: true
        });
      }

      if (hasReviewedOrder(orderId)) {
        return interaction.reply({
          content: '❌ Diese Bestellung wurde bereits bewertet!',
          ephemeral: true
        });
      }

      const reviewChannel = interaction.guild.channels.cache.get(REVIEWS_CHANNEL_ID);

      if (!reviewChannel) {
        return interaction.reply({
          content: '❌ Reviews-Channel nicht gefunden!',
          ephemeral: true
        });
      }

      const starsEmoji = '⭐'.repeat(stars);
      const reviewer = interaction.user;

      const embed = new EmbedBuilder()
        .setAuthor({
          name: reviewer.username,
          iconURL: reviewer.displayAvatarURL()
        })
        .setTitle('Bewertung — HugoSMP Market')
        .setDescription(
          `**Bewertet von:** **<@${reviewer.id}>**\n` +
          `**Gekauft:** ${purchasedItem}\n\n` +
          `${starsEmoji} **(${stars}/5)**\n\n${text}`
        )
        .setThumbnail('https://cdn.discordapp.com/attachments/1499135826624249996/1501579033291522299/Hugo_SMP_Shop_Icon.jpg')
        .setFooter({ text: `Order-ID: ${orderId}` })
        .setColor(0x00ff00)
        .setTimestamp();

      await reviewChannel.send({
        embeds: [embed]
      });

      try {
        const member = await interaction.guild.members.fetch(reviewer.id);

        if (!member.roles.cache.has(KUNDEN_ROLE_ID)) {
          await member.roles.add(KUNDEN_ROLE_ID);
        }
      } catch (e) {
        console.error('Rolle konnte nicht vergeben werden:', e.message);
      }

      markReviewedOrder(orderId);

      const reviewDecisionId = `${interaction.channel.id}_${reviewer.id}`;

      const reviewCloseRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`review_keep_open_${reviewer.id}`)
          .setLabel('Offen lassen')
          .setEmoji('📌')
          .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
          .setCustomId(`review_close_ticket_${reviewer.id}`)
          .setLabel('Ticket schließen')
          .setEmoji('🔒')
          .setStyle(ButtonStyle.Danger)
      );

      await interaction.reply({
        content:
          '✅ **Danke für deine Bewertung!**\n' +
          'Du hast die **Kunden-Rolle** erhalten.\n\n' +
          'Möchtest du das Ticket schließen oder offen lassen?\n' +
          '⏳ Wenn du nichts auswählst, wird das Ticket in **5 Minuten** automatisch geschlossen.',
        components: [reviewCloseRow],
        ephemeral: true
      });

      setTimeout(async () => {
        try {
          if (hasReviewDecision(reviewDecisionId)) return;

          markReviewDecision(reviewDecisionId);

          await closeTicket(interaction.channel, reviewer, 'Auto-Close nach Review');
        } catch (e) {
          console.error('auto close after review error:', e.message);
        }
      }, 5 * 60 * 1000);

      return;
    }
  }
});


// ── Website API ───────────────────────────────────────────────────
const app = express();

app.use(cors({
  origin: WEBSITE_URL === '*' ? true : WEBSITE_URL
}));

app.use(express.json({ limit: '1mb' }));

function getDashboardToken(req) {
  const auth = req.get('authorization') || '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }

  return String(req.body?.token || req.query?.token || '').trim();
}

function requireDashboardAuth(req, res, next) {
  if (!DASHBOARD_PASSWORD) {
    return res.status(503).json({
      success: false,
      error: 'Dashboard ist nicht konfiguriert. Setze DASHBOARD_PASSWORD in Railway.'
    });
  }

  if (getDashboardToken(req) !== DASHBOARD_PASSWORD) {
    return res.status(401).json({
      success: false,
      error: 'Nicht eingeloggt.'
    });
  }

  next();
}

async function sendDashboardDm(userId, content) {
  const cleanContent = cleanDmContent(content);

  if (!/^\d{17,20}$/.test(String(userId))) {
    const err = new Error('Ungueltige Discord User-ID.');
    err.status = 400;
    throw err;
  }

  if (!cleanContent) {
    const err = new Error('Nachricht darf nicht leer sein.');
    err.status = 400;
    throw err;
  }

  const user = await client.users.fetch(userId).catch(() => null);
  if (!user) {
    const err = new Error('User wurde nicht gefunden.');
    err.status = 404;
    throw err;
  }

  const sent = await user.send(cleanContent);
  const saved = addDmThreadMessage({
    user,
    direction: 'out',
    content: cleanContent,
    discordMessageId: sent.id
  });

  return saved;
}

app.get('/dashboard', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/api/dashboard/status', (req, res) => {
  res.json({
    success: true,
    configured: Boolean(DASHBOARD_PASSWORD),
    bot: client.user ? client.user.tag : 'starting'
  });
});

app.post('/api/dashboard/login', (req, res) => {
  if (!DASHBOARD_PASSWORD) {
    return res.status(503).json({
      success: false,
      error: 'Setze DASHBOARD_PASSWORD in Railway.'
    });
  }

  if (String(req.body?.password || '') !== DASHBOARD_PASSWORD) {
    return res.status(401).json({
      success: false,
      error: 'Falsches Passwort.'
    });
  }

  return res.json({ success: true });
});

app.get('/api/dashboard/threads', requireDashboardAuth, (req, res) => {
  const data = loadData();
  const threads = Object.values(data.dmThreads || {})
    .map(thread => serializeDmThread(thread))
    .sort((a, b) => Number(b.lastMessageAt || 0) - Number(a.lastMessageAt || 0));

  res.json({ success: true, threads });
});

app.get('/api/dashboard/threads/:userId', requireDashboardAuth, (req, res) => {
  const userId = String(req.params.userId || '').trim();
  const data = loadData();
  const thread = data.dmThreads?.[userId];

  if (!thread) {
    return res.status(404).json({
      success: false,
      error: 'Thread nicht gefunden.'
    });
  }

  thread.unreadCount = 0;
  saveData(data);

  res.json({
    success: true,
    thread: serializeDmThread(thread, true)
  });
});

app.post('/api/dashboard/threads/:userId/messages', requireDashboardAuth, async (req, res) => {
  try {
    const saved = await sendDashboardDm(String(req.params.userId || '').trim(), req.body?.content);
    const data = loadData();
    const thread = data.dmThreads?.[String(req.params.userId || '').trim()];

    return res.json({
      success: true,
      message: saved?.message || null,
      thread: thread ? serializeDmThread(thread, true) : null
    });
  } catch (e) {
    return res.status(e.status || 500).json({
      success: false,
      error: e.status ? e.message : 'DM konnte nicht gesendet werden.'
    });
  }
});

app.post('/api/dashboard/dm', requireDashboardAuth, async (req, res) => {
  try {
    const userId = String(req.body?.userId || '').trim();
    await sendDashboardDm(userId, req.body?.content);

    const data = loadData();
    const thread = data.dmThreads?.[userId];

    return res.json({
      success: true,
      thread: thread ? serializeDmThread(thread, true) : null
    });
  } catch (e) {
    return res.status(e.status || 500).json({
      success: false,
      error: e.status ? e.message : 'DM konnte nicht gesendet werden.'
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    bot: client.user ? client.user.tag : 'starting',
    guildId: GUILD_ID
  });
});

app.get('/api/stock', (req, res) => {
  try {
    const data = loadData();

    const stock = STOCK_ITEMS.map(item => ({
      id: item.id,
      name: item.name,
      emoji: item.emoji,
      emojiId: item.emojiId,
      price: item.price,
      amount: data.stock[item.id] ?? 0
    }));

    return res.json({
      success: true,
      stock
    });
  } catch (e) {
    console.error('api stock error:', e.message);
    return res.status(500).json({
      success: false,
      error: 'Stock konnte nicht geladen werden.'
    });
  }
});

app.post('/api/order', async (req, res) => {
  try {
    const {
      discordId,
      username,
      items,
      total,
      paymentMethod,
      note
    } = req.body;

    if (!discordId || !/^\d{17,20}$/.test(String(discordId))) {
      return res.status(400).json({
        success: false,
        error: 'Bitte gib eine gültige Discord User-ID an.'
      });
    }

    if (!username || String(username).trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Bitte gib deinen Namen an.'
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Der Warenkorb ist leer.'
      });
    }

    const guild = client.guilds.cache.get(GUILD_ID);

    if (!guild) {
      return res.status(500).json({
        success: false,
        error: 'Discord Server wurde nicht gefunden.'
      });
    }

    const cleanName = cleanUsername(username);
    const ticketOrderId = getNextTicketOrderId();
    const ticketName = `order-${ticketOrderId}-${cleanName}`.slice(0, 100);

    const existing = guild.channels.cache.find(c =>
      c.name === ticketName || c.name === `closed-${ticketName}`
    );

    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Für diese Bestellung existiert bereits ein Ticket.',
        ticketUrl: `https://discord.com/channels/${guild.id}/${existing.id}`
      });
    }

    const ticket = await guild.channels.create({
      name: ticketName,
      type: ChannelType.GuildText,
      parent: TICKET_CATEGORY_ID,
      topic: `owner:${discordId};type:bestellung;order:${ticketOrderId}`,
      permissionOverwrites: [
        { id: guild.id, deny: ['ViewChannel'] },
        { id: discordId, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
        ...STAFF_ROLE_IDS.map(roleId => ({
          id: roleId,
          allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
        })),
        {
          id: client.user.id,
          allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageChannels']
        }
      ]
    });

    const itemLines = items.map(item => {
      const name = String(item.name || 'Unbekanntes Item').slice(0, 80);
      const qty = Number(item.quantity || item.qty || 1);
      const price = String(item.price || 'Unbekannt').slice(0, 40);
      return `• **${name}** x${qty} — ${price}`;
    }).join('\n');

    const embed = new EmbedBuilder()
      .setColor('#b10de7')
      .setTitle(`🛒 Website-Bestellung #${ticketOrderId}`)
      .setDescription(
        `**Käufer:** <@${discordId}>\n` +
        `**Name:** ${String(username).slice(0, 80)}\n` +
        `**Zahlungsmethode:** ${paymentMethod ? String(paymentMethod).slice(0, 80) : 'Nicht angegeben'}\n` +
        `**Gesamt:** ${total ? String(total).slice(0, 40) : 'Unbekannt'}\n\n` +
        `**Produkte:**\n${itemLines}\n\n` +
        `**Notiz:** ${note ? String(note).slice(0, 500) : 'Keine'}`
      )
      .setFooter({ text: 'Erstellt über die Website' })
      .setTimestamp();

    const closeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('close_ticket')
        .setLabel('Ticket schließen')
        .setEmoji('🔒')
        .setStyle(ButtonStyle.Danger)
    );

    await ticket.send({
      content: `<@${discordId}> <@&${STAFF_ROLE_IDS[0]}> <@&${STAFF_ROLE_IDS[1]}>`,
      embeds: [embed],
      components: [closeRow]
    });

    return res.json({
      success: true,
      ticketId: ticket.id,
      ticketUrl: `https://discord.com/channels/${guild.id}/${ticket.id}`
    });
  } catch (e) {
    console.error('api order error:', e);

    return res.status(500).json({
      success: false,
      error: 'Bestellung konnte nicht erstellt werden.'
    });
  }
});

app.listen(PORT, () => {
  console.log(`🌐 Website API läuft auf Port ${PORT}`);
});

client.login(TOKEN);
