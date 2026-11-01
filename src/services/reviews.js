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

// Eine einzelne Bewertung als Karte (im Bewertungs-Kanal)
function buildReviewCard({ user, stars, text, item, orderId }) {
  return card({
    tone: stars >= 4 ? 'success' : stars === 3 ? 'warning' : 'danger',
    eyebrow: `Bewertung von ${user.username}`,
    title: `${'⭐'.repeat(stars)}  ${stars}/5`,
    body: `>>> ${String(text).slice(0, 1500)}`,
    thumbnail: user.displayAvatarURL({ size: 128 }),
    blocks: [`**Kunde:** <@${user.id}>  ·  **Gekauft:** ${String(item || '—').slice(0, 100)}`],
    footer: `Bestellung ${orderId}`
  });
}

module.exports = {
  buildReviewSummaryCard,
  buildReviewCard,
  buildReviewSummaryEmbed,
  refreshReviewSummary
};
