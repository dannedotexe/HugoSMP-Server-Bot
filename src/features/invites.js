'use strict';

// Einladungen: Belohnungen, Rangliste, /setinvites
// Aus index.js ausgelagert; gemeinsame Hilfsfunktionen kommen über ctx.

module.exports = function createInvites(ctx) {
  const {
    ActionRowBuilder,
    BrandEmbed,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    REQUIRED_INVITES,
    REWARD,
    REWARD_LOG_ID,
    RULES_CHANNEL_ID,
    STAFF_ROLE_IDS,
    TICKET_CATEGORY_ID,
    buildLeaderboardEmbed,
    buildPanel,
    cachedInvites,
    cleanUsername,
    client,
    getInvites,
    setInvites,
    updateLeaderboard,
  } = ctx;

  async function command(interaction) {
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
  }

  async function button(interaction) {
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

        const ticketEmbed = new BrandEmbed()
          .setTitle('Reward einlösen')
          .setDescription(`Glückwunsch! Dein Reward: **${REWARD}**`)
          .addFields(
            {
              name: '1 · Menge berechnen',
              value: 'Reward ÷ Ancient-Wert = Menge\n-# Beispiel: 5 Mio ÷ 40k = 125 Stück'
            },
            {
              name: '2 · Order ingame erstellen',
              value: 'Menge laut Rechnung, Preis **1 $** pro Stück\n-# Steuern fallen praktisch keine an'
            },
            {
              name: '3 · Hier melden',
              value: 'Schreib uns deinen **Ingame-Namen** und „Order ist drin“.'
            }
          )
          .setTimestamp();

        const closeRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('Ticket schließen')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Secondary)
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
  }

  return {
    name: 'invites',
    commands: ["inviterewards","leaderboard","setinvites"],
    buttons: [/^gen_invite$/, /^check_inv$/, /^claim$/],
    command,
    button,
  };
};
