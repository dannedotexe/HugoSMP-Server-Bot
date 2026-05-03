const { Client, GatewayIntentBits, EmbedBuilder,
        ButtonBuilder, ButtonStyle, ActionRowBuilder,
        REST, Routes, SlashCommandBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildMembers,
  ]
});

const TOKEN = process.env.DISCORD_TOKEN;
const REQUIRED_INVITES = 8;
const REWARD = '$1m auf HugoSMP';

// Register slash command
client.once('ready', async () => {
  console.log(`✅ Bot online als ${client.user.tag}`);
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  const commands = [
    new SlashCommandBuilder()
      .setName('inviterewards')
      .setDescription('Lade Freunde ein und verdiene Belohnungen!')
      .toJSON()
  ];
  for (const guild of client.guilds.cache.values()) {
    await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), { body: commands });
  }
  console.log('✅ Commands registriert!');
});

client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand() && interaction.commandName === 'inviterewards') {
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle('🎁 Invite Rewards')
      .setDescription('Lade deine Freunde ein und verdiene Belohnungen!')
      .addFields(
        { name: '**Goal**', value: `${REQUIRED_INVITES} Verified Invites`, inline: true },
        { name: '**Reward**', value: REWARD, inline: true },
      )
      .setFooter({ text: 'Klicke unten um deinen Link zu erstellen oder Fortschritt zu prüfen.' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('gen_invite').setLabel('Generate Invite Link').setEmoji('🔗').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('check_inv').setLabel('Check Invites').setEmoji('📊').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('claim').setLabel(`Claim ${REWARD}`).setEmoji('💰').setStyle(ButtonStyle.Success),
    );
    return interaction.reply({ embeds: [embed], components: [row] });
  }

  if (interaction.isButton()) {
    if (interaction.customId === 'gen_invite') {
      await interaction.deferReply({ ephemeral: true });
      const invite = await interaction.channel.createInvite({ maxAge: 0, maxUses: 0, unique: true });
      return interaction.editReply(`🔗 **Dein Invite-Link:**\nhttps://discord.gg/${invite.code}`);
    }

    if (interaction.customId === 'check_inv') {
      await interaction.deferReply({ ephemeral: true });
      const invites = await interaction.guild.invites.fetch();
      let count = 0;
      invites.forEach(inv => { if (inv.inviter?.id === interaction.user.id) count += inv.uses ?? 0; });
      const bar = '█'.repeat(Math.min(count, REQUIRED_INVITES)) + '░'.repeat(Math.max(0, REQUIRED_INVITES - count));
      return interaction.editReply(`📊 **Deine Invites:**\n${bar} **${count}/${REQUIRED_INVITES}**\n\n${count >= REQUIRED_INVITES ? '✅ Bereit zum Claimen!' : `⏳ Noch ${REQUIRED_INVITES - count} fehlend`}`);
    }

    if (interaction.customId === 'claim') {
      await interaction.deferReply({ ephemeral: true });
      const invites = await interaction.guild.invites.fetch();
      let count = 0;
      invites.forEach(inv => { if (inv.inviter?.id === interaction.user.id) count += inv.uses ?? 0; });
      if (count < REQUIRED_INVITES) return interaction.editReply(`❌ Nicht genug Invites! **${count}/${REQUIRED_INVITES}**`);
      await interaction.editReply(`✅ **Reward geclaimed!** Du erhältst: **${REWARD}**\nEin Admin wird sich melden!`);
      const log = interaction.guild.channels.cache.find(c => c.name === 'reward-log');
      if (log) log.send(`💰 **${interaction.user.tag}** hat **${REWARD}** mit ${count} Invites geclaimed!`);
    }
  }
});

client.login(TOKEN);
