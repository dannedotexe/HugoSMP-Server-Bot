// ── Kern-Commands: Hilfe, Statistiken, Konfiguration ──────────────

const {
  SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder,
  StringSelectMenuBuilder, ChannelType, time, TimestampStyles
} = require('discord.js');
const { BrandEmbed, BRAND_NAME, notice } = require('../theme');
const guildConfig = require('../guildConfig');

const HELP_CATEGORIES = [
  {
    key: 'general',
    label: 'Allgemein',
    emoji: '🧭',
    description: 'Infos, Statistiken und Einladungen',
    commands: ['help', 'serverinfo', 'userinfo', 'inviterewards', 'leaderboard', 'website']
  },
  {
    key: 'moderation',
    label: 'Moderation',
    emoji: '🛡️',
    description: 'Verwarnen, Stummschalten, Bannen, Logs',
    commands: ['warn', 'warnings', 'clearwarnings', 'mute', 'unmute', 'kick', 'ban', 'unban', 'modlog', 'clear']
  },
  {
    key: 'tickets',
    label: 'Tickets & Bestellungen',
    emoji: '🎫',
    description: 'Tickets bearbeiten und abschließen',
    commands: ['bestellung', 'bewertungen', 'close', 'adduser', 'fertig', 'getorder']
  },
  {
    key: 'shop',
    label: 'Shop & Lager',
    emoji: '📦',
    description: 'Lagerbestand und Restock-Hinweise',
    commands: ['stock', 'preview']
  },
  {
    key: 'community',
    label: 'Community',
    emoji: '🎉',
    description: 'Giveaways, Begrüßung und Abschied',
    commands: ['giveaway', 'setwelcome', 'setleave']
  },
  {
    key: 'admin',
    label: 'Einrichtung',
    emoji: '⚙️',
    description: 'Panels, Einstellungen und Bot-Verwaltung',
    commands: [
      'config', 'ankündigung', 'setuptickets', 'setupverify', 'setupbestellinfo', 'zahlungsinfo', 'setuproles', 'setupinviterewards',
      'setupleaderboard', 'setupstock', 'setupstockpanel', 'botstatus', 'setinvites',
      'embed', 'say', 'dashboard', 'version', 'aktualisieren', 'serverstruktur', 'umbenennen'
    ]
  }
];

function definitions() {
  return [
    new SlashCommandBuilder()
      .setName('help')
      .setDescription('Zeigt alle Befehle nach Kategorie.')
      .toJSON(),

    new SlashCommandBuilder()
      .setName('serverinfo')
      .setDescription('Statistiken und Infos zu diesem Server.')
      .toJSON(),

    new SlashCommandBuilder()
      .setName('userinfo')
      .setDescription('Infos zu einem Mitglied.')
      .addUserOption(o => o.setName('user').setDescription('Mitglied (Standard: du selbst)'))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('config')
      .setDescription('Server-Einstellungen des Bots verwalten.')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addSubcommand(sub => sub.setName('view').setDescription('Aktuelle Einstellungen anzeigen'))
      .addSubcommandGroup(group =>
        group.setName('autorole').setDescription('Rollen, die neue Mitglieder automatisch bekommen')
          .addSubcommand(sub =>
            sub.setName('add').setDescription('Auto-Rolle hinzufügen')
              .addRoleOption(o => o.setName('role').setDescription('Rolle').setRequired(true))
          )
          .addSubcommand(sub =>
            sub.setName('remove').setDescription('Auto-Rolle entfernen')
              .addRoleOption(o => o.setName('role').setDescription('Rolle').setRequired(true))
          )
          .addSubcommand(sub => sub.setName('clear').setDescription('Alle Auto-Rollen entfernen'))
      )
      .addSubcommandGroup(group =>
        group.setName('modlog').setDescription('Kanal für Moderations-Logs')
          .addSubcommand(sub =>
            sub.setName('set').setDescription('Mod-Log-Kanal festlegen')
              .addChannelOption(o =>
                o.setName('channel').setDescription('Kanal').setRequired(true)
                  .addChannelTypes(ChannelType.GuildText)
              )
          )
          .addSubcommand(sub => sub.setName('reset').setDescription('Auf Standard-Kanal zurücksetzen'))
      )
      .toJSON()
  ];
}

