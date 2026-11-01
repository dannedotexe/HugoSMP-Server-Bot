// ── /umbenennen: Kanäle, Kategorien und Rollen einheitlich benennen ─
// Erstellt aus der aktuellen Struktur einen Plan "alt → neu", zeigt ihn
// als Vorschau und setzt ihn erst nach Klick auf "Übernehmen" um.
// Geändert werden ausschließlich Namen und die Reihenfolge der
// Kategorien – keine Rechte, keine Nachrichten, nichts wird gelöscht.

const {
  SlashCommandBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, AttachmentBuilder
} = require('discord.js');
const { BrandEmbed, notice } = require('../theme');

const SEP = '┃'; // U+2503

// Englisch/umgangssprachlich → kurzes Deutsch (für Text- und Sprachkanäle)
const TRANSLATIONS = {
  rules: 'regeln', rule: 'regeln', regelwerk: 'regeln',
  announcements: 'ankündigungen', announcement: 'ankündigungen', ankuendigungen: 'ankündigungen', updates: 'updates',
  welcome: 'willkommen', welcomes: 'willkommen',
  goodbye: 'abschied', leave: 'abschied', leaves: 'abschied', bye: 'abschied',
  general: 'allgemein', chat: 'chat', talk: 'talk',
  reviews: 'bewertungen', review: 'bewertungen', vouches: 'bewertungen', vouch: 'bewertungen', feedback: 'feedback',
  prices: 'preise', price: 'preise', pricing: 'preise',
  orders: 'bestellungen', order: 'bestellungen',
  invites: 'einladungen', invite: 'einladungen',
  leaderboard: 'bestenliste',
  roles: 'rollen', role: 'rollen', selfroles: 'rollen',
  verify: 'verifizierung', verification: 'verifizierung', verifizieren: 'verifizierung',
  media: 'medien', pictures: 'bilder', images: 'bilder', clips: 'clips',
  commands: 'befehle', bots: 'bot', bot: 'bot', cmds: 'befehle',
  logs: 'logs', log: 'logs',
  staff: 'team', mods: 'moderation', moderators: 'moderation',
  suggestions: 'vorschläge', suggestion: 'vorschläge',
  partners: 'partner', partnership: 'partner',
  information: 'infos', info: 'infos', infos: 'infos',
  giveaways: 'giveaways', giveaway: 'giveaways',
  restocks: 'restock', restock: 'restock',
  deals: 'angebote', offers: 'angebote', sales: 'angebote',
  payments: 'zahlung', payment: 'zahlung',
  waiting: 'warteraum', afk: 'afk', music: 'musik',
  'our ad': 'werbung', ad: 'werbung', ads: 'werbung', advertising: 'werbung',
  'invite rewards': 'einladungs belohnungen', rewards: 'belohnungen', reward: 'belohnungs',
  'ping claim': 'ping claim', unverified: 'unverifiziert', reports: 'meldungen', report: 'meldungen',
  alerts: 'alarme', alert: 'alarme', schematic: 'schematics', 'resource packs': 'resource packs',
  'new members': 'neue mitglieder', members: 'mitglieder'
};

