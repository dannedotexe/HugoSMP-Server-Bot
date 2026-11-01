'use strict';

// Aus index.js ausgelagert.

const { formatTimeLeft } = require('../util');
const { BrandEmbed, notice } = require('../theme');
const { loadData, saveData } = require('../store');
const { client } = require('../client');

function buildGiveawayEmbed(gw, ended = false) {
  const timeLeft = ended ? 'Beendet' : formatTimeLeft(gw.endTime - Date.now());
  const reqs = [];
  if (gw.minInvites > 0) reqs.push(`Mindestens **${gw.minInvites}** Einladungen`);
  if (gw.minAccountAgeDays > 0) reqs.push(`Konto älter als **${gw.minAccountAgeDays}** Tage`);

  const embed = new BrandEmbed()
    .setColor(ended ? 'muted' : 'primary')
    .setAuthor({ name: ended ? 'Giveaway beendet' : 'Giveaway' })
    .setTitle(gw.prize)
    .addFields(
      { name: ended ? 'Endete' : 'Endet', value: `<t:${Math.floor(gw.endTime / 1000)}:R>`, inline: true },
      { name: 'Gewinner', value: String(gw.winnersCount), inline: true },
      { name: 'Teilnehmer', value: String(gw.participants.length), inline: true },
      { name: 'Veranstaltet von', value: `<@${gw.hostedBy}>`, inline: true }
    );

  if (reqs.length) embed.addFields({ name: 'Voraussetzungen', value: reqs.map(x => `• ${x}`).join('\n'), inline: false });
  if (ended) {
    embed.addFields({
      name: 'Ergebnis',
      value: gw.winners?.length ? gw.winners.map(w => `<@${w}>`).join(', ') : 'Keine gültigen Teilnehmer.',
      inline: false
    });
  }

  embed
    .setFooter({ text: ended ? 'Beendet' : 'Teilnahme über den Button' })
    .setTimestamp(new Date(gw.endTime));

  return embed;
}

async function endGiveaway(messageId) {
  const data = loadData();
  const gw = data.giveaways[messageId];
  if (!gw || gw.ended) return;

  gw.ended = true;

  let pool = [...gw.participants];
  const winners = [];

  // If zinked, that person wins
  if (gw.zinkedWinner) {
    winners.push(gw.zinkedWinner);
    pool = pool.filter(p => p !== gw.zinkedWinner);
  }

  // Fill remaining winner slots
  const remaining = gw.winnersCount - winners.length;
  for (let i = 0; i < remaining && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    winners.push(pool[idx]);
    pool.splice(idx, 1);
  }

  gw.winners = winners;
  saveData(data);

  try {
    const channel = client.channels.cache.get(gw.channelId);
    if (!channel) return;
    const msg = await channel.messages.fetch(messageId).catch(() => null);
    if (!msg) return;

    const endedEmbed = buildGiveawayEmbed(gw, true);
    await msg.edit({ embeds: [endedEmbed], components: [] });

    if (winners.length > 0) {
      await channel.send({
        content: winners.map(w => `<@${w}>`).join(' '),
        embeds: [notice(`Glückwunsch! Ihr habt **${gw.prize}** gewonnen.`, 'success')]
      });
    } else {
      await channel.send({ embeds: [notice(`Das Giveaway **${gw.prize}** ist beendet – es gab keine gültigen Teilnehmer.`, 'muted')] });
    }
  } catch (e) {
    console.error('endGiveaway error:', e.message);
  }
}

module.exports = {
  buildGiveawayEmbed,
  endGiveaway,
};