// ── Hilfe ─────────────────────────────────────────────────────────

async function getGuildCommands(guild) {
  try {
    if (guild.commands.cache.size === 0) await guild.commands.fetch();
  } catch {}
  return guild.commands.cache;
}

function canUse(command, member) {
  const required = command?.defaultMemberPermissions;
  if (!required || !member?.permissions) return true;
  return member.permissions.has(required);
}

function visibleCategories(commands, member) {
  return HELP_CATEGORIES
    .map(cat => ({
      ...cat,
      entries: cat.commands
        .map(name => commands.find(c => c.name === name))
        .filter(cmd => cmd && canUse(cmd, member))
    }))
    .filter(cat => cat.entries.length > 0);
}

function helpMenu(categories, selected) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('help_category')
      .setPlaceholder('Kategorie wählen')
      .addOptions(
        { label: 'Übersicht', value: 'overview', emoji: '🏠', description: 'Zurück zur Startseite', default: !selected },
        ...categories.map(cat => ({
          label: cat.label,
          value: cat.key,
          emoji: cat.emoji,
          description: cat.description,
          default: selected === cat.key
        }))
      )
  );
}

function helpOverview(guild, categories) {
  const total = categories.reduce((sum, cat) => sum + cat.entries.length, 0);
  return new BrandEmbed()
    .setAuthor({ name: `${BRAND_NAME} Hilfe`, iconURL: guild.iconURL() || undefined })
    .setDescription(
      'Alle Befehle laufen über **Slash Commands** – tippe `/` und wähle einen aus.\n' +
      'Wähle unten eine Kategorie, um die passenden Befehle zu sehen.'
    )
    .addFields(categories.map(cat => ({
      name: `${cat.emoji}  ${cat.label}`,
      value: `${cat.description}\n-# ${cat.entries.length} Befehle`,
      inline: true
    })))
    .setFooter({ text: `${total} verfügbare Befehle` });
}

function helpCategory(guild, category) {
  const lines = category.entries.map(cmd => `</${cmd.name}:${cmd.id}>\n-# ${cmd.description}`);
  return new BrandEmbed()
    .setAuthor({ name: `${BRAND_NAME} Hilfe`, iconURL: guild.iconURL() || undefined })
    .setTitle(`${category.emoji}  ${category.label}`)
    .setDescription(lines.join('\n'))
    .setFooter({ text: `${category.entries.length} Befehle` });
}

async function handleHelp(interaction) {
  const commands = await getGuildCommands(interaction.guild);
  const categories = visibleCategories(commands, interaction.member);
  return interaction.reply({
    embeds: [helpOverview(interaction.guild, categories)],
    components: [helpMenu(categories)],
    ephemeral: true
  });
}

async function handleHelpSelect(interaction) {
  const commands = await getGuildCommands(interaction.guild);
  const categories = visibleCategories(commands, interaction.member);
  const value = interaction.values[0];
  const category = categories.find(cat => cat.key === value);

  return interaction.update({
    embeds: [category ? helpCategory(interaction.guild, category) : helpOverview(interaction.guild, categories)],
    components: [helpMenu(categories, category?.key)]
  });
}

// ── Statistiken ───────────────────────────────────────────────────

function formatNumber(n) {
  return Number(n || 0).toLocaleString('de-DE');
}