// Kanal-Art → Emoji. Erste passende Regel gewinnt, gleiche Art = gleiches Emoji.
const CHANNEL_KINDS = [
  { emoji: '📜', words: ['regeln', 'tos', 'agb'] },
  { emoji: '🔒', words: ['unverifiziert'] },
  { emoji: '💰', words: ['belohnungs', 'auszahlung', 'auszahlungen'] },
  { emoji: '📺', words: ['werbung'] },
  { emoji: '📌', words: ['claim', 'pings', 'ping'] },
  { emoji: '🏗️', words: ['schematics', 'baupläne'] },
  { emoji: '🎨', words: ['resource', 'pack', 'packs', 'texture', 'texturepack'] },
  { emoji: '🚨', words: ['meldungen', 'alarme', 'warnungen'] },
  { emoji: '📢', words: ['ankündigungen', 'updates', 'announcement'] },
  { emoji: '📰', words: ['news', 'neuigkeiten'] },
  { emoji: '👋', words: ['willkommen', 'abschied', 'mitglieder'] },
  { emoji: '✅', words: ['verifizierung'] },
  { emoji: '🎭', words: ['rollen'] },
  { emoji: '📈', words: ['preise', 'stock', 'lager', 'bestand'] },
  { emoji: '📦', words: ['restock'] },
  { emoji: '🏷️', words: ['angebote'] },
  { emoji: '🛒', words: ['shop', 'market', 'kaufen', 'bestellen', 'bestellungen', 'bestell'] },
  { emoji: '🌐', words: ['website', 'web'] },
  { emoji: '⭐', words: ['bewertungen', 'feedback'] },
  { emoji: '🎉', words: ['giveaways', 'events'] },
  { emoji: '📨', words: ['einladungen', 'einladungs'] },
  { emoji: '🏆', words: ['bestenliste', 'ranking', 'top'] },
  { emoji: '📸', words: ['medien', 'bilder', 'clips', 'screenshots'] },
  { emoji: '😂', words: ['memes', 'meme'] },
  { emoji: '💡', words: ['vorschläge', 'ideen'] },
  { emoji: '🤝', words: ['partner'] },
  { emoji: '🤖', words: ['bot', 'befehle'] },
  { emoji: '📋', words: ['logs', 'transcripts', 'transkripte', 'protokoll'] },
  { emoji: '🎫', words: ['support', 'ticket', 'tickets', 'hilfe'] },
  { emoji: '❓', words: ['faq', 'fragen'] },
  { emoji: '💳', words: ['zahlung'] },
  { emoji: '🛡️', words: ['team', 'moderation', 'admin', 'staff', 'intern', 'modchat', 'mod'] },
  { emoji: 'ℹ️', words: ['infos'] },
  { emoji: '💬', words: ['allgemein', 'chat', 'general', 'talk', 'lounge', 'kundenchat'] }
];

const VOICE_KINDS = [
  { emoji: '💤', words: ['afk'] },
  { emoji: '🎵', words: ['musik'] },
  { emoji: '🎫', words: ['support', 'warteraum'] },
  { emoji: '🛡️', words: ['team', 'staff', 'moderation'] },
  { emoji: '🔊', words: [] }
];

// Kategorie → Gruppe für die Reihenfolge (0 Infos … 4 Team/Logs)
const CATEGORY_GROUPS = [
  { group: 4, words: ['team', 'staff', 'logs', 'log', 'admin', 'mod', 'moderation', 'intern', 'archiv', 'closed', 'geschlossen'] },
  { group: 3, words: ['support', 'ticket', 'tickets', 'hilfe', 'help'] },
  { group: 0, words: ['info', 'infos', 'information', 'informationen', 'start', 'wichtig', 'regeln', 'rules', 'willkommen', 'welcome', 'server'] },
  { group: 1, words: ['shop', 'market', 'store', 'preise', 'stock', 'bestellung', 'bestellungen', 'kaufen', 'website', 'angebote'] },
  { group: 2, words: ['community', 'chat', 'general', 'allgemein', 'voice', 'sprach', 'fun', 'giveaway', 'giveaways', 'events', 'medien'] }
];

const CATEGORY_TRANSLATIONS = {
  info: 'INFORMATIONEN', infos: 'INFORMATIONEN', information: 'INFORMATIONEN', informations: 'INFORMATIONEN',
  important: 'WICHTIG', welcome: 'WILLKOMMEN', general: 'ALLGEMEIN', community: 'COMMUNITY',
  shop: 'SHOP', store: 'SHOP', market: 'MARKET', support: 'SUPPORT', tickets: 'TICKETS', ticket: 'TICKETS',
  staff: 'TEAM', team: 'TEAM', logs: 'LOGS', log: 'LOGS', voice: 'VOICE', 'voice channels': 'VOICE',
  'text channels': 'TEXT', closed: 'GESCHLOSSEN', archive: 'ARCHIV', giveaways: 'GIVEAWAYS', events: 'EVENTS'
};

const PING_TOPICS = { giveaways: 'Giveaways', restocks: 'Restock', deals: 'Deals', news: 'News' };

// ── Namens-Hilfen ─────────────────────────────────────────────────

const EMOJI_RE = /(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Regional_Indicator}|‍|️|⃣)/gu;
const DECOR_RE = /[┃|︱│｜•・»«>→⁠⎮❯❮✦✧★☆◆◇■□▪▫─━═~_:]/g;

