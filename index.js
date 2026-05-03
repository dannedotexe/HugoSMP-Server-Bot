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

const TOKEN = process.env.DISCORD_TOKEN;
const REQUIRED_INVITES = 8;
const REWARD = '$1m on HugoSMP';
const DATA_FILE = './data.json';

// ── Persistent storage ────────────────────────────────────────────
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {}
  return { invites: {} };
}
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}
function addInvite(userId) {
  const data = loadData();
  data.invites[userId] = (data.invites[userId] ?? 0) + 1;
  saveData(data);
}
function getInvites(userId) {
  return loadData().invites[userId] ?? 0;
}
function resetInvites(userId) {
  const data = loadData();
  data.invites[userId] = 0;
  saveData(data);
}

// ── Invite cache ──────────────────────────────────────────────────
const cachedInvites = new Map();

async function cacheInvites(guild) {
  const invites = await guild.invites.fetch();
  invites.forEach(inv => {
    cachedInvites.set(inv.code, {
      inviterId: inv.inviter?.id ?? null,
      uses: inv.uses ?? 0
    });
  });
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

// ── Ready ─────────────────────────────────────────────────────────
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

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
  ];

  for (const guild of client.guilds.cache.values()) {
    try {
      await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), { body: commands });
      await cacheInvites(guild);
      console.log(`✅ Ready in: ${guild.name}`);
    } catch (e) {
      console.error(`Guild error:`, e.message);
    }
  }
});

client.on('inviteCreate', inv => {
  cachedInvites.set(inv.code, { inviterId: inv.inviter?.id ?? null, uses: inv.uses ?? 0 });
});
client.on('inviteDelete', inv => cachedInvites.delete(inv.code));

// ── Member joins ──────────────────────────────────────────────────
client.on('guildMemberAdd', async member => {
  try {
    const newInvites = await member.guild.invites.fetch();
    let usedInviterId = null;

    newInvites.forEach(inv => {
      const cached = cachedInvites.get(inv.code);
      if (cached && inv.uses > cached.uses) {
        usedInviterId = cached.inviterId;
      }
    });

    newInvites.forEach(inv => {
      cachedInvites.set(inv.code, { inviterId: inv.inviter?.id ?? null, uses: inv.uses ?? 0 });
    });

    if (usedInviterId) {
      if (!client.pendingVerify) client.pendingVerify = new Map();
      client.pendingVerify.set(member.id, usedInviterId);
      console.log(`📥 ${member.user.tag} joined via ${usedInviterId}`);
    }
  } catch (e) {
    console.error('guildMemberAdd error:', e.message);
  }
});

// ── Member gets verified (role added) ────────────────────────────
client.on('guildMemberUpdate', (oldMember, newMember) => {
  if (!client.pendingVerify) return;
  const inviterId = client.pendingVerify.get(newMember.id);
  if (!inviterId) return;
  const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
  if (addedRoles.size > 0) {
    addInvite(inviterId);
    client.pendingVerify.delete(newMember.id);
    console.log(`✅ Invite counted for ${inviterId}: now ${getInvites(inviterId)} total`);
  }
});

// ── Interactions ──────────────────────────────────────────────────
client.on('interactionCreate', async interaction => {

  if (interaction.isChatInputCommand()) {

    // /setupinviterewards
    if (interaction.commandName === 'setupinviterewards') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ You need Administrator permissions!', ephemeral: true });
      }
      await interaction.channel.send(buildPanel());
      return interaction.reply({ content: '✅ Invite Rewards panel sent!', ephemeral: true });
    }

    // /inviterewards
    if (interaction.commandName === 'inviterewards') {
      return interaction.reply(buildPanel());
    }
  }

  if (interaction.isButton()) {

    if (interaction.customId === 'gen_invite') {
      await interaction.deferReply({ ephemeral: true });
      try {
        const invite = await interaction.channel.createInvite({ maxAge: 0, maxUses: 0, unique: true });
        cachedInvites.set(invite.code, { inviterId: interaction.user.id, uses: 0 });
        return interaction.editReply(
          `✅ Here is your personal invite link: https://discord.gg/${invite.code}\n\n` +
          `Make sure your friends **verify** after joining, otherwise they won't count towards your goal!`
        );
      } catch (e) {
        return interaction.editReply('❌ Could not create invite. Missing permissions?');
      }
    }

    if (interaction.customId === 'check_inv') {
      await interaction.deferReply({ ephemeral: true });
      const count = getInvites(interaction.user.id);
      return interaction.editReply(
        `📊 You currently have **${count}** verified invite${count === 1 ? '' : 's'}!\n\n` +
        `*(Remember: Only users who join using your personal link and verify their account will count)*`
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
      resetInvites(interaction.user.id);
      await interaction.editReply(
        `✅ **Reward claimed!** You will receive: **${REWARD}**\nAn admin will deliver your reward shortly!`
      );
      const log = interaction.guild.channels.cache.find(c => c.name === 'reward-log');
      if (log) log.send(`💰 **${interaction.user.tag}** (<@${interaction.user.id}>) claimed **${REWARD}** with **${count} verified invites**!`);
    }
  }
});

client.login(TOKEN);
