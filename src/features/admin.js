'use strict';

// Verwaltung: Panels aufstellen, /say, /embed, /clear, /botstatus, Website/Dashboard/Version
// Aus index.js ausgelagert; gemeinsame Hilfsfunktionen kommen über ctx.

module.exports = function createAdmin(ctx) {
  const {
    BOT_VERSION,
    BrandEmbed,
    DASHBOARD_URL,
    PermissionFlagsBits,
    applyConfiguredPresence,
    buildPanel,
    buildRolesPanel,
    buildTicketPanel,
    buildVerifyPanel,
    buildWebsitePanel,
    loadData,
    saveData,
    updateLeaderboard,
  } = ctx;

  async function command(interaction) {
    if (interaction.commandName === 'website') {
  const { embed, row } = buildWebsitePanel();

  await interaction.channel.send({
    embeds: [embed],
    components: [row]
  });

  return interaction.reply({
    content: '✅ Website-Post gesendet!',
    ephemeral: true
  });
}

    if (interaction.commandName === 'version') {
      return interaction.reply({
        content: `ℹ️ Bot-Version \`${BOT_VERSION}\``,
        ephemeral: true
      });
    }

    if (interaction.commandName === 'dashboard') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: 'Dafür brauchst du Administrator-Rechte.', ephemeral: true });
      }

      if (!DASHBOARD_URL) {
        return interaction.reply({
          content: 'Die Dashboard-Adresse ist nicht gesetzt. Trage `DASHBOARD_URL` in der `.env` auf dem Server ein.',
          ephemeral: true
        });
      }

      return interaction.reply({
        content:
          `Dashboard: ${DASHBOARD_URL}\n\n` +
          'Login ist dein `DASHBOARD_PASSWORD` aus der `.env` auf dem Server.',
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

    if (interaction.commandName === 'embed') {
      const title = interaction.options.getString('title');
      const text = interaction.options.getString('text');

      const embed = new BrandEmbed()
        .setColor('primary')
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
      const { embed, row } = buildRolesPanel();

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
      const { embed, row } = buildVerifyPanel(interaction.guild);

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
      const { embed, row } = buildTicketPanel();

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
  }

  return {
    name: 'admin',
    commands: ["website","version","dashboard","say","embed","clear","setuproles","setupverify","setuptickets","setupinviterewards","setupleaderboard","botstatus"],
    command,
  };
};
