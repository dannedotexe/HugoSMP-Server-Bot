// ── Design-System ─────────────────────────────────────────────────
// Eine Quelle für Farben, Branding und Embed-Stil. Alle Embeds des Bots
// laufen über BrandEmbed, damit jede Nachricht gleich aussieht.

const { EmbedBuilder } = require('discord.js');

const BRAND_NAME = 'HugoSMP';

// Dunkle, ruhige Palette mit dezentem Violett als Akzent.
const COLORS = {
  primary: 0x7c66dc,   // gedecktes Violett – Standard für alles
  neutral: 0x2b2d31,   // Anthrazit – Logs und sachliche Infos
  success: 0x3ba776,
  warning: 0xd4a23c,
  danger: 0xd2544e,
  muted: 0x4e5058
};

// Alte, grelle Farbwerte → neue Töne. So bleiben gespeicherte
// Einstellungen (z. B. Willkommensfarbe) gültig, sehen aber einheitlich aus.
const LEGACY_COLOR_MAP = {
  '#b10de7': COLORS.primary,
  '#9b30ff': COLORS.primary,
  '#00ff88': COLORS.success,
  '#35d48a': COLORS.success,
  '#33c481': COLORS.success,
  '#00ff00': COLORS.success,
  '#ffaa00': COLORS.warning,
  '#f5b84b': COLORS.warning,
  '#ff6600': COLORS.warning,
  '#ff4444': COLORS.danger,
  '#cc0000': COLORS.danger,
  '#888888': COLORS.muted
};

const TONES = {
  primary: COLORS.primary,
  neutral: COLORS.neutral,
  success: COLORS.success,
  warning: COLORS.warning,
  danger: COLORS.danger,
  muted: COLORS.muted
};

let brandIconURL = null;

function setBrandIcon(url) {
  brandIconURL = url || null;
}

function resolveColor(color) {
  if (color === undefined || color === null || color === '') return COLORS.primary;
  if (typeof color === 'string') {
    if (TONES[color] !== undefined) return TONES[color];
    const key = color.trim().toLowerCase();
    if (LEGACY_COLOR_MAP[key] !== undefined) return LEGACY_COLOR_MAP[key];
    return color;
  }
  if (typeof color === 'number') {
    const hex = `#${color.toString(16).padStart(6, '0')}`;
    if (LEGACY_COLOR_MAP[hex] !== undefined) return LEGACY_COLOR_MAP[hex];
  }
  return color;
}

class BrandEmbed extends EmbedBuilder {
  constructor(data) {
    super(data);
    if (this.data.color === undefined) super.setColor(COLORS.primary);
    if (!this.data.footer) {
      super.setFooter({ text: BRAND_NAME, iconURL: brandIconURL || undefined });
    }
  }

  setColor(color) {
    return super.setColor(resolveColor(color));
  }

  setFooter(options) {
    if (!options) return super.setFooter(null);
    const raw = String(options.text || '').trim();
    const text = !raw || raw.toLowerCase().startsWith(BRAND_NAME.toLowerCase())
      ? (raw || BRAND_NAME)
      : `${BRAND_NAME} · ${raw}`;
    return super.setFooter({ text, iconURL: options.iconURL || brandIconURL || undefined });
  }

  setTone(tone) {
    return super.setColor(TONES[tone] ?? COLORS.primary);
  }
}

// Kurze Statusmeldungen (Erfolg, Fehler, Hinweis) im einheitlichen Stil.
const NOTICE_PREFIXES = [
  { prefix: '✅', tone: 'success' },
  { prefix: '❌', tone: 'danger' },
  { prefix: '⚠️', tone: 'warning' },
  { prefix: '⚠', tone: 'warning' },
  { prefix: 'ℹ️', tone: 'primary' },
  { prefix: '⏳', tone: 'primary' }
];

function notice(text, tone = 'primary') {
  return new BrandEmbed().setTone(tone).setDescription(text);
}

function noticeFromText(content) {
  if (typeof content !== 'string') return null;
  const trimmed = content.trim();
  const match = NOTICE_PREFIXES.find(p => trimmed.startsWith(p.prefix));
  if (!match) return null;

  const text = trimmed.slice(match.prefix.length).trim();
  if (!text) return null;
  return notice(text, match.tone);
}

module.exports = {
  BRAND_NAME,
  COLORS,
  BrandEmbed,
  notice,
  noticeFromText,
  resolveColor,
  setBrandIcon
};
