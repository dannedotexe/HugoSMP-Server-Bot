'use strict';

// Begrüßung und Abschied: /setwelcome, /setleave
// Aus index.js ausgelagert; gemeinsame Hilfsfunktionen kommen über ctx.

module.exports = function createWelcome(ctx) {
  const {
    BrandEmbed,
    loadData,
    saveData,
  } = ctx;

  async function command(interaction) {
    // ── /setwelcome ────────────────────────────────────────────────
    if (interaction.commandName === 'setwelcome') {
      const sub = interaction.options.getSubcommand();
      const data = loadData();

      if (sub === 'set') {
        const channel = interaction.options.getChannel('channel');
        const nachricht = interaction.options.getString('nachricht');
        const farbe = interaction.options.getString('farbe') || 'primary';

        data.welcomeConfig = { enabled: true, channelId: channel.id, message: nachricht, color: farbe };
        saveData(data);

        const previewEmbed = new BrandEmbed()
          .setColor(farbe)
          .setTitle('Willkommensnachricht gespeichert')
          .addFields(
            { name: 'Kanal', value: `<#${channel.id}>`, inline: true },
            { name: 'Farbe', value: farbe, inline: true },
            { name: 'Nachricht', value: nachricht }
          )
          .setFooter({ text: 'Platzhalter: {user} {username} {server} {count}' });

        return interaction.reply({ embeds: [previewEmbed], ephemeral: true });
      }

      if (sub === 'disable') {
        data.welcomeConfig = { enabled: false };
        saveData(data);
        return interaction.reply({ content: '✅ Willkommensnachrichten **deaktiviert**.', ephemeral: true });
      }

      if (sub === 'preview') {
        const wc = data.welcomeConfig;
        if (!wc?.enabled) return interaction.reply({ content: '❌ Willkommensnachrichten sind nicht eingerichtet.', ephemeral: true });

        const fakeEmbed = new BrandEmbed()
          .setColor(wc.color || 'primary')
          .setDescription(
            (wc.message || 'Willkommen {user} auf **{server}**.')
              .replace(/{user}/g, `<@${interaction.user.id}>`)
              .replace(/{username}/g, interaction.user.username)
              .replace(/{server}/g, interaction.guild.name)
              .replace(/{count}/g, interaction.guild.memberCount.toString())
          )
          .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
          .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() })
          .setTimestamp();

        return interaction.reply({ content: '👀 **Vorschau:**', embeds: [fakeEmbed], ephemeral: true });
      }

      if (sub === 'info') {
        const wc = data.welcomeConfig;
        if (!wc?.enabled) return interaction.reply({ content: '❌ Willkommensnachrichten sind nicht eingerichtet.', ephemeral: true });

        return interaction.reply({
          embeds: [new BrandEmbed()
            .setColor(wc.color || 'primary')
            .setTitle('Willkommensnachricht')
            .addFields(
              { name: 'Kanal', value: `<#${wc.channelId}>`, inline: true },
              { name: 'Farbe', value: wc.color || 'Standard', inline: true },
              { name: 'Nachricht', value: wc.message || '(Standard)' }
            )
            .setFooter({ text: 'Platzhalter: {user} {username} {server} {count}' })],
          ephemeral: true
        });
      }
    }

    // ── /setleave ──────────────────────────────────────────────────
    if (interaction.commandName === 'setleave') {
      const sub = interaction.options.getSubcommand();
      const data = loadData();

      if (sub === 'set') {
        const channel = interaction.options.getChannel('channel');
        const nachricht = interaction.options.getString('nachricht');
        const farbe = interaction.options.getString('farbe') || 'neutral';

        data.leaveConfig = { enabled: true, channelId: channel.id, message: nachricht, color: farbe };
        saveData(data);

        const previewEmbed = new BrandEmbed()
          .setColor(farbe)
          .setTitle('Abschiedsnachricht gespeichert')
          .addFields(
            { name: 'Kanal', value: `<#${channel.id}>`, inline: true },
            { name: 'Farbe', value: farbe, inline: true },
            { name: 'Nachricht', value: nachricht }
          )
          .setFooter({ text: 'Platzhalter: {user} {username} {server} {count}' });

        return interaction.reply({ embeds: [previewEmbed], ephemeral: true });
      }

      if (sub === 'disable') {
        data.leaveConfig = { enabled: false };
        saveData(data);
        return interaction.reply({ content: '✅ Leave-Nachrichten **deaktiviert**.', ephemeral: true });
      }

      if (sub === 'preview') {
        const lc = data.leaveConfig;
        if (!lc?.enabled) return interaction.reply({ content: '❌ Leave-Nachrichten sind nicht eingerichtet.', ephemeral: true });

        const fakeEmbed = new BrandEmbed()
          .setColor(lc.color || 'neutral')
          .setDescription(
            (lc.message || '**{username}** hat den Server verlassen.')
              .replace(/{user}/g, `<@${interaction.user.id}>`)
              .replace(/{username}/g, interaction.user.username)
              .replace(/{server}/g, interaction.guild.name)
              .replace(/{count}/g, interaction.guild.memberCount.toString())
          )
          .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
          .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() })
          .setTimestamp();

        return interaction.reply({ content: '👀 **Vorschau:**', embeds: [fakeEmbed], ephemeral: true });
      }

      if (sub === 'info') {
        const lc = data.leaveConfig;
        if (!lc?.enabled) return interaction.reply({ content: '❌ Leave-Nachrichten sind nicht eingerichtet.', ephemeral: true });

        return interaction.reply({
          embeds: [new BrandEmbed()
            .setColor(lc.color || 'neutral')
            .setTitle('Abschiedsnachricht')
            .addFields(
              { name: 'Kanal', value: `<#${lc.channelId}>`, inline: true },
              { name: 'Farbe', value: lc.color || 'Standard', inline: true },
              { name: 'Nachricht', value: lc.message || '(Standard)' }
            )
            .setFooter({ text: 'Platzhalter: {user} {username} {server} {count}' })],
          ephemeral: true
        });
      }
    }
  }

  return {
    name: 'welcome',
    commands: ["setwelcome","setleave"],
    command,
  };
};
