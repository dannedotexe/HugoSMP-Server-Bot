'use strict';

// Moderne Discord-Karten (Components V2): ein farbiger Rahmen mit Text,
// Bild rechts, Trennlinien und Buttons direkt in der Karte.
// Gleiche Farben wie theme.js, damit alles zusammenpasst.

const {
  ContainerBuilder,
  TextDisplayBuilder,
  SectionBuilder,
  ThumbnailBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags
} = require('discord.js');
const { COLORS, BRAND_NAME } = require('./theme');

const TONE_COLORS = {
  primary: COLORS.primary,
  neutral: COLORS.neutral,
  success: COLORS.success,
  warning: COLORS.warning,
  danger: COLORS.danger,
  muted: COLORS.muted
};

// Bild-Adresse eines eigenen Discord-Emojis (z. B. Lager-Artikel)
function emojiImageUrl(item) {
  const id = item?.emojiId || String(item?.emoji || '').match(/<a?:[^:]+:(\d+)>/)?.[1];
  if (!id) return null;
  const animated = /^<a:/.test(String(item?.emoji || ''));
  return `https://cdn.discordapp.com/emojis/${id}.${animated ? 'gif' : 'png'}?size=128`;
}

function text(content) {
  return new TextDisplayBuilder().setContent(String(content).slice(0, 4000));
}

/**
 * card({
 *   tone: 'primary' | 'success' | …,
 *   eyebrow: 'Restock',            // kleine Zeile über dem Titel
 *   title: 'Elytra',
 *   body: 'Text …',
 *   thumbnail: 'https://…',        // Bild rechts neben Titel/Text
 *   blocks: ['Text', …],           // weitere Abschnitte, durch Linien getrennt
 *   footer: 'Bestellung #12',      // kleine Zeile unten (mit Zeitstempel)
 *   rows: [ActionRowBuilder, …],   // Buttons in der Karte
 *   mention: '<@&123>',            // Ping über der Karte
 *   allowedMentions: { roles: [...] }
 * })
 */
function card({
  tone = 'primary',
  eyebrow,
  title,
  body,
  thumbnail,
  blocks = [],
  footer,
  timestamp = true,
  rows = [],
  mention,
  allowedMentions
} = {}) {
  const container = new ContainerBuilder().setAccentColor(TONE_COLORS[tone] ?? COLORS.primary);

  const head = [
    eyebrow ? `-# ${eyebrow}` : null,
    title ? `### ${title}` : null,
    body || null
  ].filter(Boolean).join('\n');

  if (head) {
    if (thumbnail) {
      container.addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(text(head))
          .setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbnail))
      );
    } else {
      container.addTextDisplayComponents(text(head));
    }
  }

  for (const block of blocks.filter(Boolean)) {
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    container.addTextDisplayComponents(text(block));
  }

  if (rows.length) {
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small));
    container.addActionRowComponents(...rows);
  }

  const footerText = [
    BRAND_NAME,
    footer || null,
    timestamp ? `<t:${Math.floor(Date.now() / 1000)}:R>` : null
  ].filter(Boolean).join(' · ');
  container.addTextDisplayComponents(text(`-# ${footerText}`));

  const components = [];
  if (mention) components.push(text(mention));
  components.push(container);

  return {
    flags: MessageFlags.IsComponentsV2,
    components,
    allowedMentions: allowedMentions || { parse: [] }
  };
}

// Text aus einer Karte lesen (für Dashboard-Verlauf und Transkripte)
function cardText(message) {
  const parts = [];
  const walk = list => {
    for (const component of list || []) {
      const data = component.data || component;
      if (typeof data.content === 'string' && data.type === 10) parts.push(data.content);
      if (component.components) walk(component.components);
      if (component.accessory?.components) walk(component.accessory.components);
    }
  };
  walk(message?.components);
  return parts.join('\n');
}

function isCardMessage(message) {
  return Boolean(Number(message?.flags?.bitfield ?? message?.flags ?? 0) & MessageFlags.IsComponentsV2);
}

module.exports = {
  card,
  cardText,
  isCardMessage,
  emojiImageUrl
};
