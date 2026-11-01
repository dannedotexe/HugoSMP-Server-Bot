'use strict';

// Aus index.js ausgelagert.

const { DASHBOARD_URL, DM_STAFF_CHANNEL_ID, DM_STAFF_MENTION, GUILD_ID, MAX_DASHBOARD_ATTACHMENTS, MAX_DASHBOARD_ATTACHMENT_BYTES, MAX_DASHBOARD_ATTACHMENT_TOTAL_BYTES } = require('../config');
const { loadData, saveData } = require('../store');
const { BrandEmbed } = require('../theme');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getUserAvatar, getUserDisplayName } = require('./users');
const { client } = require('../client');

const MAX_DM_MESSAGES_PER_THREAD = 200;

function ensureDmThread(data, user, userId) {
  data.dmThreads = data.dmThreads || {};

  const id = String(user?.id || userId || '').trim();
  if (!id) return null;

  const thread = data.dmThreads[id] || {
    userId: id,
    username: id,
    globalName: null,
    avatarUrl: null,
    unreadCount: 0,
    archived: false,
    archivedAt: null,
    answeredAt: null,
    lastMessageAt: null,
    messages: []
  };

  thread.userId = id;
  thread.username = getUserDisplayName(user, thread.username || id);
  thread.globalName = user?.globalName || thread.globalName || null;
  thread.avatarUrl = getUserAvatar(user) || thread.avatarUrl || null;
  thread.messages = Array.isArray(thread.messages) ? thread.messages : [];
  thread.unreadCount = Number(thread.unreadCount || 0);
  thread.archived = Boolean(thread.archived);
  thread.archivedAt = thread.archivedAt || null;
  thread.answeredAt = thread.answeredAt || null;

  data.dmThreads[id] = thread;
  return thread;
}

function cleanDmContent(content) {
  return String(content || '').trim().slice(0, 1800);
}

function getMessageAttachments(message) {
  if (!message?.attachments?.size) return [];

  return [...message.attachments.values()].slice(0, 8).map(attachment => ({
    name: attachment.name || 'attachment',
    url: attachment.url,
    contentType: attachment.contentType || null,
    size: attachment.size || 0
  }));
}

function makeDashboardError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function sanitizeDashboardFileName(name) {
  return String(name || 'attachment')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'attachment';
}

function normalizeDashboardAttachments(input) {
  const attachments = Array.isArray(input) ? input : [];
  if (attachments.length > MAX_DASHBOARD_ATTACHMENTS) {
    throw makeDashboardError(`Maximal ${MAX_DASHBOARD_ATTACHMENTS} Anhänge pro Nachricht.`);
  }

  const files = [];
  let totalBytes = 0;

  for (const item of attachments) {
    const raw = String(item?.data || '').trim();
    if (!raw) continue;

    const base64 = raw.includes(',') ? raw.slice(raw.indexOf(',') + 1) : raw;
    if (!/^[a-z0-9+/=\r\n]+$/i.test(base64)) {
      throw makeDashboardError('Ein Anhang konnte nicht gelesen werden.');
    }

    const buffer = Buffer.from(base64, 'base64');
    if (!buffer.length) continue;

    if (buffer.length > MAX_DASHBOARD_ATTACHMENT_BYTES) {
      throw makeDashboardError('Ein Anhang ist zu groß. Maximal 8 MB pro Datei.');
    }

    totalBytes += buffer.length;
    if (totalBytes > MAX_DASHBOARD_ATTACHMENT_TOTAL_BYTES) {
      throw makeDashboardError('Die Anhänge sind zusammen zu groß. Maximal 12 MB pro Nachricht.');
    }

    files.push({
      attachment: buffer,
      name: sanitizeDashboardFileName(item?.name)
    });
  }

  return files;
}

function isDmThreadAnswered(thread) {
  const messages = Array.isArray(thread?.messages) ? thread.messages : [];
  let lastIn = 0;
  let lastOut = 0;

  for (const message of messages) {
    if (message.direction === 'in') lastIn = Math.max(lastIn, Number(message.timestamp || 0));
    if (message.direction === 'out') lastOut = Math.max(lastOut, Number(message.timestamp || 0));
  }

  return lastOut > 0 && lastOut >= lastIn;
}

function addDmThreadMessage({ user, userId, direction, content, discordMessageId, attachments = [] }) {
  const cleanContent = cleanDmContent(content);
  if (!cleanContent && attachments.length === 0) return null;

  const data = loadData();
  const thread = ensureDmThread(data, user, userId);
  if (!thread) return null;

  const timestamp = Date.now();
  const message = {
    id: discordMessageId || `${timestamp}-${Math.random().toString(16).slice(2)}`,
    direction,
    content: cleanContent,
    attachments,
    timestamp
  };

  thread.messages.push(message);
  if (thread.messages.length > MAX_DM_MESSAGES_PER_THREAD) {
    thread.messages = thread.messages.slice(-MAX_DM_MESSAGES_PER_THREAD);
  }

  thread.lastMessageAt = timestamp;
  if (direction === 'in') {
    thread.unreadCount = (thread.unreadCount || 0) + 1;
    thread.archived = false;
    thread.archivedAt = null;
  } else if (direction === 'out') {
    thread.answeredAt = timestamp;
    thread.unreadCount = 0;
  }

  saveData(data);
  return { thread, message };
}

