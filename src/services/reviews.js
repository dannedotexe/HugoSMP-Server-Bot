'use strict';

// Bewertungs-Übersicht: eine Karte mit Durchschnitt und Sterne-Verteilung,
// die im Bewertungs-Kanal immer ganz unten steht.

const { BrandEmbed } = require('../theme');
const { loadData, saveData } = require('../store');
const { getReviewSummary } = require('./stats');

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
  const message = await channel.send({ embeds: [buildReviewSummaryEmbed()] }).catch(e => {
    console.error('review summary error:', e.message);
    return null;
  });
  data.reviewSummaryMessageId = message?.id || null;
  saveData(data);
}

module.exports = {
  buildReviewSummaryEmbed,
  refreshReviewSummary
};
