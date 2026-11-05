'use strict';

// /ankündigung – Inhaber/Admins schreiben eine Ankündigung in einem Formular,
// der Bot postet sie als Karte in #ankündigungen (optional mit Ping der
// News-Rolle, sonst niemand), loggt sie im Mod-Log und gibt den Link zurück.

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const { PING_ROLES, PUNISH_LOG_CHANNEL_ID } = require('../config');
const { card } = require('../cards');
const { e } = require('../emojis');
const { findChannel } = require('../services/infoPanels');
const { plainLetters } = require('../commands/rename');

const ANNOUNCE_CHANNEL_ID = process.env.ANNOUNCE_CHANNEL_ID || '';

// Rechte bei JEDER Interaktion prüfen, nicht nur beim Befehl
function canAnnounce(member) {
  const perms = member?.permissions;
  return Boolean(perms?.has?.(PermissionFlagsBits.ManageGuild) || perms?.has?.(PermissionFlagsBits.Administrator));
}

function announceChannel(guild) {
  return (ANNOUNCE_CHANNEL_ID && guild.channels.cache.get(ANNOUNCE_CHANNEL_ID)) ||
    guild.channels.cache.find(c =>
      (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement) &&
      /ankundigungen|ankuendigungen|announcements?/.test(plainLetters(c.name).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, ''))
    ) || null;
}

// „#bewerben“ im Text → klickbarer Kanal-Link (nur wenn der Kanal existiert)
function linkChannels(text, guild) {
  return String(text).replace(/(^|[\s(])#([\p{L}\p{N}_-]{2,50})/gu, (match, before, name) => {
    const channel = findChannel(guild, name);
    return channel ? `${before}<#${channel.id}>` : match;
  });
}

function buildAnnouncementCard({ title, text, link, authorName, ping }) {
  const rows = link
    ? [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel('Mehr erfahren').setStyle(ButtonStyle.Link).setURL(link)
    )]
    : [];
  const date = new Date().toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric' });
  return card({
    tone: 'primary',
    eyebrow: `${e('megaphone', '📢')} Ankündigung`,
    title,
    body: text,
    rows,
    footer: `${authorName} · ${date}`,
    timestamp: false,
    mention: ping && PING_ROLES.news ? `-# Für <@&${PING_ROLES.news}>` : null,
    allowedMentions: { roles: ping && PING_ROLES.news ? [PING_ROLES.news] : [] }
  });
}

module.exports = function createAnnounce() {
  async function command(interaction) {
    if (interaction.commandName !== 'ankündigung') return;
    if (!canAnnounce(interaction.member)) {
      return interaction.reply({ content: '❌ Nur Inhaber und Admins dürfen Ankündigungen posten.', ephemeral: true });
    }
    const ping = interaction.options.getBoolean('benachrichtigen') ?? true;
    return interaction.showModal(
      new ModalBuilder()
        .setCustomId(`announce_submit_${ping ? 1 : 0}`)
        .setTitle(ping ? 'Ankündigung (mit Ping)' : 'Ankündigung (ohne Ping)')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('title').setLabel('Titel').setStyle(TextInputStyle.Short)
              .setRequired(true).setMaxLength(200).setPlaceholder('z. B. Der Shop ist wieder offen!')
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('text').setLabel('Text').setStyle(TextInputStyle.Paragraph)
              .setRequired(true).setMaxLength(3500).setPlaceholder('Kanäle wie #bestellen werden automatisch verlinkt.')
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('link').setLabel('Link (optional)').setStyle(TextInputStyle.Short)
              .setRequired(false).setMaxLength(500).setPlaceholder('https://…')
          )
        )
    );
  }

  async function modal(interaction) {
    if (!canAnnounce(interaction.member)) {
      return interaction.reply({ content: '❌ Nur Inhaber und Admins dürfen Ankündigungen posten.', ephemeral: true });
    }
    const ping = interaction.customId.endsWith('_1');
    const title = interaction.fields.getTextInputValue('title').trim();
    const rawText = interaction.fields.getTextInputValue('text').trim();
    const link = (interaction.fields.getTextInputValue('link') || '').trim();

    if (link && !/^https:\/\/\S+$/i.test(link)) {
      return interaction.reply({ content: '❌ Der Link muss mit **https://** beginnen.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const channel = announceChannel(interaction.guild);
    if (!channel) {
      return interaction.editReply({ content: '❌ Kein Ankündigungs-Kanal gefunden (#ankündigungen).' });
    }

    const authorName = interaction.member?.displayName || interaction.user.username;
    let message;
    try {
      message = await channel.send(buildAnnouncementCard({
        title,
        text: linkChannels(rawText, interaction.guild),
        link,
        authorName,
        ping
      }));
    } catch (err) {
      console.error('announce error:', err.message);
      return interaction.editReply({ content: `❌ Konnte nicht in <#${channel.id}> posten. Hat der Bot dort Schreibrechte?` });
    }

    const url = `https://discord.com/channels/${interaction.guild.id}/${channel.id}/${message.id}`;

    // Prüfprotokoll fürs Team
    const log = interaction.guild.channels.cache.get(PUNISH_LOG_CHANNEL_ID);
    await log?.send(card({
      tone: 'neutral',
      eyebrow: `${e('megaphone', '📢')} Ankündigung veröffentlicht`,
      title: title.slice(0, 200),
      body: `**Von:** <@${interaction.user.id}>\n**Ping:** ${ping ? 'ja (News-Rolle)' : 'nein'}\n**Nachricht:** ${url}`,
      allowedMentions: { parse: [] }
    })).catch(() => {});

    return interaction.editReply({ content: `✅ Ankündigung veröffentlicht: ${url}` });
  }

  return {
    name: 'announce',
    commands: ['ankündigung'],
    buttons: [],
    modals: [/^announce_submit_[01]$/],
    command,
    modal
  };
};

module.exports._internals = { canAnnounce, linkChannels, buildAnnouncementCard, announceChannel };
