const {
  Client, GatewayIntentBits, EmbedBuilder,
  ButtonBuilder, ButtonStyle, ActionRowBuilder,
  REST, Routes, SlashCommandBuilder
} = require('discord.js');

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

// invite tracker: userId -> verifiedInviteCount
const verifiedInvites = new Map();
// inviteCode -> userId (who created it)
const inviteOwners = new Map();

// Cache invites on startup
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  // Register slash command in all guilds
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  const commands = [
    new SlashCommandBuilder()
      .setName('inviterewards')
      .setDescription('Invite your friends to earn rewards!')
      .toJSON()
  ];

  for (const guild of client.guilds.cache.values()) {
    try {
      await rest.put(
        Routes.applicationGuildCommands(client.user.id, guild.id),
        { body: commands }
      );
      // Cache existing invites
      const invites = await guild.invites.fetch();
      invites.forEach(inv => {
        if (inv.inviter) inviteOwners.set(inv.code, inv.inviter.id);
      });
    } catch (e) {
      console.error(`Error in guild ${guild.name}:`, e.message);
    }
  }
  console.log('✅ Commands registered & invites cached!');
});

// Track when new invites are created
client.on('inviteCreate', invite => {
  if (invite.inviter) inviteOwners.set(invite.code, invite.inviter.id);
});

// Track when invites are deleted
client.on('inviteDelete', invite => {
  inviteOwners.delete(invite.code);
});

// When a member joins — find which invite was used
client.on('guildMemberAdd', async member => {
  try {
    const newInvites = await member.guild.invites.fetch();
    // Find the invite whose uses increased
    newInvites.forEach(inv => {
      const ownerId = inviteOwners.get(inv.code);
      if (!ownerId) return;
      // We detect by comparing — simple approach: mark as pending verify
      // Store pending: member -> inviter
      if (!client.pendingVerify) client.pendingVerify = new Map();
      client.pendingVerify.set(member.id, ownerId);
    });
    // Update invite cache
    newInvites.forEach(inv => {
      if (inv.inviter) inviteOwners.set(inv.code, inv.inviter.id);
    });
  } catch (e) {
    console.error('guildMemberAdd error:', e.message);
  }
});

// When a member gets a role (verify) — count their invite
client.on('guildMemberUpdate', (oldMember, newMember) => {
  if (!client.pendingVerify) return;
  const inviterId = client.pendingVerify.get(newMember.id);
  if (!inviterId) return;

  // Check if new roles were added (verification)
  const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
  if (addedRoles.size > 0) {
    const current = verifiedInvites.get(inviterId) ?? 0;
    verifiedInvites.set(inviterId, current + 1);
    client.pendingVerify.delete(newMember.id);
    console.log(`✅ Verified invite counted for ${inviterId}: ${current + 1} total`);
  }
});

// Slash command + button handler
client.on('interactionCreate', async interaction => {

  // /inviterewards command
  if (interaction.isChatInputCommand() && interaction.commandName === 'inviterewards') {
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

    return interaction.reply({ embeds: [embed], components: [row] });
  }

  // Buttons
  if (interaction.isButton()) {

    // Generate Invite Link
    if (interaction.customId === 'gen_invite') {
      await interaction.deferReply({ ephemeral: true });
      try {
        const invite = await interaction.channel.createInvite({
          maxAge: 0,
          maxUses: 0,
          unique: true,
          reason: `Invite Rewards - ${interaction.user.tag}`
        });
        inviteOwners.set(invite.code, interaction.user.id);
        return interaction.editReply(
          `✅ Here is your personal invite link: https://discord.gg/${invite.code}\n\n` +
          `Make sure your friends **verify** after joining, otherwise they won't count towards your goal!`
        );
      } catch (e) {
        return interaction.editReply('❌ Could not create invite. Missing permissions?');
      }
    }

    // Check Invites
    if (interaction.customId === 'check_inv') {
      await interaction.deferReply({ ephemeral: true });
      const count = verifiedInvites.get(interaction.user.id) ?? 0;
      return interaction.editReply(
        `📊 You currently have **${count}** verified invite${count === 1 ? '' : 's'}!\n\n` +
        `*(Remember: Only users who join using your personal link and verify their account will count)*`
      );
    }

    // Claim Reward
    if (interaction.customId === 'claim') {
      await interaction.deferReply({ ephemeral: true });
      const count = verifiedInvites.get(interaction.user.id) ?? 0;

      if (count < REQUIRED_INVITES) {
        return interaction.editReply(
          `❌ You don't have enough verified invites yet!\n\n` +
          `**${count}/${REQUIRED_INVITES}** — You need **${REQUIRED_INVITES - count}** more.`
        );
      }

      // Reset count after claim
      verifiedInvites.set(interaction.user.id, 0);

      await interaction.editReply(
        `✅ **Reward claimed!** You will receive: **${REWARD}**\n` +
        `An admin will deliver your reward shortly!`
      );

      // Log in reward-log channel
      const log = interaction.guild.channels.cache.find(c => c.name === 'reward-log');
      if (log) {
        log.send(
          `💰 **${interaction.user.tag}** (<@${interaction.user.id}>) claimed **${REWARD}** ` +
          `with **${count} verified invites**!`
        );
      }
    }
  }
});

client.login(TOKEN);
