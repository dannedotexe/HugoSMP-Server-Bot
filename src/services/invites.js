'use strict';

// Aus index.js ausgelagert.

const { loadData, saveData } = require('../store');
const { BrandEmbed } = require('../theme');
const { LEADERBOARD_CHANNEL_ID, REQUIRED_INVITES, REWARD } = require('../config');
const { client } = require('../client');

const cachedInvites = new Map();

async function cacheInvites(guild) {
  try {
    const invites = await guild.invites.fetch();

    invites.forEach(inv => {
      cachedInvites.set(inv.code, {
        inviterId: inv.inviter?.id ?? null,
        uses: inv.uses ?? 0
      });
    });

    console.log(`📋 Cached ${invites.size} invites for ${guild.name}`);
  } catch (e) {
    console.error('cacheInvites error:', e.message);
  }
}

function buildLeaderboardEmbed(data = loadData()) {
  const botId = client.user.id;

  const sorted = Object.entries(data.invites)
    .filter(([userId, v]) => v > 0 && userId !== botId)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  // Format "**N** invite(s)" bleibt, importInvitesFromLeaderboardMessage liest es.
  const lines = sorted.length > 0
    ? sorted.map(([userId, count], i) =>
        `\`${String(i + 1).padStart(2, '0')}\`  <@${userId}> · **${count}** ${count === 1 ? 'Einladung' : 'Einladungen'}`
      ).join('\n')
    : '-# Noch keine Einladungen vorhanden.';

  return new BrandEmbed()
    .setTitle('Einladungs-Rangliste')
    .setDescription(lines)
    .setFooter({ text: `Ziel: ${REQUIRED_INVITES} verifizierte Einladungen · Belohnung: ${REWARD}` })
    .setTimestamp();
}

function importInvitesFromLeaderboardMessage(data, message) {
  const description = message.embeds?.[0]?.description;
  if (!description) return false;

  let changed = false;

  for (const line of description.split('\n')) {
    const userMatch = line.match(/<@!?(\d{17,20})>/);
    const countMatch = line.match(/(?:\*\*)?(\d+)(?:\*\*)?\s+(?:invite|Einladung)/i);

    if (!userMatch || !countMatch) continue;

    const userId = userMatch[1];
    const count = Number(countMatch[1]);

    if (!Number.isFinite(count)) continue;

    if (data.invites[userId] === undefined) {
      data.invites[userId] = count;
      changed = true;
    }
  }

  return changed;
}

function leaderboardMessageHasInviteCounts(message) {
  const description = message.embeds?.[0]?.description;
  if (!description) return false;

  return description
    .split('\n')
    .some(line =>
      /<@!?\d{17,20}>/.test(line) &&
      /(?:\*\*)?\d+(?:\*\*)?\s+(?:invite|Einladung)/i.test(line)
    );
}

async function findExistingLeaderboardMessage(channel, preferWithInvites = false) {
  const messages = await channel.messages.fetch({ limit: 100 });
  const leaderboards = messages
    .filter(msg =>
      msg.author?.id === client.user.id &&
      msg.embeds?.some(msgEmbed => /Invite Leaderboard|Einladungs-Rangliste/.test(msgEmbed.title || ''))
    )
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp);

  if (preferWithInvites) {
    const messageWithInvites = leaderboards.find(leaderboardMessageHasInviteCounts);
    if (messageWithInvites) return messageWithInvites;
  }

  return leaderboards.first() || null;
}

async function updateLeaderboard() {
  try {
    const channel = client.channels.cache.get(LEADERBOARD_CHANNEL_ID);
    if (!channel) return;

    const data = loadData();
    let leaderboardMessage = null;
    const shouldPreferImportSource = Object.keys(data.invites || {}).length === 0;

    if (data.leaderboardMessageId) {
      try {
        leaderboardMessage = await channel.messages.fetch(data.leaderboardMessageId);
      } catch (e) {}
    }

    if (
      !leaderboardMessage ||
      (shouldPreferImportSource && !leaderboardMessageHasInviteCounts(leaderboardMessage))
    ) {
      const foundLeaderboardMessage = await findExistingLeaderboardMessage(channel, shouldPreferImportSource);
      if (foundLeaderboardMessage) {
        leaderboardMessage = foundLeaderboardMessage;
      }
    }

    if (leaderboardMessage && importInvitesFromLeaderboardMessage(data, leaderboardMessage)) {
      saveData(data);
    }

    const embed = buildLeaderboardEmbed(data);

    if (leaderboardMessage) {
      await leaderboardMessage.edit({ embeds: [embed] });
      data.leaderboardMessageId = leaderboardMessage.id;
      saveData(data);
      return leaderboardMessage;
    }

    leaderboardMessage = await channel.send({ embeds: [embed] });
    data.leaderboardMessageId = leaderboardMessage.id;
    saveData(data);
    return leaderboardMessage;
  } catch (e) {
    console.error('updateLeaderboard error:', e.message);
  }
}

module.exports = {
  cachedInvites,
  cacheInvites,
  buildLeaderboardEmbed,
  importInvitesFromLeaderboardMessage,
  leaderboardMessageHasInviteCounts,
  findExistingLeaderboardMessage,
  updateLeaderboard,
};
