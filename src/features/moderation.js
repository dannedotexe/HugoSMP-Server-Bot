'use strict';

// Moderation: /warn, /warnings, /clearwarnings, /mute, /unmute, /kick, /ban, /unban, /modlog
// Aus index.js ausgelagert; gemeinsame Hilfsfunktionen kommen über ctx.

module.exports = function createModeration(ctx) {
  const {
    BrandEmbed,
    addWarning,
    clearWarnings,
    getWarnings,
    loadData,
    parseDuration,
    saveData,
    sendPunishLog,
    tryDM,
  } = ctx;

  async function command(interaction) {
    if (interaction.commandName === 'warn') {
      const target = interaction.options.getUser('user');
      const grund = interaction.options.getString('grund');
      const member = await interaction.guild.members.fetch(target.id).catch(() => null);

      if (!member) return interaction.reply({ content: '❌ User nicht auf dem Server gefunden.', ephemeral: true });

      const warnCount = addWarning(target.id, interaction.user.id, grund);

      const dmEmbed = new BrandEmbed()
        .setColor('warning')
        .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined })
        .setTitle('Du wurdest verwarnt')
        .addFields(
          { name: 'Grund', value: grund },
          { name: 'Verwarnungen gesamt', value: `${warnCount}` }
        )
        .setTimestamp();

      await tryDM(target, dmEmbed);
      await sendPunishLog(interaction.guild, {
        action: `Verwarnung #${warnCount}`,
        color: 'warning',
        target,
        moderator: interaction.user,
        reason: grund,
        extra: `Gesamt: **${warnCount}** Verwarnung(en)`
      });

      return interaction.reply({
        embeds: [new BrandEmbed()
          .setColor('warning')
          .setDescription(`<@${target.id}> wurde verwarnt. (Verwarnung #${warnCount})
-# Grund: ${grund}`)],
        ephemeral: true
      });
    }

    // ── /warnings ──────────────────────────────────────────────────
    if (interaction.commandName === 'warnings') {
      const target = interaction.options.getUser('user');
      const warns = getWarnings(target.id);

      if (warns.length === 0) {
        return interaction.reply({ content: `✅ <@${target.id}> hat keine Verwarnungen.`, ephemeral: true });
      }

      const list = warns.map((w, i) =>
        `\`#${i + 1}\`  ${w.reason}\n-# von <@${w.moderatorId}> · <t:${Math.floor(w.timestamp / 1000)}:R>`
      ).join('\n\n');

      return interaction.reply({
        embeds: [new BrandEmbed()
          .setColor('warning')
          .setAuthor({ name: target.tag || target.username, iconURL: target.displayAvatarURL() })
          .setTitle('Verwarnungen')
          .setDescription(list.slice(0, 4000))
          .setFooter({ text: `${warns.length} Verwarnung(en) gesamt` })],
        ephemeral: true
      });
    }

    // ── /clearwarnings ─────────────────────────────────────────────
    if (interaction.commandName === 'clearwarnings') {
      const target = interaction.options.getUser('user');
      const before = getWarnings(target.id).length;
      clearWarnings(target.id);

      await sendPunishLog(interaction.guild, {
        action: 'Verwarnungen gelöscht',
        color: 'muted',
        target,
        moderator: interaction.user,
        reason: `${before} Verwarnung(en) wurden gelöscht`
      });

      return interaction.reply({ content: `✅ **${before}** Verwarnung(en) von <@${target.id}> gelöscht.`, ephemeral: true });
    }

    // ── /mute ──────────────────────────────────────────────────────
    if (interaction.commandName === 'mute') {
      const target = interaction.options.getUser('user');
      const durStr = interaction.options.getString('dauer');
      const grund = interaction.options.getString('grund') || 'Kein Grund angegeben';
      const member = await interaction.guild.members.fetch(target.id).catch(() => null);

      if (!member) return interaction.reply({ content: '❌ User nicht gefunden.', ephemeral: true });

      const durMs = parseDuration(durStr);
      if (!durMs) return interaction.reply({ content: '❌ Ungültige Dauer! Beispiele: `10m`, `1h`, `1d`', ephemeral: true });

      const maxMs = 28 * 24 * 60 * 60 * 1000;
      if (durMs > maxMs) return interaction.reply({ content: '❌ Maximale Timeout-Dauer ist 28 Tage.', ephemeral: true });

      try {
        await member.timeout(durMs, grund);

        const dmEmbed = new BrandEmbed()
          .setColor('warning')
          .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined })
          .setTitle('Du wurdest gemutet')
          .addFields(
            { name: 'Dauer', value: durStr },
            { name: 'Grund', value: grund }
          ).setTimestamp();

        await tryDM(target, dmEmbed);
        await sendPunishLog(interaction.guild, { action: 'Mute / Timeout', color: 'warning', target, moderator: interaction.user, reason: grund, duration: durStr });

        return interaction.reply({
          embeds: [new BrandEmbed().setColor('warning')
            .setDescription(`<@${target.id}> wurde für **${durStr}** gemutet.
-# Grund: ${grund}`)],
          ephemeral: true
        });
      } catch (e) {
        return interaction.reply({ content: `❌ Fehler: ${e.message}`, ephemeral: true });
      }
    }

    // ── /unmute ────────────────────────────────────────────────────
    if (interaction.commandName === 'unmute') {
      const target = interaction.options.getUser('user');
      const grund = interaction.options.getString('grund') || 'Kein Grund angegeben';
      const member = await interaction.guild.members.fetch(target.id).catch(() => null);

      if (!member) return interaction.reply({ content: '❌ User nicht gefunden.', ephemeral: true });

      try {
        await member.timeout(null, grund);
        await sendPunishLog(interaction.guild, { action: 'Unmute', color: 'success', target, moderator: interaction.user, reason: grund });
        return interaction.reply({
          embeds: [new BrandEmbed().setColor('success').setDescription(`<@${target.id}> wurde entmutet.`)],
          ephemeral: true
        });
      } catch (e) {
        return interaction.reply({ content: `❌ Fehler: ${e.message}`, ephemeral: true });
      }
    }

    // ── /kick ──────────────────────────────────────────────────────
    if (interaction.commandName === 'kick') {
      const target = interaction.options.getUser('user');
      const grund = interaction.options.getString('grund') || 'Kein Grund angegeben';
      const member = await interaction.guild.members.fetch(target.id).catch(() => null);

      if (!member) return interaction.reply({ content: '❌ User nicht auf dem Server.', ephemeral: true });

      const dmEmbed = new BrandEmbed()
        .setColor('danger')
        .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined })
        .setTitle('Du wurdest gekickt')
        .addFields({ name: 'Grund', value: grund })
        .setTimestamp();

      await tryDM(target, dmEmbed);

      try {
        await member.kick(grund);
        await sendPunishLog(interaction.guild, { action: 'Kick', color: 'danger', target, moderator: interaction.user, reason: grund });
        return interaction.reply({
          embeds: [new BrandEmbed().setColor('danger').setDescription(`<@${target.id}> wurde gekickt.
-# Grund: ${grund}`)],
          ephemeral: true
        });
      } catch (e) {
        return interaction.reply({ content: `❌ Fehler: ${e.message}`, ephemeral: true });
      }
    }

    // ── /ban ───────────────────────────────────────────────────────
    if (interaction.commandName === 'ban') {
      const target = interaction.options.getUser('user');
      const grund = interaction.options.getString('grund') || 'Kein Grund angegeben';
      const durStr = interaction.options.getString('dauer');
      const member = await interaction.guild.members.fetch(target.id).catch(() => null);

      const durMs = durStr ? parseDuration(durStr) : null;
      if (durStr && !durMs) return interaction.reply({ content: '❌ Ungültige Dauer! Beispiele: `1h`, `7d`', ephemeral: true });

      const dmEmbed = new BrandEmbed()
        .setColor('danger')
        .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined })
        .setTitle('Du wurdest gebannt')
        .addFields(
          { name: 'Grund', value: grund },
          { name: 'Dauer', value: durStr || 'Permanent' }
        ).setTimestamp();

      if (member) await tryDM(target, dmEmbed);

      try {
        await interaction.guild.members.ban(target.id, { reason: grund, deleteMessageSeconds: 86400 });

        if (durMs) {
          const data = loadData();
          data.tempbans[target.id] = {
            guildId: interaction.guild.id,
            userTag: target.tag || target.username,
            expiresAt: Date.now() + durMs,
            duration: durStr,
            reason: grund
          };
          saveData(data);
        }

        await sendPunishLog(interaction.guild, {
          action: durStr ? `Tempban (${durStr})` : 'Permanenter Ban',
          color: 'danger',
          target,
          moderator: interaction.user,
          reason: grund,
          duration: durStr || 'Permanent'
        });

        return interaction.reply({
          embeds: [new BrandEmbed().setColor('danger')
            .setDescription(`<@${target.id}> wurde ${durStr ? `für **${durStr}**` : '**permanent**'} gebannt.
-# Grund: ${grund}`)],
          ephemeral: true
        });
      } catch (e) {
        return interaction.reply({ content: `❌ Fehler: ${e.message}`, ephemeral: true });
      }
    }

    // ── /unban ─────────────────────────────────────────────────────
    if (interaction.commandName === 'unban') {
      const userId = interaction.options.getString('user_id').trim();
      const grund = interaction.options.getString('grund') || 'Kein Grund angegeben';

      try {
        const bannedUser = await interaction.guild.bans.fetch(userId).catch(() => null);
        if (!bannedUser) return interaction.reply({ content: '❌ Dieser User ist nicht gebannt.', ephemeral: true });

        await interaction.guild.members.unban(userId, grund);

        const data = loadData();
        delete data.tempbans[userId];
        saveData(data);

        await sendPunishLog(interaction.guild, {
          action: 'Unban',
          color: 'success',
          target: bannedUser.user,
          moderator: interaction.user,
          reason: grund
        });

        return interaction.reply({
          embeds: [new BrandEmbed().setColor('success').setDescription(`**${bannedUser.user.tag || userId}** wurde entbannt.
-# Grund: ${grund}`)],
          ephemeral: true
        });
      } catch (e) {
        return interaction.reply({ content: `❌ Fehler: ${e.message}`, ephemeral: true });
      }
    }

    // ── /modlog ────────────────────────────────────────────────────
    if (interaction.commandName === 'modlog') {
      const target = interaction.options.getUser('user');
      const warns = getWarnings(target.id);
      const data = loadData();
      const tempban = data.tempbans[target.id];

      const lines = [];

      if (warns.length > 0) {
        lines.push(`**⚠️ Verwarnungen (${warns.length})**`);
        warns.slice(-5).forEach((w, i) => {
          lines.push(`#${i + 1} ${w.reason} — <t:${Math.floor(w.timestamp / 1000)}:R> von <@${w.moderatorId}>`);
        });
        if (warns.length > 5) lines.push(`_...und ${warns.length - 5} weitere_`);
      }

      if (tempban) {
        lines.push(`
**🔨 Aktiver Tempban**`);
        lines.push(`Läuft ab: <t:${Math.floor(tempban.expiresAt / 1000)}:R> | Grund: ${tempban.reason}`);
      }

      if (lines.length === 0) {
        return interaction.reply({ content: `✅ <@${target.id}> hat keine Einträge im Modlog.`, ephemeral: true });
      }

      return interaction.reply({
        embeds: [new BrandEmbed()
          .setColor('primary')
          .setAuthor({ name: target.tag || target.username, iconURL: target.displayAvatarURL() })
          .setTitle('Moderations-Verlauf')
          .setThumbnail(target.displayAvatarURL())
          .setDescription(lines.join('\n'))
          .setTimestamp()],
        ephemeral: true
      });
    }
  }

  return {
    name: 'moderation',
    commands: ["warn","warnings","clearwarnings","mute","unmute","kick","ban","unban","modlog"],
    command,
  };
};
