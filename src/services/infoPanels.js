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

function buildRulesVerifyPanel(guild) {
  const tickets = channelLink(guild, 'tickets');
  const info = channelLink(guild, 'bestellinfo', 'bestell-info');
  const proofs = channelLink(guild, 'bewertungen');
  const invites = channelLink(guild, 'inviterewards', 'invite-rewards');

  const embed = new BrandEmbed()
    .setTitle('📜 Regeln & Verifizierung')
    .setDescription(
      'Willkommen bei **HugoSMP Market**!\n' +
      'Lies dir die Regeln kurz durch. Mit **Verifizieren** akzeptierst du sie und schaltest alle Kanäle frei.'
    )
    .addFields(
      {
        name: '🎫 Bestellung & Tickets',
        value: [
          `• Alle Käufe laufen über ${tickets} – private DMs ans Team werden ignoriert.`,
          `• Lies vor dem Kauf ${info}.`,
          '• Bitte nicht drängeln oder pingen, wir antworten so schnell wie möglich.'
        ].join('\n')
      },
      {
        name: '💳 Handel & Sicherheit',
        value: [
          `• Scam-Versuche = permanenter Bann und Eintrag in ${proofs}.`,
          '• Erst vollständig bezahlen, dann gibt es die Items.',
          '• Stehen die Zahlungsinfos im Ticket, bitte sofort bezahlen.',
          '• Hinhalten oder Trollen beim Bezahlen = Timeout oder Handelsausschluss.'
        ].join('\n')
      },
      {
        name: '🛡️ Verhalten & Haftung',
        value: [
          '• Keine Werbung für andere Shops oder Server (auch nicht per DM).',
          `• Invite-Betrug (Bots/Fakes) in ${invites} = alle Belohnungen weg.`,
          '• Handel auf eigene Gefahr. Für Banns/Mutes auf dem Hugo SMP haften wir nicht.'
        ].join('\n')
      }
    )
    .setFooter({ text: 'Faire Handlungen sorgen für ein besseres Spielerlebnis' })
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
