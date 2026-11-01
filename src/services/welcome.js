'use strict';

// Aus index.js ausgelagert.

const { BrandEmbed } = require('../theme');

function buildWelcomeLeaveEmbed(template, member, color) {
  const text = template
    .replace(/{user}/g, `<@${member.id}>`)
    .replace(/{username}/g, member.user.username)
    .replace(/{server}/g, member.guild.name)
    .replace(/{count}/g, member.guild.memberCount.toString());

  return new BrandEmbed()
    .setColor(color || 'primary')
    .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL({ size: 64 }) })
    .setDescription(text)
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .setFooter({ text: `Mitglied #${member.guild.memberCount}` })
    .setTimestamp();
}

module.exports = {
  buildWelcomeLeaveEmbed,
};
