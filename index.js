const {
  Client, GatewayIntentBits, EmbedBuilder,
  ButtonBuilder, ButtonStyle, ActionRowBuilder,
  REST, Routes, SlashCommandBuilder, PermissionFlagsBits
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
const TOKEN              = process.env.DISCORD_TOKEN;
const REQUIRED_INVITES   = 8;
const REWARD             = '$1m on HugoSMP';
const DATA_FILE          = './data.json';
const RULES_CHANNEL_ID   = '1499135456133255239';
const VERIFY_ROLE_ID     = '1499149656951885956';
const REWARD_LOG_ID      = '1500479671031169144';
const MIN_ACCOUNT_AGE_MS = 1 * 24 * 60 * 60 * 1000; // 1 day

// ── Data helpers ──────────────────────────────────────────────────
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) { console.error('loadData error:', e.message); }
  return { invites: {}, counted: [], pending: {} };
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (e) { console.error('saveData error:', e.message); }
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

function resetInvites(userId) {
  setInvites(userId, 0);
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
  } catch (e) { console.error('cacheInvites error:', e.message); }
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
      .addUserOption(opt => opt.setName('user').setDescription('The user').setRequired(true))
      .addIntegerOption(opt => opt.setName('amount').setDescription('New invite count').setRequired(true).setMinValue(0))
      .toJSON(),
  ];
  await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: commands });
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
    new ButtonBuilder().setCustomId('gen_invite').setLabel('Generate Invite Link').setEmoji('🔗').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('check_inv').setLabel('Check Invites').setEmoji('📊').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('claim').setLabel(`Claim ${REWARD}`).setEmoji('💰').setStyle(ButtonStyle.Success),
  );

  return { embeds: [embed], components: [row] };
}

// ── Events ────────────────────────────────────────────────────────
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  for (const guild of client.guilds.cache.values()) {
    try {
      await registerCommands(guild.id);
      await cacheInvites(guild);
    } catch (e) { console.error(`Guild error (${guild.name}):`, e); }
  }
});

client.on('guildCreate', async guild => {
  try {
    await registerCommands(guild.id);
    await cacheInvites(guild);
  } catch (e) { console.error('guildCreate error:', e.message); }
});

client.on('inviteCreate', inv => {
  cachedInvites.set(inv.code, { inviterId: inv.inviter?.id ?? null, uses: inv.uses ?? 0 });
});

client.on('inviteDelete', inv => cachedInvites.delete(inv.code));

client.on('guildMemberAdd', async member => {
  try {
    const accountAge = Date.now() - member.user.createdTimestamp;
    if (accountAge < MIN_ACCOUNT_AGE_MS) return;
    if (hasBeenCounted(member.id)) return;

    const newInvites = await member.guild.invites.fetch();
    let usedInviterId = null;

    newInvites.forEach(inv => {
      const cached = cachedInvites.get(inv.code);
      if (cached && inv.uses > cached.uses) usedInviterId = cached.inviterId;
    });

    newInvites.forEach(inv => {
      cachedInvites.set(inv.code, { inviterId: inv.inviter?.id ?? null, uses: inv.uses ?? 0 });
    });

    if (usedInviterId && usedInviterId !== member.id) {
      setPending(member.id, usedInviterId);
    }
  } catch (e) { console.error('guildMemberAdd error:', e.message); }
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
  try {
    const gotVerifyRole = !oldMember.roles.cache.has(VERIFY_ROLE_ID) && newMember.roles.cache.has(VERIFY_ROLE_ID);
    if (!gotVerifyRole) return;

    const inviterId = getPending(newMember.id);
    if (!inviterId) return;

    markAsCounted(newMember.id);
    removePending(newMember.id);

    const total = addInvite(inviterId);
    const inviter = await newMember.guild.members.fetch(inviterId).catch(() => null);
    if (inviter) {
      inviter.send(`✅ **${newMember.user.username}** has verified! You now have **${total}** invites.`).catch(() => null);
    }
  } catch (e) { console.error('guildMemberUpdate error:', e.message); }
});

// ── Interaction Handler ───────────────────────────────────────────
client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'setupinviterewards') {
      await interaction.reply({ content: 'Panel sent!', ephemeral: true });
      await interaction.channel.send(buildPanel());
    }
    if (interaction.commandName === 'inviterewards') {
      await interaction.reply({ ...buildPanel(), ephemeral: true });
    }
    if (interaction.commandName === 'leaderboard') {
      const data = loadData();
      const sorted = Object.entries(data.invites).sort(([, a], [, b]) => b - a).slice(0, 10);
      const lb = sorted.map(([id, count], i) => `${i + 1}. <@${id}> — **${count}**`).join('\n') || 'No data.';
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🏆 Leaderboard').setDescription(lb).setColor(0x1e1f22)] });
    }
    if (interaction.commandName === 'setinvites') {
      const target = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      setInvites(target.id, amount);
      await interaction.reply({ content: `Set **${target.tag}** to **${amount}** invites.`, ephemeral: true });
    }
  }

  if (interaction.isButton()) {
    if (interaction.customId === 'gen_invite') {
      const channel = interaction.guild.rulesChannel || interaction.channel;
      const inv = await channel.createInvite({ maxAge: 0, unique: true });
      await interaction.reply({ content: `Your link: ${inv.url}`, ephemeral: true });
    }
    if (interaction.customId === 'check_inv') {
      await interaction.reply({ content: `You have **${getInvites(interaction.user.id)}** invites.`, ephemeral: true });
    }
    if (interaction.customId === 'claim') {
      const count = getInvites(interaction.user.id);
      if (count < REQUIRED_INVITES) {
        return interaction.reply({ content: `❌ You need ${REQUIRED_INVITES} invites (You have ${count}).`, ephemeral: true });
      }
      const logChannel = interaction.guild.channels.cache.get(REWARD_LOG_ID);
      if (logChannel) logChannel.send(`💰 **CLAIM**: <@${interaction.user.id}> requested ${REWARD} (${count} invites).`);
      resetInvites(interaction.user.id);
      await interaction.reply({ content: `✅ Claim registered! An admin will contact you.`, ephemeral: true });
    }
  }
});

client.login(TOKEN);
