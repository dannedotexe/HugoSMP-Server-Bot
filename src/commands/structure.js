// ── /serverstruktur: Kategorien, Kanäle und Rollen exportieren ────
// Reiner Lese-Befehl: schickt die aktuelle Struktur als Textdatei,
// z. B. als Grundlage für eine geplante Umbenennung.

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, AttachmentBuilder } = require('discord.js');
const { notice } = require('../theme');

const TYPE_LABELS = {
  [ChannelType.GuildText]: 'text',
  [ChannelType.GuildVoice]: 'voice',
  [ChannelType.GuildAnnouncement]: 'news',
  [ChannelType.GuildStageVoice]: 'stage',
  [ChannelType.GuildForum]: 'forum',
  [ChannelType.GuildMedia]: 'media'
};

function definitions() {
  return [
    new SlashCommandBuilder()
      .setName('serverstruktur')
      .setDescription('Exportiert Kategorien, Kanäle und Rollen als Textdatei (ändert nichts).')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON()
  ];
}

function channelLine(channel) {
  const type = TYPE_LABELS[channel.type] || `typ-${channel.type}`;
  return `  [${type}] ${channel.name}  (id ${channel.id})`;
}

function buildStructure(guild) {
  const channels = [...guild.channels.cache.values()].filter(c => !c.isThread());
  const byPosition = (a, b) => a.rawPosition - b.rawPosition || a.id.localeCompare(b.id);

  const categories = channels.filter(c => c.type === ChannelType.GuildCategory).sort(byPosition);
  const children = parentId => channels
    .filter(c => c.parentId === parentId && c.type !== ChannelType.GuildCategory)
    .sort((a, b) => (a.isVoiceBased() - b.isVoiceBased()) || byPosition(a, b));

  const lines = [`SERVER ${guild.name}  (id ${guild.id})`, ''];

  const loose = children(null);
  if (loose.length) {
    lines.push('OHNE KATEGORIE');
    lines.push(...loose.map(channelLine), '');
  }

  for (const category of categories) {
    lines.push(`KATEGORIE ${category.name}  (id ${category.id})`);
    lines.push(...children(category.id).map(channelLine), '');
  }

  lines.push('ROLLEN (oben = höchste)');
  const roles = [...guild.roles.cache.values()]
    .filter(r => r.id !== guild.id)
    .sort((a, b) => b.position - a.position);
  for (const role of roles) {
    const flags = [role.managed && 'bot/integration', role.permissions.has(PermissionFlagsBits.Administrator) && 'admin']
      .filter(Boolean).join(', ');
    lines.push(`  ${role.name}  (id ${role.id}, ${role.members.size} Mitglieder${flags ? `, ${flags}` : ''})`);
  }

  return lines.join('\n');
}

async function handleCommand(interaction) {
  if (interaction.commandName !== 'serverstruktur') return false;

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ embeds: [notice('Dafür brauchst du Administrator-Rechte.', 'danger')], ephemeral: true });
    return true;
  }

  await interaction.deferReply({ ephemeral: true });
  await interaction.guild.members.fetch().catch(() => null);

  const file = new AttachmentBuilder(Buffer.from(buildStructure(interaction.guild), 'utf8'), {
    name: 'serverstruktur.txt'
  });

  await interaction.editReply({
    embeds: [notice('Hier ist die aktuelle Struktur. Es wurde nichts geändert.', 'neutral')],
    files: [file]
  });
  return true;
}

module.exports = { definitions, handleCommand, buildStructure };
