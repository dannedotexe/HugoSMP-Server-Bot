'use strict';

// Aus index.js ausgelagert.

const { GUILD_ID } = require('../config');
const { client } = require('../client');

async function getUserSummary(userId, fetchMissingUser = true) {
  if (!userId) return null;
  let user = getCachedDashboardUser(userId);

  if (!user && fetchMissingUser) {
    user = await client.users.fetch(userId).catch(() => null);
  } else if (!user) {
    client.users.fetch(userId).catch(() => {});
  }

  return {
    userId,
    username: getUserDisplayName(user, userId),
    avatarUrl: getUserAvatar(user)
  };
}

async function tryDM(user, embed) {
  try { await user.send({ embeds: [embed] }); } catch {}
}

function getUserDisplayName(user, fallbackId) {
  return user?.tag || user?.username || fallbackId;
}

function getUserAvatar(user) {
  try {
    return user?.displayAvatarURL?.({ size: 128 }) || null;
  } catch {
    return null;
  }
}

function getCachedDashboardUser(userId) {
  const guild = client.guilds.cache.get(GUILD_ID);
  return guild?.members.cache.get(userId)?.user || client.users.cache.get(userId) || null;
}

module.exports = {
  getUserDisplayName,
  getUserAvatar,
  tryDM,
  getCachedDashboardUser,
  getUserSummary,
};