async function handleServerInfo(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;

  const members = await guild.members.fetch().catch(() => guild.members.cache);
  const bots = members.filter(m => m.user.bot).size;
  const humans = members.size - bots;
  const joined7d = members.filter(m => m.joinedTimestamp && Date.now() - m.joinedTimestamp < 7 * 86400000).size;

  const channels = guild.channels.cache;
  const text = channels.filter(c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement).size;
  const voice = channels.filter(c => c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice).size;
  const categories = channels.filter(c => c.type === ChannelType.GuildCategory).size;

  const embed = new BrandEmbed()
    .setAuthor({ name: guild.name, iconURL: guild.iconURL() || undefined })
    .setThumbnail(guild.iconURL({ size: 256 }) || null)
    .addFields(
      { name: 'Mitglieder', value: `${formatNumber(humans)}\n-# + ${formatNumber(bots)} Bots`, inline: true },
      { name: 'Neu (7 Tage)', value: formatNumber(joined7d), inline: true },
      { name: 'Rollen', value: formatNumber(guild.roles.cache.size - 1), inline: true },
      { name: 'Kanäle', value: `${formatNumber(text)} Text · ${formatNumber(voice)} Voice\n-# ${formatNumber(categories)} Kategorien`, inline: true },
      { name: 'Inhaber', value: `<@${guild.ownerId}>`, inline: true },
      { name: 'Erstellt', value: time(guild.createdAt, TimestampStyles.RelativeTime), inline: true }
    )
    .setFooter({ text: `Server-ID ${guild.id}` });

  return interaction.editReply({ embeds: [embed] });
}

async function handleUserInfo(interaction, ctx) {
  const user = interaction.options.getUser('user') || interaction.user;
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);

  const embed = new BrandEmbed()
    .setAuthor({ name: user.tag || user.username, iconURL: user.displayAvatarURL() })
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: 'Konto erstellt', value: time(user.createdAt, TimestampStyles.RelativeTime), inline: true },
      { name: 'Beigetreten', value: member?.joinedAt ? time(member.joinedAt, TimestampStyles.RelativeTime) : '—', inline: true },
      { name: 'Einladungen', value: formatNumber(ctx.getInviteCount(user.id)), inline: true }
    );

  if (member) {
    const roles = member.roles.cache
      .filter(r => r.id !== interaction.guild.id)
      .sort((a, b) => b.position - a.position);
    const shown = roles.first(8).map(r => `<@&${r.id}>`).join(' ');
    embed.addFields(
      { name: 'Höchste Rolle', value: roles.size ? `<@&${roles.first().id}>` : '—', inline: true },
      { name: 'Verwarnungen', value: formatNumber(ctx.getWarningCount(user.id)), inline: true },
      { name: `Rollen (${roles.size})`, value: roles.size ? shown + (roles.size > 8 ? ` +${roles.size - 8}` : '') : '—' }
    );
  }

  embed.setFooter({ text: `User-ID ${user.id}` });
  return interaction.reply({ embeds: [embed], ephemeral: true });
}

// ── Konfiguration ─────────────────────────────────────────────────

function onOff(value, text) {
  return value ? text : '`Aus`';
}

function buildConfigEmbed(guild, ctx) {
  const cfg = guildConfig.get(guild.id);
  const welcome = ctx.getWelcomeConfig();
  const leave = ctx.getLeaveConfig();
  const modLog = cfg.modLogChannelId || ctx.defaultModLogChannelId;

  return new BrandEmbed()
    .setAuthor({ name: `Einstellungen · ${guild.name}`, iconURL: guild.iconURL() || undefined })
    .setDescription('Änderungen über `/config`, `/setwelcome` und `/setleave`.')
    .addFields(
      {
        name: 'Willkommen',
        value: onOff(welcome.enabled && welcome.channelId, `<#${welcome.channelId}>`),
        inline: true
      },
      {
        name: 'Abschied',
        value: onOff(leave.enabled && leave.channelId, `<#${leave.channelId}>`),
        inline: true
      },
      {
        name: 'Mod-Log',
        value: modLog ? `<#${modLog}>${cfg.modLogChannelId ? '' : '\n-# Standard'}` : '`Aus`',
        inline: true
      },
      {
        name: 'Auto-Rollen',
        value: cfg.autoRoleIds.length ? cfg.autoRoleIds.map(id => `<@&${id}>`).join(' ') : '`Keine`'
      }
    );
}

