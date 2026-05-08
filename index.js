const {
  Client, GatewayIntentBits, EmbedBuilder,
  ButtonBuilder, ButtonStyle, ActionRowBuilder,
  REST, Routes, SlashCommandBuilder, PermissionFlagsBits,
  ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');

const fs = require('fs');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildMembers,
  ]
});

const TOKEN = process.env.DISCORD_TOKEN;
const DATA_FILE = '/app/data/data.json';
const REVIEWS_CHANNEL_ID = '1499131549826813962';
const KUNDEN_ROLE_ID = '1499472189420732421';

const REQUIRED_INVITES = 8;
const REWARD = '$1m on HugoSMP';
const RULES_CHANNEL_ID = '1499135456133255239';
const VERIFY_ROLE_ID = '1499149656951885956';
const REWARD_LOG_ID = '1500479671031169144';
const LEADERBOARD_CHANNEL_ID = '1499132426947919903';
const TICKET_CATEGORY_ID = '1499147835528974356';
const STOCK_CHANNEL_ID = '1502271613968846878';

const STAFF_ROLE_IDS = [
  '1499146219946250241',
  '1499159379902074880'
];

const MIN_ACCOUNT_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const STOCK_ITEMS = [
  { id: 'money', name: '1M Money', emoji: '<:Money:1502281700774772908>', emojiId: '1502281700774772908', price: '1,50 €' },
  { id: 'elytra', name: 'Elytra', emoji: '<:Elytra:1502281765492883497>', emojiId: '1502281765492883497', price: '110 €' },
  { id: 'mace', name: 'Mace mit Windburst I', emoji: '<:Mace:1502281825131692163>', emojiId: '1502281825131692163', price: '1,50 €' },
  { id: 'deepslate', name: 'Deepslate Emerald Ore', emoji: '<:DeepslateEmeraldOre:1502281747667353610>', emojiId: '1502281747667353610', price: '0,70 €' },
  { id: 'ancient', name: 'Ancient Debris', emoji: '<:Ancient:1502281804780933293>', emojiId: '1502281804780933293', price: '0,08 €' },
  { id: 'gilded', name: 'Gilded Blackstone', emoji: '<:GildedBlackstone:1502281854051680469>', emojiId: '1502281854051680469', price: '0,04 €' },
];

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

      if (!data.stock) data.stock = {};

      STOCK_ITEMS.forEach(item => {
        if (typeof data.stock[item.id] !== 'number') data.stock[item.id] = 0;
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

          if (data.stockButtonsMessageId) {
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
      'Normale Discord Einladungslinks zählen **NICHT**.'
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

  await updateLeaderboard();

  setInterval(updateLeaderboard, 5 * 60 * 1000);
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

client.on('guildMemberAdd', async member => {
  try {
    const accountAge = Date.now() - member.user.createdTimestamp;

    if (accountAge < MIN_ACCOUNT_AGE_MS) return;
    if (hasBeenCounted(member.id)) return;

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

    if (usedInviterId === member.id) return;

    if (usedInviterId) {
      setPending(member.id, usedInviterId);
      console.log(`📥 ${member.user.tag} joined via ${usedCode}`);
    }

  } catch (e) {
    console.error('guildMemberAdd error:', e.message);
  }
});

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

    addInvite(inviterId);

    await updateLeaderboard();

  } catch (e) {
    console.error('guildMemberUpdate error:', e.message);
  }
});

const reviewedUsers = new Set();
  }

  if (interaction.isButton()) {

    if (interaction.customId === 'verify_member') {
      try {
        await interaction.member.roles.add(VERIFY_ROLE_ID);

        return interaction.reply({
          content: '✅ Du wurdest erfolgreich verifiziert!',
          ephemeral: true
        });
      } catch (e) {
        return interaction.reply({
          content: '❌ Rolle konnte nicht vergeben werden.',
          ephemeral: true
        });
      }
    }

    if (interaction.customId === 'create_ticket') {

      const ticketName = `ticket-${interaction.user.username}`
        .toLowerCase()
        .replace(/[^a-z0-9-_]/g, '');

      const existing = interaction.guild.channels.cache.find(
        c => c.name === ticketName
      );

      if (existing) {
        return interaction.reply({
          content: `❌ Du hast bereits ein Ticket: <#${existing.id}>`,
          ephemeral: true
        });
      }

      const ticket = await interaction.guild.channels.create({
        name: ticketName,
        type: ChannelType.GuildText,
        parent: TICKET_CATEGORY_ID,
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
          }))
        ]
      });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('close_ticket')
          .setLabel('Ticket schließen')
          .setEmoji('🔒')
          .setStyle(ButtonStyle.Danger)
      );

      await ticket.send({
        content: `<@${interaction.user.id}> Willkommen beim Support!\nBitte beschreibe dein Anliegen.`,
        components: [row]
      });

      return interaction.reply({
        content: `✅ Ticket erstellt: <#${ticket.id}>`,
        ephemeral: true
      });
    }

    if (interaction.customId === 'close_ticket') {

      const isStaff = STAFF_ROLE_IDS.some(roleId =>
        interaction.member.roles.cache.has(roleId)
      );

      if (!isStaff) {
        return interaction.reply({
          content: '❌ Nur Staff kann Tickets schließen.',
          ephemeral: true
        });
      }

      await interaction.reply({
        content: '🔒 Ticket wird geschlossen...',
        ephemeral: true
      });

      setTimeout(async () => {
        try {
          await interaction.channel.delete();
        } catch {}
      }, 3000);
    }
  }
});

client.login(TOKEN);
