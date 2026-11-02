'use strict';

// Bewertungs-Übersicht: eine Karte mit Durchschnitt und Sterne-Verteilung,
// die im Bewertungs-Kanal immer ganz unten steht.

const { BrandEmbed } = require('../theme');
const { loadData, saveData } = require('../store');
const { getReviewSummary } = require('./stats');
const { card } = require('../cards');
const { e } = require('../emojis');

function starBar(count, max, width = 12) {
  if (!max) return '░'.repeat(width);
  const filled = Math.round((count / max) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function formatAverage(avg) {
  return avg === null ? '–' : avg.toFixed(1).replace('.', ',');
}

function buildReviewSummaryEmbed(summary = getReviewSummary(), { latest = 0 } = {}) {
  const max = Math.max(...Object.values(summary.counts));
  const lines = [5, 4, 3, 2, 1].map(n =>
    `\`${n}★\` \`${starBar(summary.counts[n] || 0, max)}\` ${summary.counts[n] || 0}`
  );

  const fullStars = summary.average ? Math.round(summary.average) : 0;
  const embed = new BrandEmbed()
    .setAuthor({ name: 'Kundenbewertungen' })
    .setTitle(summary.count
      ? `${'⭐'.repeat(fullStars)}  ${formatAverage(summary.average)} von 5`
      : 'Noch keine Bewertungen')
    .setDescription(
      (summary.count
        ? `Aus **${summary.count}** ${summary.count === 1 ? 'Bewertung' : 'Bewertungen'} echter Kunden.\n\n`
        : 'Sei der Erste, der nach einer Bestellung bewertet!\n\n') +
      lines.join('\n')
    )
    .setFooter({ text: 'Bewertungen' })
    .setTimestamp();

  if (latest > 0 && summary.latest.length) {
    embed.addFields(summary.latest.slice(0, latest).map(r => ({
      name: `${'⭐'.repeat(r.stars)} · ${r.username || 'Kunde'}`,
      value: `${r.text.slice(0, 180)}${r.text.length > 180 ? '…' : ''}${r.item ? `\n-# Gekauft: ${r.item.slice(0, 80)}` : ''}`
    })));
  }

  return embed;
}

// Alte Übersicht löschen und neu ganz unten senden.
async function refreshReviewSummary(channel) {
  if (!channel?.isTextBased?.()) return;
  const data = loadData();
  const oldId = data.reviewSummaryMessageId;
  if (oldId) {
    await channel.messages.delete(oldId).catch(() => {});
  }
  const message = await channel.send(buildReviewSummaryCard(undefined, channel.guild?.iconURL({ size: 256 }) || null)).catch(e => {
    console.error('review summary error:', e.message);
    return null;
  });
  data.reviewSummaryMessageId = message?.id || null;
  saveData(data);
}

function buildReviewSummaryCard(summary = getReviewSummary(), guildIcon = null) {
  const max = Math.max(...Object.values(summary.counts));
  const lines = [5, 4, 3, 2, 1].map(n =>
    `\`${n}★\` \`${starBar(summary.counts[n] || 0, max)}\` ${summary.counts[n] || 0}`
  );
  const fullStars = summary.average ? Math.round(summary.average) : 0;
  return card({
    tone: 'warning',
    eyebrow: `${e('star', '⭐')} Kundenbewertungen`,
    title: summary.count
      ? `${formatAverage(summary.average)} von 5  ${'⭐'.repeat(fullStars)}`
      : 'Noch keine Bewertungen',
    body: summary.count
      ? `Aus **${summary.count}** ${summary.count === 1 ? 'Bewertung' : 'Bewertungen'} echter Kunden.`
      : 'Sei der Erste, der nach einer Bestellung bewertet!',
    thumbnail: guildIcon,
    blocks: [lines.join('\n')],
    footer: 'Bewertungen'
  });
}

// Eine einzelne Bewertung als Karte (im Bewertungs-Kanal), optional mit Team-Antwort
function buildReviewCard({ user, stars, text, item, orderId, reply = null }) {
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
  const replyRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`review_reply_${orderId}`)
      .setLabel(reply ? 'Antwort ändern' : 'Antworten (Team)')
      .setEmoji('💬')
      .setStyle(ButtonStyle.Secondary)
  );
  return card({
    tone: stars >= 4 ? 'success' : stars === 3 ? 'warning' : 'danger',
    eyebrow: `Bewertung von ${user.username}`,
    title: `${'⭐'.repeat(stars)}  ${stars}/5`,
    body: `> ${String(text).slice(0, 1500).replace(/\n/g, '\n> ')}`,
    thumbnail: user.avatarUrl || user.displayAvatarURL?.({ size: 128 }) || null,
    blocks: [
      `**Kunde:** <@${user.id}>  ·  **Gekauft:** ${String(item || '—').slice(0, 100)}`,
      reply ? `${e('chat', '💬')} **Antwort vom Team** (${reply.by})\n${String(reply.text).slice(0, 1000)}` : null
    ],
    rows: [replyRow],
    footer: `Bestellung ${orderId}`
  });
}

