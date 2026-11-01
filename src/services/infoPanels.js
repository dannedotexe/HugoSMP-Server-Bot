'use strict';

// Info-Panels: „Regeln & Verifizierung“ (ein Embed mit Button) und
// „Bestell-Informationen“. Kanal-Links werden über den Kanalnamen gefunden,
// damit sie auch nach /umbenennen noch stimmen.

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const { BrandEmbed } = require('../theme');
const { plainLetters } = require('../commands/rename');

function channelKey(name) {
  return plainLetters(name).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findChannel(guild, keyword) {
  const key = channelKey(keyword);
  return guild?.channels?.cache?.find(c =>
    c.type === ChannelType.GuildText && channelKey(c.name).includes(key)
  ) || null;
}

function channelLink(guild, keyword, fallbackName = keyword) {
  const channel = findChannel(guild, keyword);
  return channel ? `<#${channel.id}>` : `**#${fallbackName}**`;
}

function buildRulesVerifyPanel(guild, moneyRate) {
  const tickets = channelLink(guild, 'tickets');
  const info = channelLink(guild, 'bestellinfo', 'bestell-info');
  const proofs = channelLink(guild, 'proofs');
  const invites = channelLink(guild, 'inviterewards', 'invite-rewards');

  const description = [
    'Willkommen bei **HugoSMP Market**! Bitte lies die Regeln kurz durch.',
    'Mit dem Klick auf **Verifizieren** erkennst du sie an und schaltest alle Kanäle frei.',
    '',
    '### 🎫 Bestellablauf & Tickets',
    `• **Ticket-Pflicht:** Alle Käufe laufen über ${tickets}. Wer Teammitglieder privat (DM) anschreibt, wird ignoriert.`,
    `• **Bestell-Infos:** Lies vor dem Kauf ${info}, um den Ablauf zu verstehen.`,
    '• **Geduld:** Tickets werden schnellstmöglich bearbeitet. Unnötiges Pingen verzögert alles.',
    '',
    '### 💳 Handel & Sicherheit',
    `• **Scamming:** Betrugsversuche führen zum permanenten Bann und einem Eintrag in ${proofs}.`,
    '• **Vorkasse:** Erst wird vollständig bezahlt, dann werden die Items (z. B. *Gilded Blackstone* oder Ingame-Geld) übergeben.',
    '• **Keine Verzögerungen:** Stehen die Zahlungsinfos im Ticket, wird sofort bezahlt.',
    '• **Hinhalten:** Unnötiges Verzögern oder „Trolling“ beim Bezahlen wird mit Timeout oder Handelsausschluss bestraft.',
    '',
    '### 🛡️ Verhalten & Haftung',
    '• **Eigenwerbung:** Werbung für andere Shops oder Server (auch per DM) ist verboten.',
    `• **Invite-Rewards:** Wer Invites in ${invites} ausnutzt (Bots/Fakes), verliert alle Belohnungen.`,
    '• **Haftung:** Handel auf eigene Gefahr. Wir haften nicht für Banns/Mutes auf dem Hugo SMP durch Verstöße gegen EULA oder Serverregeln.',
    '',
    '-# Faire Handlungen sorgen für ein besseres Spielerlebnis für alle!'
  ].join('\n');

  const embed = new BrandEmbed()
    .setTitle('📜 Regeln & Verifizierung')
    .setDescription(description)
    .addFields({ name: 'Kurs', value: moneyRate, inline: true })
    .setThumbnail(guild?.iconURL?.({ size: 256 }) || null);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('verify_member')
      .setLabel('Regeln akzeptieren & verifizieren')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success)
  );

  return { embed, row };
}

const ORDER_INFO_TITLE = '🛒 Bestell-Informationen';

function buildOrderInfoPanel(guild) {
  const tickets = channelLink(guild, 'tickets');
  const stock = channelLink(guild, 'preiseundstock', 'preise-und-stock');

  const embed = new BrandEmbed()
    .setTitle(ORDER_INFO_TITLE)
    .setDescription('Willkommen im Shop! So läuft eine Bestellung reibungslos ab.')
    .addFields(
      {
        name: '1 · 🔍 Bestand prüfen & Ticket öffnen',
        value:
          `Schau zuerst in ${stock}, ob dein Item da ist.\n` +
          `Öffne dann ein Ticket in ${tickets} (oder unten per Button) und gib an:\n` +
          '▸ Ingame-Name\n▸ Item & Menge\n▸ Zahlungsmethode'
      },
      {
        name: '2 · 💳 Bezahlen',
        value:
          'Bearbeitet und übergeben wird erst nach Zahlungseingang.\n' +
          'Sobald alle Daten im Ticket stehen, bitte sofort bezahlen – keine Verzögerungen.'
      },
      {
        name: '3 · 📦 Übergabe via /orders',
        value:
          'Die Items kommen über das **/orders**-System.\n' +
          'Die Steuern übernehmen wir zu **100 %** – du bekommst genau die Menge, die du bezahlt hast.'
      },
      {
        name: '💸 Zahlungsmethoden',
        value: '» **PayPal**\n» **Bitcoin**\n» **Paysafecard** (+10 % wegen Gebühren)',
        inline: true
      },
      {
        name: '🛡️ Sicher & einfach',
        value: 'Dank Steuer-Übernahme und Order-System ist alles sicher und unkompliziert.',
        inline: true
      },
      {
        name: '⚠️ Wichtig',
        value: '**Unnötiges Drängeln im Ticket führt zur Bestrafung oder zum Ausschluss vom Handel.**'
      }
    )
    .setThumbnail(guild?.iconURL?.({ size: 256 }) || null);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_cat_items_geld')
      .setLabel('Jetzt bestellen')
      .setEmoji('🛒')
      .setStyle(ButtonStyle.Success)
  );
  const stockChannel = findChannel(guild, 'preiseundstock');
  if (stockChannel) {
    row.addComponents(
      new ButtonBuilder()
        .setLabel('Preise & Lager')
        .setEmoji('📈')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/channels/${guild.id}/${stockChannel.id}`)
    );
  }

  return { embed, row };
}

module.exports = {
  ORDER_INFO_TITLE,
  findChannel,
  channelLink,
  buildRulesVerifyPanel,
  buildOrderInfoPanel
};