function serializeDmThread(thread, includeMessages = false) {
  const messages = Array.isArray(thread.messages) ? thread.messages : [];
  const lastMessage = messages[messages.length - 1] || null;

  const base = {
    userId: thread.userId,
    username: thread.username || thread.userId,
    globalName: thread.globalName || null,
    avatarUrl: thread.avatarUrl || null,
    unreadCount: Number(thread.unreadCount || 0),
    archived: Boolean(thread.archived),
    archivedAt: thread.archivedAt || null,
    answeredAt: thread.answeredAt || null,
    answered: isDmThreadAnswered(thread),
    messageCount: messages.length,
    lastMessageAt: thread.lastMessageAt || lastMessage?.timestamp || null,
    lastMessage
  };

  if (includeMessages) {
    base.messages = messages;
  }

  return base;
}

async function getDmUserInfo(userId, data = loadData()) {
  const user = await client.users.fetch(userId).catch(() => null);
  const guild = client.guilds.cache.get(GUILD_ID) || null;
  const member = guild
    ? await guild.members.fetch(userId).catch(() => null)
    : null;

  const roles = member
    ? member.roles.cache
      .filter(role => role.id !== guild.id)
      .sort((a, b) => b.position - a.position)
      .map(role => ({
        id: role.id,
        name: role.name,
        color: role.hexColor && role.hexColor !== '#000000' ? role.hexColor : null
      }))
      .slice(0, 15)
    : [];

  const warnings = Array.isArray(data.warnings?.[userId]) ? data.warnings[userId] : [];
  const recentWarnings = warnings.slice(-5).reverse().map((warning, index) => ({
    number: warnings.length - index,
    reason: warning.reason || 'Kein Grund angegeben',
    moderatorId: warning.moderatorId || null,
    timestamp: warning.timestamp || null
  }));

  return {
    userId,
    tag: getUserDisplayName(user, userId),
    avatarUrl: getUserAvatar(user),
    inGuild: Boolean(member),
    joinedAt: member?.joinedTimestamp || null,
    createdAt: user?.createdTimestamp || null,
    roles,
    invites: Number(data.invites?.[userId] || 0),
    warningsCount: warnings.length,
    warnings: recentWarnings
  };
}

async function notifyStaffAboutDm(saved) {
  if (!saved?.thread || !saved?.message || !DM_STAFF_CHANNEL_ID) return;

  try {
    const channel = await client.channels.fetch(DM_STAFF_CHANNEL_ID).catch(() => null);
    if (!channel?.isTextBased?.()) return;

    const { thread, message } = saved;
    const contentPreview = message.content
      ? message.content.slice(0, 1000)
      : `${message.attachments?.length || 0} Anhang/Anhänge`;

    const embed = new BrandEmbed()
      .setTone('neutral')
      .setTitle('Neue Direktnachricht')
      .setDescription(contentPreview || 'Neue Nachricht erhalten.')
      .addFields(
        { name: 'User', value: `<@${thread.userId}>`, inline: true },
        { name: 'User-ID', value: thread.userId, inline: true },
        { name: 'Ungelesen', value: String(thread.unreadCount || 1), inline: true }
      )
      .setTimestamp();

    if (thread.avatarUrl) embed.setThumbnail(thread.avatarUrl);
    if (message.attachments?.length) {
      embed.addFields({
        name: 'Anhänge',
        value: message.attachments.map(file => file.name || 'Anhang').slice(0, 5).join(', '),
        inline: false
      });
    }

    const components = DASHBOARD_URL
      ? [new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setURL(DASHBOARD_URL)
            .setLabel('Dashboard öffnen')
        )]
      : [];

    await channel.send({
      content: DM_STAFF_MENTION || undefined,
      embeds: [embed],
      components
    }).catch(() => {});
  } catch (e) {
    console.error('dm staff notify error:', e.message);
  }
}

module.exports = {
  MAX_DM_MESSAGES_PER_THREAD,
  ensureDmThread,
  cleanDmContent,
  getMessageAttachments,
  makeDashboardError,
  sanitizeDashboardFileName,
  normalizeDashboardAttachments,
  isDmThreadAnswered,
  addDmThreadMessage,
  serializeDmThread,
  getDmUserInfo,
  notifyStaffAboutDm,
};