async function handleConfig(interaction, ctx) {
  const group = interaction.options.getSubcommandGroup(false);
  const sub = interaction.options.getSubcommand();
  const guild = interaction.guild;

  if (!group && sub === 'view') {
    return interaction.reply({ embeds: [buildConfigEmbed(guild, ctx)], ephemeral: true });
  }

  if (group === 'autorole') {
    const cfg = guildConfig.get(guild.id);

    if (sub === 'clear') {
      guildConfig.update(guild.id, { autoRoleIds: [] });
      return interaction.reply({ embeds: [notice('Alle Auto-Rollen wurden entfernt.', 'success')], ephemeral: true });
    }

    const role = interaction.options.getRole('role');

    if (sub === 'add') {
      if (role.managed || role.id === guild.id) {
        return interaction.reply({ embeds: [notice('Diese Rolle kann nicht automatisch vergeben werden.', 'danger')], ephemeral: true });
      }
      const me = guild.members.me;
      if (me && role.position >= me.roles.highest.position) {
        return interaction.reply({
          embeds: [notice(`<@&${role.id}> steht über der Bot-Rolle. Zieh die Bot-Rolle in den Server-Einstellungen nach oben.`, 'warning')],
          ephemeral: true
        });
      }
      if (cfg.autoRoleIds.includes(role.id)) {
        return interaction.reply({ embeds: [notice(`<@&${role.id}> ist bereits eine Auto-Rolle.`, 'warning')], ephemeral: true });
      }
      if (cfg.autoRoleIds.length >= 5) {
        return interaction.reply({ embeds: [notice('Maximal 5 Auto-Rollen möglich.', 'warning')], ephemeral: true });
      }
      guildConfig.update(guild.id, { autoRoleIds: [...cfg.autoRoleIds, role.id] });
      return interaction.reply({ embeds: [notice(`Neue Mitglieder bekommen jetzt <@&${role.id}>.`, 'success')], ephemeral: true });
    }

    if (sub === 'remove') {
      if (!cfg.autoRoleIds.includes(role.id)) {
        return interaction.reply({ embeds: [notice(`<@&${role.id}> ist keine Auto-Rolle.`, 'warning')], ephemeral: true });
      }
      guildConfig.update(guild.id, { autoRoleIds: cfg.autoRoleIds.filter(id => id !== role.id) });
      return interaction.reply({ embeds: [notice(`<@&${role.id}> wird nicht mehr automatisch vergeben.`, 'success')], ephemeral: true });
    }
  }

  if (group === 'modlog') {
    if (sub === 'set') {
      const channel = interaction.options.getChannel('channel');
      guildConfig.update(guild.id, { modLogChannelId: channel.id });
      return interaction.reply({ embeds: [notice(`Moderations-Logs gehen jetzt nach <#${channel.id}>.`, 'success')], ephemeral: true });
    }
    if (sub === 'reset') {
      guildConfig.update(guild.id, { modLogChannelId: null });
      return interaction.reply({ embeds: [notice('Mod-Log nutzt wieder den Standard-Kanal.', 'success')], ephemeral: true });
    }
  }

  return false;
}

// ── Auto-Rollen beim Beitritt ─────────────────────────────────────

async function applyAutoRoles(member) {
  const { autoRoleIds } = guildConfig.get(member.guild.id);
  if (!autoRoleIds.length) return;

  const roles = autoRoleIds.filter(id => member.guild.roles.cache.has(id));
  if (!roles.length) return;

  try {
    await member.roles.add(roles, 'Auto-Rolle');
  } catch (e) {
    console.error(`autorole error (${member.guild.id}):`, e.message);
  }
}

// ── Routing ───────────────────────────────────────────────────────

const COMMAND_HANDLERS = {
  help: handleHelp,
  serverinfo: handleServerInfo,
  userinfo: handleUserInfo,
  config: handleConfig
};

async function handleCommand(interaction, ctx) {
  const handler = COMMAND_HANDLERS[interaction.commandName];
  if (!handler) return false;
  await handler(interaction, ctx);
  return true;
}

async function handleComponent(interaction) {
  if (interaction.isStringSelectMenu() && interaction.customId === 'help_category') {
    await handleHelpSelect(interaction);
    return true;
  }
  return false;
}

module.exports = { definitions, handleCommand, handleComponent, applyAutoRoles };
