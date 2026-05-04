const {
  Client, GatewayIntentBits, EmbedBuilder,
  ButtonBuilder, ButtonStyle, ActionRowBuilder,
  REST, Routes, SlashCommandBuilder, PermissionFlagsBits,
  ChannelType
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
const REQUIRED_INVITES = 8;
const REWARD = '$1m on HugoSMP';
const DATA_FILE = './data.json';

const RULES_CHANNEL_ID = '1499135456133255239';
const VERIFY_ROLE_ID = '1499149656951885956';
const REWARD_LOG_ID = '1500479671031169144';

const TICKET_CATEGORY_ID = '1499147835528974356';
const STAFF_ROLE_IDS = [
  '1499146219946250241',
  '1499159379902074880'
];

const MIN_ACCOUNT_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// ── Data helpers ──────────────────────────────────────────────────
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('loadData error:', e.message);
  }

  return { invites: {}, counted: [], pending: {} };
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

// ── Register slash commands ───────────────────────────────────────
async function registerCommands(guildId) {
  const rest = new REST({ version: '10' }).setToken(TOKEN);

  const commands = [
    new SlashCommandBuilder()
      .setName('setupinviterewards')
      .setDescription('Send the invite rewards panel to this channel. (Admin only)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
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
      .setName('setinvites')
      .setDescription('Manually set invite count for a user. (Admin only)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption(opt =>
        opt.setName('user')
          .setDescription('The user')
          .setRequired(true)
      )
      .addIntegerOption(opt =>
        opt.setName('amount')
          .setDescription('New invite count')
          .setRequired(true)
          .setMinValue(0)
      )
      .toJSON(),
  ];

  await rest.put(
    Routes.applicationGuildCommands(client.user.id, guildId),
    { body: commands }
  );

  console.log(`✅ Commands registered for guild ${guildId}`);
}

// ── Panel builder ─────────────────────────────────────────────────
function buildPanel() {
  const embed = new EmbedBuilder()
    .setColor(0x1e1f22)
    .setTitle('🎁 Invite Rewards')
    .setDescription(
      'Invite your friends to the server to earn rewards!\n\n' +
      `**Goal:** ${REQUIRED_INVITES} Verified Invites\n` +
      `**Reward:** ${REWARD}\n\n` +
      'Click the buttons below to generate your personal link or check your progress.'
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

  return { embeds: [embed], components: [row] };
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
});

client.on('guildCreate', async guild => {
  try {
    await registerCommands(guild.id);
    await cacheInvites(guild);
    console.log(`✅ Joined new guild: ${guild.name}`);
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

client.on('inviteDelete', inv => cachedInvites.delete(inv.code));

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

// ── Verify role assigned → count invite ──────────────────────────
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

    console.log(
      `✅ ${newMember.user.tag} verified — invite counted for ${inviterId} (total: ${total})`
    );

    try {
      const inviter = await newMember.guild.members.fetch(inviterId);

      await inviter.send(
        `🎉 **${newMember.user.tag}** just verified on **${newMember.guild.name}**!\n\n` +
        `You now have **${total}/${REQUIRED_INVITES}** verified invites.\n` +
        (total >= REQUIRED_INVITES
          ? `✅ You can now claim your reward **${REWARD}**!`
          : `⏳ **${REQUIRED_INVITES - total}** more to claim your million!`)
      );
    } catch (e) {
      console.log(`⚠️ Could not DM inviter ${inviterId}: ${e.message}`);
    }
  } catch (e) {
    console.error('guildMemberUpdate error:', e.message);
  }
});

// ── Interactions ──────────────────────────────────────────────────
client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'setupinviterewards') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          content: '❌ You need Administrator permissions!',
          ephemeral: true
        });
      }

      await interaction.channel.send(buildPanel());

      return interaction.reply({
        content: '✅ Invite Rewards panel sent!',
        ephemeral: true
      });
    }

    if (interaction.commandName === 'inviterewards') {
      return interaction.reply(buildPanel());
    }

    if (interaction.commandName === 'leaderboard') {
      await interaction.deferReply();

      const data = loadData();

      const sorted = Object.entries(data.invites)
        .filter(([, v]) => v > 0)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10);

      if (sorted.length === 0) {
        return interaction.editReply('📊 No invites recorded yet!');
      }

      const medals = ['🥇', '🥈', '🥉'];

      const lines = sorted.map(([userId, count], i) =>
        `${medals[i] ?? `**${i + 1}.**`} <@${userId}> — **${count}** invite${count === 1 ? '' : 's'}`
      ).join('\n');

      const embed = new EmbedBuilder()
        .setColor(0x7c3aed)
        .setTitle('🏆 Invite Leaderboard')
        .setDescription(lines)
        .setFooter({
          text: `Goal: ${REQUIRED_INVITES} verified invites → ${REWARD}`
        });

      return interaction.editReply({ embeds: [embed] });
    }

    if (interaction.commandName === 'setinvites') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          content: '❌ You need Administrator permissions!',
          ephemeral: true
        });
      }

      const user = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');

      setInvites(user.id, amount);

      return interaction.reply({
        content: `✅ Set invite count for <@${user.id}> to **${amount}**.`,
        ephemeral: true
      });
    }
  }

  if (!interaction.isButton()) return;

  if (interaction.customId === 'gen_invite') {
    await interaction.deferReply({ ephemeral: true });

    try {
      const rulesChannel =
        interaction.guild.channels.cache.get(RULES_CHANNEL_ID) ??
        interaction.guild.channels.cache.find(c => c.name === 'rules') ??
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
        `Make sure your friends **verify** after joining, otherwise they won't count towards your goal!`
      );
    } catch (e) {
      console.error('gen_invite error:', e.message);
      return interaction.editReply('❌ Could not create invite. Missing permissions?');
    }
  }

  if (interaction.customId === 'check_inv') {
    await interaction.deferReply({ ephemeral: true });

    const count = getInvites(interaction.user.id);

    return interaction.editReply(
      `📊 You currently have **${count}** verified invite${count === 1 ? '' : 's'}!\n\n` +
      `*(Only users who join using your personal link and verify will count.)*`
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

    const existingTicket = interaction.guild.channels.cache.find(
      c => c.name === ticketName
    );

    if (existingTicket) {
      return interaction.editReply(
        `❌ You already have an open ticket: <#${existingTicket.id}>`
      );
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

    const closeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('close_ticket')
        .setLabel('Close Ticket')
        .setEmoji('🔒')
        .setStyle(ButtonStyle.Danger)
    );

    await ticket.send({
      content:
        `💰 <@${interaction.user.id}> claimed **${REWARD}** with **${count} verified invites**!\n\n` +
        `<@&${STAFF_ROLE_IDS[0]}> <@&${STAFF_ROLE_IDS[1]}>\n\n` +
        `Please process this reward.`,
      components: [closeRow]
    });

    setInvites(interaction.user.id, count - REQUIRED_INVITES);

    const remaining = count - REQUIRED_INVITES;

    const log = interaction.guild.channels.cache.get(REWARD_LOG_ID);

    if (log) {
      await log.send(
        `💰 **${interaction.user.tag}** (<@${interaction.user.id}>) claimed **${REWARD}** with **${count} verified invites**!\n` +
        `🎫 Ticket: <#${ticket.id}>\n` +
        `📊 Remaining invites: **${remaining}**`
      );
    }

    return interaction.editReply(
      `✅ Ticket created: <#${ticket.id}>\n📊 Remaining invites: **${remaining}**`
    );
  }

  if (interaction.customId === 'close_ticket') {
    const isStaff = STAFF_ROLE_IDS.some(roleId =>
      interaction.member.roles.cache.has(roleId)
    );

    if (!isStaff) {
      return interaction.reply({
        content: '❌ Only staff can close this ticket.',
        ephemeral: true
      });
    }

    await interaction.reply({
      content: '🔒 Ticket will be closed in 3 seconds...',
      ephemeral: true
    });

    setTimeout(async () => {
      try {
        await interaction.channel.delete();
      } catch (e) {
        console.error('Ticket delete error:', e.message);
      }
    }, 3000);
  }
});

client.login(TOKEN);
