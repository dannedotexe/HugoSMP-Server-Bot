'use strict';

// Aus index.js ausgelagert.

const { loadData, saveData } = require('../store');
const guildConfig = require('../guildConfig');
const { PUNISH_LOG_CHANNEL_ID } = require('../config');
const { BrandEmbed } = require('../theme');

function addWarning(userId, moderatorId, reason) {
  const data = loadData();
  if (!data.warnings[userId]) data.warnings[userId] = [];
  data.warnings[userId].push({
    id: Date.now(),
    moderatorId,
    reason,
    timestamp: Date.now()
  });
  saveData(data);
  return data.warnings[userId].length;
}

function getWarnings(userId) {
  const data = loadData();
  return data.warnings[userId] || [];
}

function clearWarnings(userId) {
  const data = loadData();
  data.warnings[userId] = [];
  saveData(data);
}

async function sendPunishLog(guild, { action, color, target, moderator, reason, duration, extra }) {
  const logChannelId = guildConfig.get(guild.id).modLogChannelId || PUNISH_LOG_CHANNEL_ID;
  const logChannel = guild.channels.cache.get(logChannelId);
  if (!logChannel) return;

  const embed = new BrandEmbed()
    .setColor(color)
    .setAuthor({ name: 'Moderation' })
    .setTitle(action)
    .addFields(
      { name: 'User', value: `<@${target.id}>\n-# ${target.tag || target.id}`, inline: true },
      { name: 'Moderator', value: `<@${moderator.id}>`, inline: true },
      { name: 'Grund', value: reason || 'Kein Grund angegeben', inline: false }
    )
    .setTimestamp();

  if (duration) embed.addFields({ name: 'Dauer', value: duration, inline: true });
  if (extra) embed.addFields({ name: 'Info', value: extra, inline: false });

  await logChannel.send({ embeds: [embed] }).catch(() => {});
}

module.exports = {
  addWarning,
  getWarnings,
  clearWarnings,
  sendPunishLog,
};