// Zierschriften (ᴘʀᴇɪꜱᴇ, 𝗣𝗥𝗘𝗜𝗦𝗘, Ｐｒｅｉｓｅ, ⓟⓡⓔⓘⓢⓔ …) → normale Buchstaben,
// sonst erkennt der Bot die Kanäle nicht.
const SMALL_CAPS = { ᴀ: 'a', ʙ: 'b', ᴄ: 'c', ᴅ: 'd', ᴇ: 'e', ꜰ: 'f', ɢ: 'g', ʜ: 'h', ɪ: 'i', ᴊ: 'j', ᴋ: 'k', ʟ: 'l', ᴍ: 'm', ɴ: 'n', ᴏ: 'o', ᴘ: 'p', ǫ: 'q', ʀ: 'r', ꜱ: 's', ᴛ: 't', ᴜ: 'u', ᴠ: 'v', ᴡ: 'w', ʏ: 'y', ᴢ: 'z' };
function plainLetters(text) {
  return String(text || '').normalize('NFKC').replace(/[ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡʏᴢ]/g, ch => SMALL_CAPS[ch]);
}

function baseWords(name) {
  return plainLetters(name)
    .replace(EMOJI_RE, ' ')
    .replace(DECOR_RE, ' ')
    .replace(/-/g, ' ')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function translateWords(words) {
  const joined = words.join(' ');
  if (TRANSLATIONS[joined]) return TRANSLATIONS[joined].split(' ');
  return words.map(w => TRANSLATIONS[w] || w);
}

function pickKind(kinds, words) {
  return kinds.find(k => k.words.some(w => words.includes(w))) || kinds[kinds.length - 1];
}

// Erstes Emoji im bisherigen Namen (z. B. „📺-our-ad“ → „📺“)
function currentEmoji(name) {
  const m = String(name || '').match(/\p{Extended_Pictographic}\uFE0F?/u);
  return m ? m[0] : null;
}

function capitalize(word) {
  return word ? word[0].toUpperCase() + word.slice(1) : word;
}

function textChannelName(channel) {
  const words = translateWords(baseWords(channel.name));
  const name = (words.join('-') || 'kanal').replace(/-+/g, '-').slice(0, 90);
  // Unbekannte Kanäle behalten ihr bisheriges Emoji statt überall 💬
  const kind = CHANNEL_KINDS.find(k => k.words.some(w => words.includes(w)));
  const emoji = kind?.emoji || currentEmoji(channel.name) || '💬';
  return `${emoji}${SEP}${name}`;
}

function voiceBase(channel) {
  // Kurze Abkürzungen in Großbuchstaben (AFK) bleiben so.
  const acronyms = new Set(String(channel.name).match(/\b[A-Z]{2,4}\b/g) || []);
  const words = translateWords(baseWords(channel.name)).filter(w => !/^\d+$/.test(w));
  return words.length
    ? words.map(w => (acronyms.has(w.toUpperCase()) ? w.toUpperCase() : capitalize(w))).join(' ')
    : 'Voice';
}

function categoryName(category) {
  const words = baseWords(category.name);
  const joined = words.join(' ');
  if (CATEGORY_TRANSLATIONS[joined]) return CATEGORY_TRANSLATIONS[joined];
  return words.map(w => CATEGORY_TRANSLATIONS[w] || w.toUpperCase()).join(' ').slice(0, 90) || category.name.toUpperCase();
}

function categoryGroup(category, children) {
  const words = [...baseWords(category.name), ...children.flatMap(c => translateWords(baseWords(c.name)))];
  const own = baseWords(category.name);
  const byOwn = CATEGORY_GROUPS.find(g => g.words.some(w => own.includes(w)));
  if (byOwn) return byOwn.group;
  const byChildren = CATEGORY_GROUPS.find(g => g.words.some(w => words.includes(w)));
  return byChildren ? byChildren.group : 2;
}

function roleName(role, pingRoleIds) {
  const topicKey = Object.keys(pingRoleIds).find(key => pingRoleIds[key] === role.id);
  if (topicKey) return `ping:${PING_TOPICS[topicKey] || capitalize(topicKey)}`;

  const clean = String(role.name)
    .replace(EMOJI_RE, ' ')
    .replace(/^\s*(ping\s*:)?\s*[|┃︱│｜•・»>\-–—]+\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return null;
  return `| ${capitalize(clean)}`.slice(0, 100);
}

// ── Plan erstellen ────────────────────────────────────────────────

function buildPlan(guild, ctx) {
  const all = [...guild.channels.cache.values()].filter(c => !c.isThread());
  const byPos = (a, b) => a.rawPosition - b.rawPosition || a.id.localeCompare(b.id);
  const isTicket = c =>
    c.parentId === ctx.ticketCategoryId ||
    c.parentId === ctx.closedTicketCategoryId ||
    /(^|;)owner:\d+/.test(c.topic || '');

  const categories = all.filter(c => c.type === ChannelType.GuildCategory).sort(byPos);
  const childrenOf = id => all.filter(c => c.parentId === id && c.type !== ChannelType.GuildCategory).sort(byPos);

  const channelRenames = [];

  // Sprachkanäle mit gleichem Grundnamen bekommen fortlaufende Nummern.
  const voices = all.filter(c => c.isVoiceBased() && !isTicket(c))
    .sort((a, b) => byPos(categories.find(x => x.id === a.parentId) || a, categories.find(x => x.id === b.parentId) || b) || byPos(a, b));
  const voiceGroups = new Map();
  for (const v of voices) {
    const base = voiceBase(v);
    if (!voiceGroups.has(base)) voiceGroups.set(base, []);
    voiceGroups.get(base).push(v);
  }
  for (const [base, list] of voiceGroups) {
    const kind = pickKind(VOICE_KINDS, base.toLowerCase().split(' '));
    const numbered = list.length > 1 || ['Voice', 'Talk', 'Sprachkanal', 'Gaming', 'Chat'].includes(base);
    list.forEach((v, i) => {
      channelRenames.push({ channel: v, to: `${kind.emoji}${SEP}${base}${numbered ? ` ${i + 1}` : ''}`.slice(0, 100) });
    });
  }

  for (const c of all) {
    if (c.type === ChannelType.GuildCategory || c.isVoiceBased() || isTicket(c)) continue;
    channelRenames.push({ channel: c, to: textChannelName(c) });
  }

  const categoryRenames = categories.map(c => ({ channel: c, to: categoryName(c) }));

  // Kategorien-Reihenfolge: Infos → Shop → Community → Support → Team/Logs
  const ordered = categories
    .map((c, index) => ({ c, index, group: categoryGroup(c, childrenOf(c.id)) }))
    .sort((a, b) => a.group - b.group || a.index - b.index)
    .map(x => x.c);
  const orderChanged = ordered.some((c, i) => c.id !== categories[i].id);

  const me = guild.members.me;
  const roleRenames = [...guild.roles.cache.values()]
    .filter(r => r.id !== guild.id && !r.managed && me && r.position < me.roles.highest.position)
    .sort((a, b) => b.position - a.position)
    .map(r => ({ role: r, to: roleName(r, ctx.pingRoles) }))
    .filter(x => x.to);

  const changed = list => list.filter(x => (x.channel || x.role).name !== x.to);

  return {
    channels: changed(channelRenames),
    categories: changed(categoryRenames),
    roles: changed(roleRenames),
    order: orderChanged ? ordered : null,
    oldOrder: categories
  };
}

function planText(plan) {
  const lines = ['ÄNDERUNGEN (alt → neu)', ''];
  if (plan.order) {
    lines.push('KATEGORIEN – REIHENFOLGE');
    plan.order.forEach((c, i) => lines.push(`  ${i + 1}. ${c.name}`));
    lines.push('');
  }
  const section = (title, list) => {
    if (!list.length) return;
    lines.push(title);
    list.forEach(x => lines.push(`  ${(x.channel || x.role).name}  →  ${x.to}`));
    lines.push('');
  };
  section('KATEGORIEN', plan.categories);
  section('KANÄLE', plan.channels);
  section('ROLLEN', plan.roles);
  if (lines.length === 2) lines.push('Alles entspricht bereits dem Schema.');
  return lines.join('\n');
}

// ── Befehl & Buttons ──────────────────────────────────────────────

const pending = new Map(); // userId → { plan, guildId, expires }

function definitions() {
  return [
    new SlashCommandBuilder()
      .setName('umbenennen')
      .setDescription('Kanäle, Kategorien und Rollen einheitlich benennen (mit Vorschau).')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON()
  ];
}

async function handlePreview(interaction, ctx) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ embeds: [notice('Dafür brauchst du Administrator-Rechte.', 'danger')], ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });
  const plan = buildPlan(interaction.guild, ctx);
  const total = plan.channels.length + plan.categories.length + plan.roles.length + (plan.order ? 1 : 0);

  if (!total) {
    return interaction.editReply({ embeds: [notice('Alles entspricht bereits dem Schema.', 'success')] });
  }

  pending.set(interaction.user.id, { plan, guildId: interaction.guild.id, expires: Date.now() + 15 * 60_000 });

  const sample = [...plan.categories, ...plan.channels].slice(0, 12)
    .map(x => `\`${x.channel.name}\` → \`${x.to}\``).join('\n');

  const embed = new BrandEmbed()
    .setTitle('Umbenennen – Vorschau')
    .setDescription(`${sample}${total > 12 ? '\n-# … vollständige Liste in der Datei' : ''}`)
    .addFields(
      { name: 'Kategorien', value: `${plan.categories.length}${plan.order ? ' + Reihenfolge' : ''}`, inline: true },
      { name: 'Kanäle', value: String(plan.channels.length), inline: true },
      { name: 'Rollen', value: String(plan.roles.length), inline: true }
    )
    .setFooter({ text: 'Nur Namen & Reihenfolge · keine Rechte · nichts wird gelöscht' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('rename_apply').setLabel('Übernehmen').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('rename_cancel').setLabel('Abbrechen').setStyle(ButtonStyle.Secondary)
  );

  const file = new AttachmentBuilder(Buffer.from(planText(plan), 'utf8'), { name: 'umbenennen-vorschau.txt' });
  return interaction.editReply({ embeds: [embed], components: [row], files: [file] });
}