// ── Bewertungs-Erinnerung (einmal nach 24 Std. per DM) ──
const REMIND_AFTER_MS = 24 * 60 * 60 * 1000;

function requests(data = loadData()) {
  if (!data.reviewRequests || typeof data.reviewRequests !== 'object') data.reviewRequests = {};
  return data.reviewRequests;
}

function trackReviewRequest(orderId, userId, channelId) {
  if (!orderId || !userId) return;
  const data = loadData();
  requests(data)[orderId] = { userId, channelId: channelId || null, at: Date.now(), remindedAt: null };
  saveData(data);
}

function getReviewRequest(orderId) {
  return requests()[orderId] || null;
}

function dueReviewReminders(now = Date.now(), isReviewed = () => false) {
  return Object.entries(requests())
    .filter(([orderId, r]) => !r.remindedAt && now - r.at >= REMIND_AFTER_MS && !isReviewed(orderId))
    .map(([orderId, r]) => ({ orderId, ...r }));
}

function markReviewReminded(orderId) {
  const data = loadData();
  const r = requests(data)[orderId];
  if (r) {
    r.remindedAt = Date.now();
    saveData(data);
  }
}

function buildReviewReminderCard(userId, orderId) {
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`bewerten_${userId}_${orderId}`)
      .setLabel('Jetzt bewerten')
      .setEmoji('⭐')
      .setStyle(ButtonStyle.Primary)
  );
  return card({
    tone: 'warning',
    eyebrow: '⭐ Kurze Bitte',
    title: 'Wie war deine Bestellung?',
    body: `Deine Bestellung **${orderId}** bei HugoSMP Market ist fertig. Eine kurze Bewertung hilft uns sehr – dauert nur 10 Sekunden!\n-# Danach bekommst du die **Kunden-Rolle**.`,
    rows: [row],
    footer: `Bestellung ${orderId}`,
    timestamp: false
  });
}

// Antwort vom Team speichern
function setReviewReply(orderId, reply) {
  const data = loadData();
  const review = [...(data.reviews || [])].reverse().find(r => String(r.orderId) === String(orderId));
  if (!review) return null;
  review.reply = reply;
  saveData(data);
  return review;
}

function setReviewMessage(orderId, channelId, messageId, avatarUrl) {
  const data = loadData();
  const review = [...(data.reviews || [])].reverse().find(r => String(r.orderId) === String(orderId));
  if (!review) return;
  Object.assign(review, { channelId, messageId, avatarUrl });
  saveData(data);
}

// Übersicht im Bewertungs-Kanal ist abgeschafft: alte Nachricht einmalig löschen
async function removeReviewSummary(client) {
  const data = loadData();
  const id = data.reviewSummaryMessageId;
  if (!id) return;
  const { REVIEWS_CHANNEL_ID } = require('../config');
  const channel = client.channels.cache.get(REVIEWS_CHANNEL_ID);
  await channel?.messages?.delete(id).catch(() => {});
  data.reviewSummaryMessageId = null;
  saveData(data);
}

module.exports = {
  trackReviewRequest,
  getReviewRequest,
  dueReviewReminders,
  markReviewReminded,
  buildReviewReminderCard,
  setReviewReply,
  setReviewMessage,
  removeReviewSummary,
  buildReviewSummaryCard,
  buildReviewCard,
  buildReviewSummaryEmbed,
  refreshReviewSummary
};
