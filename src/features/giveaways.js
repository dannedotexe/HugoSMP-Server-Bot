'use strict';

// Gewinnspiele: /giveaway und Teilnahme-Button
// Aus index.js ausgelagert; gemeinsame Hilfsfunktionen kommen über ctx.

module.exports = function createGiveaways(ctx) {
  const {
    ActionRowBuilder,
    BrandEmbed,
    ButtonBuilder,
    ButtonStyle,
    buildGiveawayEmbed,
    client,
    endGiveaway,
    getInvites,
    loadData,
    notice,
    parseDuration,
    saveData,
  } = ctx;

  async function command(interaction) {
    if (interaction.commandName === 'giveaway') {
      const sub = interaction.options.getSubcommand();

      if (sub === 'start') {
        const channel = interaction.options.getChannel('channel');
        const prize = interaction.options.getString('preis');
        const durStr = interaction.options.getString('dauer');
        const winnersCount = interaction.options.getInteger('gewinner') || 1;
        const minInvites = interaction.options.getInteger('min_invites') || 0;
        const minAccountAgeDays = interaction.options.getInteger('min_age_tage') || 0;

        const durMs = parseDuration(durStr);
        if (!durMs) {
          return interaction.reply({ content: '❌ Ungültige Dauer! Beispiele: `30m`, `1h`, `2h`, `7d`', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const endTime = Date.now() + durMs;
        const gw = {
          channelId: channel.id,
          guildId: interaction.guild.id,
          prize,
          endTime,
          winnersCount,
          minInvites,
          minAccountAgeDays,
          participants: [],
          ended: false,
          zinkedWinner: null,
          hostedBy: interaction.user.id,
          winners: []
        };

        const embed = buildGiveawayEmbed(gw, false);
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('giveaway_enter_PLACEHOLDER')
            .setLabel('Teilnehmen')
            .setEmoji('🎉')
            .setStyle(ButtonStyle.Primary)
        );

        const msg = await channel.send({ embeds: [embed], components: [row] });

        // Fix button with real message ID
        const realRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`giveaway_enter_${msg.id}`)
            .setLabel('Teilnehmen')
            .setEmoji('🎉')
            .setStyle(ButtonStyle.Primary)
        );
        await msg.edit({ embeds: [embed], components: [realRow] });

        const data = loadData();
        data.giveaways[msg.id] = gw;
        saveData(data);

        return interaction.editReply(`✅ Giveaway gestartet in <#${channel.id}>!`);
      }

      if (sub === 'end') {
        const msgId = interaction.options.getString('message_id');
        const data = loadData();
        if (!data.giveaways[msgId]) {
          return interaction.reply({ content: '❌ Giveaway nicht gefunden!', ephemeral: true });
        }
        if (data.giveaways[msgId].ended) {
          return interaction.reply({ content: '❌ Giveaway ist bereits beendet!', ephemeral: true });
        }
        await interaction.deferReply({ ephemeral: true });
        await endGiveaway(msgId);
        return interaction.editReply('✅ Giveaway wurde vorzeitig beendet!');
      }

      if (sub === 'reroll') {
        const msgId = interaction.options.getString('message_id');
        const data = loadData();
        const gw = data.giveaways[msgId];
        if (!gw || !gw.ended) {
          return interaction.reply({ content: '❌ Giveaway nicht gefunden oder noch nicht beendet!', ephemeral: true });
        }
        await interaction.deferReply({ ephemeral: true });

        const pool = gw.participants.filter(p => !gw.winners.includes(p));
        if (pool.length === 0) {
          return interaction.editReply('❌ Keine weiteren Teilnehmer für Reroll vorhanden!');
        }
        const newWinner = pool[Math.floor(Math.random() * pool.length)];
        gw.winners.push(newWinner);
        saveData(data);

        const channel = client.channels.cache.get(gw.channelId);
        if (channel) {
          await channel.send({ content: `<@${newWinner}>`, embeds: [notice(`Neu ausgelost: <@${newWinner}> gewinnt **${gw.prize}**. Glückwunsch!`, 'success')] });
        }
        return interaction.editReply(`✅ Neuer Gewinner: <@${newWinner}>`);
      }

      if (sub === 'zinken') {
        const msgId = interaction.options.getString('message_id');
        const user = interaction.options.getUser('user');
        const data = loadData();
        const gw = data.giveaways[msgId];
        if (!gw) {
          return interaction.reply({ content: '❌ Giveaway nicht gefunden!', ephemeral: true });
        }
        if (gw.ended) {
          return interaction.reply({ content: '❌ Giveaway ist bereits beendet!', ephemeral: true });
        }
        gw.zinkedWinner = user.id;
        saveData(data);
        return interaction.reply({ content: `🎰 Gezinkt! <@${user.id}> wird das Giveaway **${gw.prize}** gewinnen.`, ephemeral: true });
      }

      if (sub === 'list') {
        const msgId = interaction.options.getString('message_id');
        const data = loadData();
        const gw = data.giveaways[msgId];
        if (!gw) {
          return interaction.reply({ content: '❌ Giveaway nicht gefunden!', ephemeral: true });
        }

        if (gw.participants.length === 0) {
          return interaction.reply({ content: `📋 **${gw.prize}** — Noch keine Teilnehmer.`, ephemeral: true });
        }

        // Split into pages of 30 to avoid hitting embed limits
        const chunkSize = 30;
        const chunks = [];
        for (let i = 0; i < gw.participants.length; i += chunkSize) {
          chunks.push(gw.participants.slice(i, i + chunkSize));
        }

        const embed = new BrandEmbed()
          .setColor('primary')
          .setAuthor({ name: 'Giveaway-Teilnehmer' })
          .setTitle(gw.prize)
          .setDescription(
            chunks[0].map((id, i) => `**${i + 1}.** <@${id}>`).join('\n')
          )
          .setFooter({ text: `${gw.participants.length} Teilnehmer${gw.zinkedWinner ? ` · festgelegt: ${gw.zinkedWinner}` : ''}` });

        if (chunks.length > 1) {
          embed.addFields(
            ...chunks.slice(1).map((chunk, ci) => ({
              name: '​',
              value: chunk.map((id, i) => `**${ci * chunkSize + 30 + i + 1}.** <@${id}>`).join('\n'),
              inline: false
            }))
          );
        }

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (sub === 'removeuser') {
        const msgId = interaction.options.getString('message_id');
        const user = interaction.options.getUser('user');
        const data = loadData();
        const gw = data.giveaways[msgId];
        if (!gw) {
          return interaction.reply({ content: '❌ Giveaway nicht gefunden!', ephemeral: true });
        }
        if (gw.ended) {
          return interaction.reply({ content: '❌ Giveaway ist bereits beendet!', ephemeral: true });
        }

        if (!gw.participants.includes(user.id)) {
          return interaction.reply({ content: `❌ <@${user.id}> ist gar nicht im Giveaway!`, ephemeral: true });
        }

        gw.participants = gw.participants.filter(p => p !== user.id);

        // Also remove zinken if it was this user
        if (gw.zinkedWinner === user.id) {
          gw.zinkedWinner = null;
        }

        saveData(data);

        // Update the giveaway embed with new count
        try {
          const ch = client.channels.cache.get(gw.channelId);
          if (ch) {
            const msg = await ch.messages.fetch(msgId).catch(() => null);
            if (msg) await msg.edit({ embeds: [buildGiveawayEmbed(gw, false)] });
          }
        } catch {}

        return interaction.reply({
          content: `✅ <@${user.id}> wurde aus dem Giveaway **${gw.prize}** entfernt. (Noch ${gw.participants.length} Teilnehmer)`,
          ephemeral: true
        });
      }
    }
  }

  async function button(interaction) {
    if (interaction.customId.startsWith('giveaway_enter_')) {
      const msgId = interaction.customId.replace('giveaway_enter_', '');
      const data = loadData();
      const gw = data.giveaways[msgId];

      if (!gw || gw.ended) {
        return interaction.reply({ content: '❌ Dieses Giveaway ist bereits beendet!', ephemeral: true });
      }

      if (gw.participants.includes(interaction.user.id)) {
        // Toggle: remove if already in
        gw.participants = gw.participants.filter(p => p !== interaction.user.id);
        saveData(data);
        return interaction.reply({ content: '❌ Du hast deine Teilnahme zurückgezogen!', ephemeral: true });
      }

      // Check min invites
      if (gw.minInvites > 0) {
        const userInvites = getInvites(interaction.user.id);
        if (userInvites < gw.minInvites) {
          return interaction.reply({
            content: `❌ Du brauchst mindestens **${gw.minInvites}** Einladungen! Du hast: **${userInvites}**`,
            ephemeral: true
          });
        }
      }

      // Check min account age
      if (gw.minAccountAgeDays > 0) {
        const ageDays = (Date.now() - interaction.user.createdTimestamp) / 86400000;
        if (ageDays < gw.minAccountAgeDays) {
          return interaction.reply({
            content: `❌ Dein Account muss mindestens **${gw.minAccountAgeDays}** Tage alt sein! (Deiner: **${Math.floor(ageDays)}** Tage)`,
            ephemeral: true
          });
        }
      }

      gw.participants.push(interaction.user.id);
      saveData(data);

      // Update embed with new participant count
      try {
        const msg = await interaction.channel.messages.fetch(msgId).catch(() => null);
        if (msg) {
          const updatedEmbed = buildGiveawayEmbed(gw, false);
          await msg.edit({ embeds: [updatedEmbed] });
        }
      } catch {}

      return interaction.reply({ content: `✅ Du nimmst am Giveaway für **${gw.prize}** teil! 🎉`, ephemeral: true });
    }
  }

  return {
    name: 'giveaways',
    commands: ["giveaway"],
    buttons: [/^giveaway_enter_/],
    command,
    button,
  };
};