async function applyPlan(guild, plan) {
  const failed = [];
  let done = 0;

  const rename = async (target, to) => {
    try {
      await target.setName(to, 'Einheitliches Namensschema (/umbenennen)');
      done++;
    } catch (e) {
      failed.push(`${target.name}: ${e.message}`);
    }
  };

  for (const x of plan.categories) await rename(x.channel, x.to);
  for (const x of plan.channels) await rename(x.channel, x.to);
  for (const x of plan.roles) await rename(x.role, x.to);

  if (plan.order) {
    try {
      const positions = plan.oldOrder.map(c => c.position).sort((a, b) => a - b);
      await guild.channels.setPositions(plan.order.map((c, i) => ({ channel: c.id, position: positions[i] })));
      done++;
    } catch (e) {
      failed.push(`Reihenfolge: ${e.message}`);
    }
  }

  return { done, failed };
}

async function handleButton(interaction) {
  const entry = pending.get(interaction.user.id);

  if (interaction.customId === 'rename_cancel') {
    pending.delete(interaction.user.id);
    return interaction.update({ embeds: [notice('Abgebrochen – es wurde nichts geändert.', 'neutral')], components: [], attachments: [] });
  }

  if (!entry || entry.expires < Date.now() || entry.guildId !== interaction.guild.id) {
    pending.delete(interaction.user.id);
    return interaction.update({ embeds: [notice('Die Vorschau ist abgelaufen. Bitte `/umbenennen` neu ausführen.', 'warning')], components: [], attachments: [] });
  }

  pending.delete(interaction.user.id);
  await interaction.update({ embeds: [notice('Wird umbenannt … das kann ein paar Minuten dauern.', 'neutral')], components: [], attachments: [] });

  const { done, failed } = await applyPlan(interaction.guild, entry.plan);
  const embed = new BrandEmbed()
    .setTone(failed.length ? 'warning' : 'success')
    .setTitle('Umbenennen abgeschlossen')
    .addFields(
      { name: 'Erledigt', value: String(done), inline: true },
      { name: 'Fehlgeschlagen', value: String(failed.length), inline: true }
    );
  if (failed.length) embed.setDescription(`\`\`\`\n${failed.slice(0, 10).join('\n').slice(0, 1800)}\n\`\`\``);

  return interaction.editReply({ embeds: [embed] });
}

async function handleCommand(interaction, ctx) {
  if (interaction.commandName !== 'umbenennen') return false;
  await handlePreview(interaction, ctx);
  return true;
}

async function handleComponent(interaction) {
  if (!interaction.isButton() || !['rename_apply', 'rename_cancel'].includes(interaction.customId)) return false;
  await handleButton(interaction);
  return true;
}

module.exports = { definitions, handleCommand, handleComponent, buildPlan, planText, textChannelName };
