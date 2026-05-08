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

// ── Config ────────────────────────────────────────────────────────
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
const reviewedUsers = new Set();

client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {

    if (interaction.commandName === 'say') {
      const text = interaction.options.getString('text');

      await interaction.channel.send(text);

      return interaction.reply({
        content: '✅ Nachricht gesendet!',
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
        .setTitle('Ticket Support')
        .setDescription(
          '**Create Ticket**\n\n' +
          '⬇️ Hier erstellst du ein Ticket für Fragen oder einen Einkauf'
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('create_ticket')
          .setLabel('Create')
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

    if (interaction.customId === 'verify_member') {
      try {
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

    if (interaction.customId === 'create_ticket') {
      const ticketName = `ticket-${interaction.user.username}`
        .toLowerCase()
        .replace(/[^a-z0-9-_]/g, '');

      const existing = interaction.guild.channels.cache.find(c => c.name === ticketName);

      if (existing) {
        return interaction.reply({
          content: `❌ Du hast bereits ein Ticket: <#${existing.id}>`,
          ephemeral: true
        });
      }

      try {
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
            })),
            {
              id: client.user.id,
              allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageChannels']
            }
          ]
        });

        const closeRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('Ticket schließen')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Danger)
        );

        await ticket.send({
          content: `<@${interaction.user.id}> Willkommen beim Support!\nBitte beschreibe dein Anliegen.`,
          components: [closeRow]
        });

        return interaction.reply({
          content: `✅ Ticket erstellt: <#${ticket.id}>`,
          ephemeral: true
        });
      } catch (e) {
        console.error('create_ticket error:', e);

        return interaction.reply({
          content: '❌ Fehler beim Erstellen des Tickets. Prüfe die Bot-Rechte.',
          ephemeral: true
        });
      }
    }

    if (interaction.customId.startsWith('stock_')) {
      const isStaff =
        STAFF_ROLE_IDS.some(r => interaction.member.roles.cache.has(r)) ||
        interaction.member.permissions.has(PermissionFlagsBits.Administrator);

      if (!isStaff) {
        return interaction.reply({
          content: '❌ Nur Admins können den Bestand bearbeiten!',
          ephemeral: true
        });
      }

      const parts = interaction.customId.split('_');
      const action = parts[1];
      const itemId = parts[2];

      if (action === 'set') {
        const item = STOCK_ITEMS.find(i => i.id === itemId);

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

      const ticketName = `1m-${interaction.user.username}`
        .toLowerCase()
        .replace(/[^a-z0-9-_]/g, '');

      const existingTicket =
        interaction.guild.channels.cache.find(c => c.name === ticketName);

      if (existingTicket) {
        return interaction.editReply(`❌ You already have an open ticket: <#${existingTicket.id}>`);
      }

      try {
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

    if (interaction.customId === 'close_ticket') {
      const isStaff =
        STAFF_ROLE_IDS.some(roleId =>
          interaction.member.roles.cache.has(roleId)
        ) ||
        interaction.member.permissions.has(PermissionFlagsBits.Administrator);

      if (!isStaff) {
        return interaction.reply({
          content: '❌ Nur Staff kann dieses Ticket schließen.',
          ephemeral: true
        });
      }

      await interaction.reply({
        content: '🔒 Ticket wird in 5 Sekunden geschlossen...',
        ephemeral: true
      });

      setTimeout(async () => {
        try {
          await interaction.channel.delete();
        } catch (e) {}
      }, 5000);
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

      if (reviewedUsers.has(buyerId)) {
        return interaction.reply({
          content: '❌ Du hast bereits eine Bewertung abgegeben!',
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

      reviewedUsers.add(buyerId);

      await interaction.reply({
        content:
          '✅ **Danke für deine Bewertung!**\n' +
          'Du hast die **Kunden-Rolle** erhalten.\n\n' +
          'Das Ticket wird in 10 Sekunden automatisch geschlossen...',
        ephemeral: true
      });

      setTimeout(async () => {
        try {
          await interaction.channel.delete();
        } catch (e) {}
      }, 10000);
    }
  }
});

client.login(TOKEN);
