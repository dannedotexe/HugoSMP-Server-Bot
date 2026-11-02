'use strict';

// Aus index.js ausgelagert.

const { PermissionFlagsBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { TOKEN } = require('../config');
const coreCommands = require('./core');
const updateCommands = require('./update');
const structureCommands = require('./structure');
const renameCommands = require('./rename');
const { client } = require('../client');

async function registerCommands(guildId) {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  const commands = buildCommandDefinitions();
  await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: commands });
  console.log(`✅ Commands registered for guild ${guildId}`);
}

// Alle Slash-Befehle (die eigenen + die aus src/commands)
function buildCommandDefinitions() {
  return [
    new SlashCommandBuilder()
      .setName('setupinviterewards')
      .setDescription('Panel „Einladungs-Belohnungen“ in diesem Kanal senden (nur Admin)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON(),

    new SlashCommandBuilder()
      .setName('setupleaderboard')
      .setDescription('Live-Einladungs-Rangliste in diesem Kanal senden (nur Admin)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON(),

    new SlashCommandBuilder()
      .setName('setupstock')
      .setDescription('Öffentliches Lager-Panel ohne Buttons senden')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON(),

    new SlashCommandBuilder()
      .setName('setupstockpanel')
      .setDescription('Lager-Panel fürs Team mit Buttons senden')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON(),

    new SlashCommandBuilder()
      .setName('setuptickets')
      .setDescription('Ticket-Panel senden')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON(),

    new SlashCommandBuilder()
      .setName('setupverify')
      .setDescription('Regeln & Verifizierung (ein Embed mit Button) senden')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON(),

    new SlashCommandBuilder()
      .setName('setupbestellinfo')
      .setDescription('Bestell-Informationen als Embed in diesen Kanal senden')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addBooleanOption(opt =>
        opt.setName('aufraeumen')
          .setDescription('Alte Nachrichten in diesem Kanal löschen (Standard: ja)')
          .setRequired(false)
      )
      .toJSON(),

    new SlashCommandBuilder()
      .setName('setuproles')
      .setDescription('Panel für Ping-Rollen senden')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON(),

    new SlashCommandBuilder()
      .setName('say')
      .setDescription('Nachricht als Bot senden')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption(opt =>
        opt.setName('text')
          .setDescription('Message to send')
          .setRequired(true)
      )
      .toJSON(),

    new SlashCommandBuilder()
  .setName('website')
  .setDescription('Sendet den HugoSMP Market Website-Post.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .toJSON(),

    new SlashCommandBuilder()
      .setName('dashboard')
      .setDescription('Schickt dir den Bot-Dashboard-Link.')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON(),

    new SlashCommandBuilder()
      .setName('version')
      .setDescription('Zeigt, welche Bot-Version gerade läuft.')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON(),
    
    new SlashCommandBuilder()
      .setName('getorder')
      .setDescription('Sendet die Bestell-Anleitung.')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON(),

    new SlashCommandBuilder()
      .setName('embed')
      .setDescription('Embed als Bot senden')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption(opt =>
        opt.setName('title')
          .setDescription('Embed title')
          .setRequired(true)
      )
      .addStringOption(opt =>
        opt.setName('text')
          .setDescription('Embed text')
          .setRequired(true)
      )
      .toJSON(),

    new SlashCommandBuilder()
      .setName('clear')
      .setDescription('Nachrichten in diesem Kanal löschen')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .addIntegerOption(opt =>
        opt.setName('amount')
          .setDescription('Amount of messages to delete')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(100)
      )
      .toJSON(),

    new SlashCommandBuilder()
      .setName('inviterewards')
      .setDescription('Freunde einladen und Belohnungen sichern')
      .toJSON(),

    new SlashCommandBuilder()
      .setName('leaderboard')
      .setDescription('Die besten Einlader anzeigen')
      .toJSON(),

    new SlashCommandBuilder()
      .setName('zahlungsinfo')
      .setDescription('Zahlungsdaten festlegen, die Kunden nach der Bestellung sehen')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption(opt =>
        opt.setName('methode')
          .setDescription('Zahlungsart')
          .setRequired(true)
          .addChoices(
            { name: 'PayPal', value: 'paypal' },
            { name: 'Bitcoin', value: 'bitcoin' },
            { name: 'Paysafecard', value: 'paysafe' }
          )
      )
      .addStringOption(opt =>
        opt.setName('text')
          .setDescription('Optional – leer lassen öffnet ein Textfeld')
          .setRequired(false)
          .setMaxLength(1000)
      )
      .toJSON(),

    new SlashCommandBuilder()
      .setName('bestellung')
      .setDescription('Zeigt den Status deiner Bestellungen')
      .toJSON(),

    new SlashCommandBuilder()
      .setName('bewertungen')
      .setDescription('Zeigt die Kundenbewertungen des Shops')
      .toJSON(),

    new SlashCommandBuilder()
      .setName('fertig')
      .setDescription('Bestellung als fertig markieren + Bewertung anfordern')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption(opt =>
        opt.setName('user')
          .setDescription('Der Käufer')
          .setRequired(true)
      )
      .toJSON(),

    new SlashCommandBuilder()
      .setName('adduser')
      .setDescription('Einen User zum aktuellen Ticket hinzufügen.')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption(opt =>
        opt.setName('user')
          .setDescription('Welcher User soll hinzugefügt werden?')
          .setRequired(true)
      )
      .toJSON(),

    new SlashCommandBuilder()
      .setName('close')
      .setDescription('Ticket schließen — aktuelles oder von einem bestimmten User.')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption(o => o.setName('user').setDescription('Ticket dieses Users schließen (optional)'))
      .toJSON(),


    new SlashCommandBuilder()
      .setName('setwelcome')
      .setDescription('Willkommensnachrichten konfigurieren')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addSubcommand(sub =>
        sub.setName('set')
          .setDescription('Willkommensnachricht einrichten')
          .addChannelOption(o => o.setName('channel').setDescription('Kanal für Willkommensnachrichten').setRequired(true))
          .addStringOption(o => o.setName('nachricht').setDescription('Nachricht. Nutze {user}, {server}, {count}').setRequired(true))
          .addStringOption(o => o.setName('farbe').setDescription('Embed-Farbe (Hex, z.B. #00ff00)'))
      )
      .addSubcommand(sub =>
        sub.setName('disable').setDescription('Willkommensnachrichten deaktivieren')
      )
      .addSubcommand(sub =>
        sub.setName('preview').setDescription('Vorschau der aktuellen Willkommensnachricht')
      )
      .addSubcommand(sub =>
        sub.setName('info').setDescription('Aktuelle Konfiguration anzeigen')
      )
      .toJSON(),

    new SlashCommandBuilder()
      .setName('setleave')
      .setDescription('Leave-Nachrichten konfigurieren')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addSubcommand(sub =>
        sub.setName('set')
          .setDescription('Leave-Nachricht einrichten')
          .addChannelOption(o => o.setName('channel').setDescription('Kanal für Leave-Nachrichten').setRequired(true))
          .addStringOption(o => o.setName('nachricht').setDescription('Nachricht. Nutze {user}, {server}, {count}').setRequired(true))
          .addStringOption(o => o.setName('farbe').setDescription('Embed-Farbe (Hex, z.B. #ff0000)'))
      )
      .addSubcommand(sub =>
        sub.setName('disable').setDescription('Leave-Nachrichten deaktivieren')
      )
      .addSubcommand(sub =>
        sub.setName('preview').setDescription('Vorschau der aktuellen Leave-Nachricht')
      )
      .addSubcommand(sub =>
        sub.setName('info').setDescription('Aktuelle Konfiguration anzeigen')
      )
      .toJSON(),

    new SlashCommandBuilder()
      .setName('stock')
      .setDescription('Stock-Panel Items verwalten')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addSubcommand(sub =>
        sub.setName('additem')
          .setDescription('Neues Item zum Stock-Panel hinzufügen')
          .addStringOption(o => o.setName('name').setDescription('Item-Name').setRequired(true))
          .addStringOption(o => o.setName('preis').setDescription('Preis z.B. 1,50 €').setRequired(true))
          .addStringOption(o => o.setName('emoji').setDescription('Emoji (Standard ✅ oder custom <:Name:ID>)').setRequired(true))
          .addIntegerOption(o => o.setName('menge').setDescription('Startmenge (Standard: 0)').setMinValue(0))
      )
      .addSubcommand(sub =>
        sub.setName('removeitem')
          .setDescription('Item aus dem Stock-Panel entfernen')
          .addStringOption(o => o.setName('id').setDescription('Item-ID (aus /stock listitems)').setRequired(true))
      )
      .addSubcommand(sub =>
        sub.setName('edititem')
          .setDescription('Bestehendes Item bearbeiten')
          .addStringOption(o => o.setName('id').setDescription('Item-ID (aus /stock listitems)').setRequired(true))
          .addStringOption(o => o.setName('name').setDescription('Neuer Name'))
          .addStringOption(o => o.setName('preis').setDescription('Neuer Preis'))
          .addStringOption(o => o.setName('emoji').setDescription('Neues Emoji'))
      )
      .addSubcommand(sub =>
        sub.setName('listitems').setDescription('Alle Stock-Items anzeigen')
      )
      .toJSON(),

    new SlashCommandBuilder()
      .setName('preview')
      .setDescription('Vorschauen ohne Ping testen')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addSubcommand(sub =>
        sub.setName('restock')
          .setDescription('Restock-Nachricht ohne Rollen-Ping testen')
          .addStringOption(o => o.setName('id').setDescription('Item-ID aus /stock listitems'))
          .addIntegerOption(o => o.setName('alt').setDescription('Alter Bestand').setMinValue(0))
          .addIntegerOption(o => o.setName('neu').setDescription('Neuer Bestand').setMinValue(1))
      )
      .toJSON(),

    new SlashCommandBuilder()
      .setName('warn')
      .setDescription('Einem User eine Verwarnung geben')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
      .addStringOption(o => o.setName('grund').setDescription('Grund der Verwarnung').setRequired(true))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('warnings')
      .setDescription('Verwarnungen eines Users anzeigen')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('clearwarnings')
      .setDescription('Alle Verwarnungen eines Users löschen')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('mute')
      .setDescription('Einen User timeouten (stummschalten)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
      .addStringOption(o => o.setName('dauer').setDescription('Dauer z.B. 10m, 1h, 1d (max 28d)').setRequired(true))
      .addStringOption(o => o.setName('grund').setDescription('Grund'))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('unmute')
      .setDescription('Timeout eines Users aufheben')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
      .addStringOption(o => o.setName('grund').setDescription('Grund'))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('kick')
      .setDescription('Einen User vom Server kicken')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
      .addStringOption(o => o.setName('grund').setDescription('Grund'))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('ban')
      .setDescription('Einen User bannen')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
      .addStringOption(o => o.setName('grund').setDescription('Grund'))
      .addStringOption(o => o.setName('dauer').setDescription('Dauer z.B. 1h, 7d (leer = permanent)'))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('unban')
      .setDescription('Einen User entbannen')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption(o => o.setName('user_id').setDescription('User-ID des gebannten Users').setRequired(true))
      .addStringOption(o => o.setName('grund').setDescription('Grund'))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('modlog')
      .setDescription('Alle Strafen eines Users anzeigen')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('botstatus')
      .setDescription('Bot-Status und Aktivität ändern.')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption(o =>
        o.setName('status')
          .setDescription('Online-Status')
          .setRequired(true)
          .addChoices(
            { name: 'Online', value: 'online' },
            { name: 'Abwesend', value: 'idle' },
            { name: 'Nicht stören', value: 'dnd' },
            { name: 'Offline anzeigen', value: 'offline' }
          )
      )
      .addStringOption(o =>
        o.setName('aktivität')
          .setDescription('Was Discord neben dem Bot anzeigen soll')
          .setRequired(true)
          .addChoices(
            { name: 'Spielt', value: 'Playing' },
            { name: 'Schaut', value: 'Watching' },
            { name: 'Hört', value: 'Listening' },
            { name: 'Streamt', value: 'Streaming' },
            { name: 'Tritt an', value: 'Competing' }
          )
      )
      .addStringOption(o =>
        o.setName('text')
          .setDescription('Text neben dem Status')
          .setRequired(true)
          .setMaxLength(128)
      )
      .addStringOption(o =>
        o.setName('url')
          .setDescription('Nur für Streaming: Twitch/YouTube URL')
      )
      .toJSON(),

    new SlashCommandBuilder()
      .setName('setinvites')
      .setDescription('Einladungen manuell setzen (nur Admin)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption(opt =>
        opt.setName('user')
          .setDescription('User whose invites should be changed')
          .setRequired(true)
      )
      .addIntegerOption(opt =>
        opt.setName('amount')
          .setDescription('New invite amount')
          .setRequired(true)
          .setMinValue(0)
      )
      .toJSON(),

    new SlashCommandBuilder()
      .setName('giveaway')
      .setDescription('Giveaway verwalten')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addSubcommand(sub =>
        sub.setName('start').setDescription('Neues Giveaway starten')
          .addChannelOption(o => o.setName('channel').setDescription('Kanal').setRequired(true))
          .addStringOption(o => o.setName('preis').setDescription('Was wird verlost?').setRequired(true))
          .addStringOption(o => o.setName('dauer').setDescription('Dauer z.B. 1h, 30m, 7d').setRequired(true))
          .addIntegerOption(o => o.setName('gewinner').setDescription('Anzahl Gewinner').setMinValue(1).setMaxValue(20))
          .addIntegerOption(o => o.setName('min_invites').setDescription('Mindest-Invites zum Teilnehmen').setMinValue(0))
          .addIntegerOption(o => o.setName('min_age_tage').setDescription('Mindest-Kontoalter in Tagen').setMinValue(0))
      )
      .addSubcommand(sub =>
        sub.setName('end').setDescription('Giveaway vorzeitig beenden')
          .addStringOption(o => o.setName('message_id').setDescription('Message-ID des Giveaways').setRequired(true))
      )
      .addSubcommand(sub =>
        sub.setName('reroll').setDescription('Neuen Gewinner auslosen')
          .addStringOption(o => o.setName('message_id').setDescription('Message-ID des Giveaways').setRequired(true))
      )
      .addSubcommand(sub =>
        sub.setName('zinken').setDescription('Gewinner vorher festlegen (nur Admin)')
          .addStringOption(o => o.setName('message_id').setDescription('Message-ID des Giveaways').setRequired(true))
          .addUserOption(o => o.setName('user').setDescription('Dieser User gewinnt garantiert').setRequired(true))
      )
      .addSubcommand(sub =>
        sub.setName('list').setDescription('Alle Teilnehmer eines Giveaways anzeigen')
          .addStringOption(o => o.setName('message_id').setDescription('Message-ID des Giveaways').setRequired(true))
      )
      .addSubcommand(sub =>
        sub.setName('removeuser').setDescription('Einen User aus dem Giveaway entfernen')
          .addStringOption(o => o.setName('message_id').setDescription('Message-ID des Giveaways').setRequired(true))
          .addUserOption(o => o.setName('user').setDescription('Welcher User soll entfernt werden?').setRequired(true))
      )
      .toJSON(),

    ...coreCommands.definitions(),
    ...updateCommands.definitions(),
    ...structureCommands.definitions(),
    ...renameCommands.definitions()
  ];
}

module.exports = {
  registerCommands,
  buildCommandDefinitions,
};
