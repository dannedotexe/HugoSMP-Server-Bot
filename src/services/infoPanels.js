'use strict';

// Info-Panels: „Regeln & Verifizierung“ (ein Embed mit Button) und
// „Bestell-Informationen“. Kanal-Links werden über den Kanalnamen gefunden,
// damit sie auch nach /umbenennen noch stimmen.

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const { BrandEmbed } = require('../theme');
const { plainLetters } = require('../commands/rename');
const { e, buttonEmoji } = require('../emojis');

function channelKey(name) {
  return plainLetters(name).toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Kurze Ersatz-Stichwörter, falls der Name Zierschrift enthält, die wir nicht kennen
const SHORT_KEYS = { bestellinfo: 'bestell', preiseundstock: 'preise', inviterewards: 'invite' };

function findChannel(guild, keyword) {
  const key = channelKey(keyword);
  const text = guild?.channels?.cache?.filter(c => c.type === ChannelType.GuildText);
  if (!text) return null;
  return text.find(c => channelKey(c.name).includes(key)) ||
    (SHORT_KEYS[key] ? text.find(c => channelKey(c.name).includes(SHORT_KEYS[key])) : null) ||
    null;
}

function channelLink(guild, keyword, fallbackName = keyword) {
  const channel = findChannel(guild, keyword);
  return channel ? `<#${channel.id}>` : `**#${fallbackName}**`;
}

// Abschnitt: Emoji + fette Überschrift, darunter kurze Punkte – ohne große Abstände
function section(icon, title, lines) {
  const dot = e('dot', '•');
  return [`${icon} **${title}**`, ...lines.map(line => `${dot} ${line}`)].join('\n');
}

function buildRulesVerifyPanel(guild) {
  const tickets = channelLink(guild, 'tickets');
  const info = channelLink(guild, 'bestellinfo', 'bestell-info');
  const proofs = channelLink(guild, 'bewertungen');
  const invites = channelLink(guild, 'inviterewards', 'invite-rewards');

  const description = [
    `Willkommen bei **HugoSMP Market**! Mit **Verifizieren** akzeptierst du die Regeln und schaltest alle Kanäle frei.`,
    '',
    section(e('ticket', '🎫'), 'Bestellung & Tickets', [
      `Alle Käufe laufen über ${tickets} – DMs ans Team werden ignoriert.`,
      `Vor dem Kauf ${info} lesen.`,
      'Bitte nicht drängeln oder pingen.'
    ]),
    '',
    section(e('card', '💳'), 'Handel & Sicherheit', [
      `Scam = permanenter Bann und Eintrag in ${proofs}.`,
      'Erst vollständig bezahlen, dann gibt es die Items.',
      'Stehen die Zahlungsinfos im Ticket, sofort bezahlen.',
      'Hinhalten oder Trollen = Timeout oder Handelsausschluss.'
    ]),
    '',
    section(e('shield', '🛡️'), 'Verhalten & Haftung', [
      'Keine Werbung für andere Shops oder Server (auch per DM).',
      `Invite-Betrug in ${invites} = alle Belohnungen weg.`,
      'Handel auf eigene Gefahr – für Banns/Mutes auf dem Hugo SMP haften wir nicht.'
    ])
  ].join('\n');

  const embed = new BrandEmbed()
    .setTitle('Regeln & Verifizierung')
    .setDescription(description)
    .setFooter({ text: 'Faire Handlungen sorgen für ein besseres Spielerlebnis' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('verify_member')
      .setLabel('Regeln akzeptieren & verifizieren')
      .setEmoji(buttonEmoji('check', '✅'))
      .setStyle(ButtonStyle.Primary)
  );

  return { embed, row };
}

const ORDER_INFO_TITLE = 'Bestell-Informationen';
const OLD_ORDER_INFO_TITLES = [ORDER_INFO_TITLE, '🛒 Bestell-Informationen'];

function buildOrderInfoPanel(guild) {
  const tickets = channelLink(guild, 'tickets');
  const stock = channelLink(guild, 'preiseundstock', 'preise-und-stock');

  const description = [
    'Willkommen im Shop! So läuft eine Bestellung ab:',
    '',
    section(e('box', '🔍'), '1. Bestand prüfen & Ticket öffnen', [
      `Schau in ${stock}, ob dein Item da ist.`,
      `Öffne ein Ticket in ${tickets} oder unten per Button.`,
      'Gib an: **Ingame-Name**, **Item & Menge**, **Zahlungsmethode**.'
    ]),
    '',
    section(e('card', '💳'), '2. Bezahlen', [
      'Übergeben wird erst nach Zahlungseingang.',
      'Stehen alle Daten im Ticket, bitte sofort bezahlen.'
    ]),
    '',
    section(e('cart', '📦'), '3. Übergabe via /orders', [
      'Die Items kommen über das **/orders**-System.',
      'Wir übernehmen **100 %** der Steuern – du bekommst genau deine Menge.'
    ]),
    '',
    section(e('euro', '💸'), 'Zahlungsmethoden', [
      '**PayPal**',
      '**Bitcoin**',
      '**Paysafecard** (+10 % wegen Gebühren)'
    ]),
    '',
    `${e('warn', '⚠️')} **Unnötiges Drängeln im Ticket führt zur Bestrafung oder zum Ausschluss vom Handel.**`
  ].join('\n');

  const embed = new BrandEmbed()
    .setTitle(ORDER_INFO_TITLE)
    .setDescription(description)
    .setFooter({ text: 'Sicher & einfach dank Steuer-Übernahme und Order-System' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_cat_items_geld')
      .setLabel('Jetzt bestellen')
      .setEmoji(buttonEmoji('cart', '🛒'))
      .setStyle(ButtonStyle.Success)
  );
  const stockChannel = findChannel(guild, 'preiseundstock');
  if (stockChannel) {
    row.addComponents(
      new ButtonBuilder()
        .setLabel('Preise & Lager')
        .setEmoji(buttonEmoji('chart', '📈'))
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/channels/${guild.id}/${stockChannel.id}`)
    );
  }

  return { embed, row };
}

module.exports = {
  ORDER_INFO_TITLE,
  OLD_ORDER_INFO_TITLES,
  section,
  findChannel,
  channelLink,
  buildRulesVerifyPanel,
  buildOrderInfoPanel
};
