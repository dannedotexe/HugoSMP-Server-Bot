const {
  Client, GatewayIntentBits, EmbedBuilder,
  ButtonBuilder, ButtonStyle, ActionRowBuilder,
  REST, Routes, SlashCommandBuilder, PermissionFlagsBits,
  ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle,
  AttachmentBuilder
} = require('discord.js');

const fs = require('fs'); 
const express = require('express');
const cors = require('cors');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

// ── Config ────────────────────────────────────────────────────────
const TOKEN = process.env.DISCORD_TOKEN;
const DATA_FILE = '/app/data/data.json';
const PORT = process.env.PORT || 3000;
const WEBSITE_URL = process.env.WEBSITE_URL || '*';
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
      data.reviewTicketDecisions = data.reviewTicketDecisions || [];
      data.orderFormsSubmitted = data.orderFormsSubmitted || {};

      if (!data.stock) data.stock = {};

      STOCK_ITEMS.forEach(item => {
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

    stock: {}
  };

  STOCK_ITEMS.forEach(item => {
    initial.stock[item.id] = 0;
  });

  return initial;
}

function saveData(data) {
  try {
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
function buildLeaderboardEmbed() {
  const data = loadData();
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

async function updateLeaderboard() {
  try {
    const channel = client.channels.cache.get(LEADERBOARD_CHANNEL_ID);
    if (!channel) return;

    const data = loadData();
    const embed = buildLeaderboardEmbed();

    if (data.leaderboardMessageId) {
      try {
        const msg = await channel.messages.fetch(data.leaderboardMessageId);
        await msg.edit({ embeds: [embed] });
        return;
      } catch (e) {}
    }

    const msg = await channel.send({ embeds: [embed] });
    data.leaderboardMessageId = msg.id;
    saveData(data);
  } catch (e) {
    console.error('updateLeaderboard error:', e.message);
  }
}

// ── Stock ─────────────────────────────────────────────────────────
function buildStockEmbed() {
  const data = loadData();

  const lines = STOCK_ITEMS.map(item => {
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

  for (let i = 0; i < STOCK_ITEMS.length; i++) {
    const item = STOCK_ITEMS[i];

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`stock_minus10_${item.id}`)
        .setLabel('-10')
        .setStyle(ButtonStyle.Danger),

      new ButtonBuilder()
        .setCustomId(`stock_minus1_${item.id}`)
        .setLabel('-1')
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId(`stock_set_${item.id}`)
        .setLabel(item.name)
        .setEmoji({ id: item.emojiId })
        .setStyle(ButtonStyle.Primary),

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

          if (data.stockButtonsMessageId && rows.length > 5) {
            const buttonsMsg = await channel.messages.fetch(data.stockButtonsMessageId);

            await buttonsMsg.edit({
              content: '‎',
              components: rows.slice(5)
            });
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

  for (const guild of client.guilds.cache.values()) {
    try {
      await registerCommands(guild.id);
      await cacheInvites(guild);
    } catch (e) {
      console.error(`Guild error (${guild.name}):`, e);
    }
  }

  await updateStockPanel();
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
  } catch (e) {
    console.error('guildMemberAdd error:', e.message);
  }
});

// ── Verify role gives invite count ────────────────────────────────
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
          '⬇️ Wähle aus, ob du eine **Bestellung** oder **Support** brauchst.'
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('create_order_ticket')
          .setLabel('Bestellung')
          .setEmoji('🛒')
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
        const msg = await interaction.channel.send({
          embeds: [buildLeaderboardEmbed()]
        });

        const data = loadData();
        data.leaderboardMessageId = msg.id;
        saveData(data);

        return interaction.editReply('✅ Live Leaderboard gesendet!');
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

    if (interaction.customId === 'create_order_ticket' || interaction.customId === 'create_support_ticket') {
      const isOrder = interaction.customId === 'create_order_ticket';
      const typeName = isOrder ? 'bestellung' : 'support';
      const displayName = isOrder ? 'Bestellung' : 'Support';

      const cleanName = cleanUsername(interaction.user.username);

      let ticketName;
      let ticketOrderId = null;

      if (isOrder) {
        ticketOrderId = getNextTicketOrderId();
        ticketName = `order-${ticketOrderId}-${cleanName}`.slice(0, 100);
      } else {
        ticketName = `support-${cleanName}`.slice(0, 100);
      }

      const existing = interaction.guild.channels.cache.find(c =>
        c.name === ticketName || c.name === `closed-${ticketName}`
      );

      if (existing) {
        return interaction.reply({
          content: `❌ Du hast bereits ein ${displayName}-Ticket: <#${existing.id}>`,
          ephemeral: true
        });
      }

      try {
        const ticket = await interaction.guild.channels.create({
          name: ticketName,
          type: ChannelType.GuildText,
          parent: TICKET_CATEGORY_ID,
          topic: `owner:${interaction.user.id};type:${typeName};order:${ticketOrderId || 'none'}`,
          permissionOverwrites: [
            {
              id: interaction.guild.id,
              deny: ['ViewChannel']
            },
            {
              id: interaction.user.id,
              allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
            },
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

        const ticketEmbed = new EmbedBuilder()
          .setColor('#b10de7')
          .setTitle(isOrder ? `🛒 Bestellung #${ticketOrderId}` : '🎫 Support')
          .setDescription(
            isOrder
              ? 'Willkommen! Bitte klicke unten auf **Bestellformular ausfüllen**.\n\nDu kannst danach noch weitere Infos in den Chat schreiben.'
              : 'Willkommen beim Support! Bitte beschreibe dein Anliegen so genau wie möglich.'
          )
          .setTimestamp();

        const ticketButtons = new ActionRowBuilder();

        if (isOrder) {
          ticketButtons.addComponents(
            new ButtonBuilder()
              .setCustomId('order_form')
              .setLabel('Bestellformular ausfüllen')
              .setEmoji('📝')
              .setStyle(ButtonStyle.Primary)
          );
        }

        ticketButtons.addComponents(
          new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('Ticket schließen')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Danger)
        );

        await ticket.send({
          content: `<@${interaction.user.id}> <@&${STAFF_ROLE_IDS[0]}> <@&${STAFF_ROLE_IDS[1]}>`,
          embeds: [ticketEmbed],
          components: [ticketButtons]
        });

        return interaction.reply({
          content: `✅ ${displayName}-Ticket erstellt: <#${ticket.id}>`,
          ephemeral: true
        });
      } catch (e) {
        console.error('create ticket error:', e);

        return interaction.reply({
          content: '❌ Fehler beim Erstellen des Tickets. Prüfe die Bot-Rechte.',
          ephemeral: true
        });
      }
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
        const item = STOCK_ITEMS.find(i => i.id === itemId);

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

      const item = STOCK_ITEMS.find(i => i.id === itemId);

      if (!item) {
        return interaction.editReply('❌ Item nicht gefunden.');
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

      const text = new TextInputBuilder()
        .setCustomId('text')
        .setLabel('Deine Bewertung')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('War alles schnell, kein Scam...')
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(stars),
        new ActionRowBuilder().addComponents(text)
      );

      return interaction.showModal(modal);
    }
  }

  if (interaction.isModalSubmit()) {

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
          `**Bewertet von:** **<@${reviewer.id}>**\n\n` +
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
