const {
  Client, GatewayIntentBits, EmbedBuilder,
  ButtonBuilder, ButtonStyle, ActionRowBuilder,
  REST, Routes, SlashCommandBuilder, PermissionFlagsBits,
  ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle,
  AttachmentBuilder, ActivityType, Partials
} = require('discord.js');

const fs = require('fs'); 
const path = require('path');
const express = require('express');
const cors = require('cors');
const { execSync } = require('child_process');
const { BrandEmbed, notice, noticeFromText, setBrandIcon } = require('./src/theme');
const guildConfig = require('./src/guildConfig');
const coreCommands = require('./src/commands/core');
const updateCommands = require('./src/commands/update');
const structureCommands = require('./src/commands/structure');
const renameCommands = require('./src/commands/rename');

// Aktueller Git-Commit, damit man sieht, ob das Auto-Update gegriffen hat.
function readGitCommitFromFiles() {
  // Fallback ohne git-Binary: Commit direkt aus .git lesen
  const gitDir = path.join(__dirname, '.git');
  const head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
  if (!head.startsWith('ref: ')) return head;

  const ref = head.slice(5);
  const refFile = path.join(gitDir, ref);
  if (fs.existsSync(refFile)) return fs.readFileSync(refFile, 'utf8').trim();

  const packed = fs.readFileSync(path.join(gitDir, 'packed-refs'), 'utf8');
  const line = packed.split('\n').find(l => l.endsWith(` ${ref}`));
  return line ? line.split(' ')[0] : '';
}

let BOT_VERSION = 'unbekannt';
try {
  BOT_VERSION = execSync('git log -1 --format="%h (%cd)" --date=format:"%d.%m.%Y %H:%M"', { cwd: __dirname, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
} catch (e) {
  console.warn('git version lookup failed:', e.message.split('\n')[0]);
  try {
    const commit = readGitCommitFromFiles();
    if (commit) BOT_VERSION = commit.slice(0, 7);
  } catch (err) {
    console.warn('git version fallback failed:', err.message);
  }
}

loadLocalEnv();

function loadLocalEnv(file = path.join(__dirname, '.env')) {
  if (!fs.existsSync(file)) return;

  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();

    if (!key || process.env[key] !== undefined) continue;
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

const {
  PRESENCE_CONFIG_FILE,
  DEFAULT_PRESENCE_CONFIG,
  loadPresenceConfig,
  normalizePresenceStatus,
  getActivityType,
  applyConfiguredPresence,
} = require('./src/services/presence');
const {
  client,
} = require('./src/client');
// ── Config ── (src/config.js)
const {
  TOKEN,
  DATA_FILE,
  PORT,
  WEBSITE_URL,
  DASHBOARD_PASSWORD,
  DASHBOARD_URL,
  GUILD_ID,
  REVIEWS_CHANNEL_ID,
  KUNDEN_ROLE_ID,
  REQUIRED_INVITES,
  REWARD,
  RULES_CHANNEL_ID,
  VERIFY_ROLE_ID,
  REWARD_LOG_ID,
  LEADERBOARD_CHANNEL_ID,
  TICKET_CATEGORY_ID,
  CLOSED_TICKET_CATEGORY_ID,
  TICKET_LOG_CHANNEL_ID,
  DM_STAFF_CHANNEL_ID,
  DM_STAFF_MENTION,
  MAX_DASHBOARD_ATTACHMENTS,
  MAX_DASHBOARD_ATTACHMENT_BYTES,
  MAX_DASHBOARD_ATTACHMENT_TOTAL_BYTES,
  STOCK_CHANNEL_ID,
  RESTOCK_CHANNEL_ID,
  SHOP_PANEL_CHANNEL_ID,
  PUNISH_LOG_CHANNEL_ID,
  STAFF_ROLE_IDS,
  PING_ROLES,
  MIN_ACCOUNT_AGE_MS,
  STOCK_ITEMS,
} = require('./src/config');
guildConfig.init(process.env.GUILD_CONFIG_FILE || path.join(path.dirname(DATA_FILE), 'guild-config.json'));

// ── Hilfsfunktionen ── (src/util.js)
const {
  cleanUsername,
  cleanShortText,
  cleanLongText,
  normalizeStockItemId,
  parsePriceNumber,
  formatEuroValue,
  parseDuration,
  formatTimeLeft,
  joinEmbedLines,
  stockStatusText,
} = require('./src/util');

// ── Data helpers ── (src/store.js)
const {
  loadData,
  saveData,
  getInvites,
  setInvites,
  addInvite,
  hasBeenCounted,
  markAsCounted,
  setPending,
  getPending,
  removePending,
  getNextOrderId,
  getNextTicketOrderId,
  hasReviewedOrder,
  markReviewedOrder,
  hasReviewDecision,
  markReviewDecision,
  hasOrderFormSubmitted,
  markOrderFormSubmitted,
} = require('./src/store');

// ── Helpers ───────────────────────────────────────────────────────
const {
  closingTickets,
  isStaff,
  getTicketOwnerId,
  getTicketType,
  getTicketOrderId,
  buildTranscript,
  sendTicketLog,
  closeTicket,
  reopenTicket,
  isDashboardTicketChannel,
  getDashboardTicketChannels,
  getTicketOpenState,
  getTicketDashboardMeta,
  getOrderDashboardMeta,
  buildOrderTicketButtons,
  buildOrderStartRow,
  ticketUrl,
  serializeDashboardTicket,
  getDashboardTicketList,
  getTicketRecentMessages,
  getDashboardChannel,
  getDashboardTicketDetails,
  serializeDashboardOrder,
  getDashboardOrderList,
  getDashboardOrderDetails,
  updateDashboardOrderMeta,
  sendOrderReviewRequest,
  getDashboardStaffMembers,
  getDashboardTextChannels,
  resolveDashboardTextChannel,
  normalizeOrderItems,
  findStockItemByText,
  buildInvoiceFromOrderInput,
  buildInvoiceFromDashboardInput,
  invoiceItemsText,
  buildOrderInvoiceEmbed,
  sendOrderInvoice,
  extractOrderInvoiceDraft,
  ticketTypeLabelForInvoice,
} = require('./src/services/tickets');
const { recordEvent, addReview, getReviewSummary, getStats } = require('./src/services/stats');
// ── Giveaway helpers ──────────────────────────────────────────────

const {
  getUserDisplayName,
  getUserAvatar,
  tryDM,
  getCachedDashboardUser,
  getUserSummary,
} = require('./src/services/users');
const {
  normalizeStockEmoji,
  getMutableStockItems,
  getLatestShopOffer,
  buildShopPanelEmbed,
  buildSaleEmbed,
  buildShopPanelCard,
  buildSaleCard,
  buildStockEmbed,
  buildStockButtons,
  updateStockPanel,
  notifyRestock,
  sendRestockPreview,
} = require('./src/services/stock');
const {
  buildGiveawayEmbed,
  endGiveaway,
} = require('./src/services/giveaways');
// ── Welcome / Leave helpers ───────────────────────────────────────
const {
  buildWelcomeLeaveEmbed,
} = require('./src/services/welcome');
// ── Punish / Moderation helpers ──────────────────────────────────
const {
  addWarning,
  getWarnings,
  clearWarnings,
  sendPunishLog,
} = require('./src/services/moderation');
const {
  MAX_DM_MESSAGES_PER_THREAD,
  ensureDmThread,
  cleanDmContent,
  getMessageAttachments,
  makeDashboardError,
  sanitizeDashboardFileName,
  normalizeDashboardAttachments,
  isDmThreadAnswered,
  addDmThreadMessage,
  serializeDmThread,
  getDmUserInfo,
  notifyStaffAboutDm,
} = require('./src/services/dms');
// ── Invite cache ──────────────────────────────────────────────────
const {
  cachedInvites,
  cacheInvites,
  buildLeaderboardEmbed,
  importInvitesFromLeaderboardMessage,
  leaderboardMessageHasInviteCounts,
  findExistingLeaderboardMessage,
  updateLeaderboard,
} = require('./src/services/invites');
// ── Leaderboard ───────────────────────────────────────────────────

// ── Stock ─────────────────────────────────────────────────────────

// ── Commands ──────────────────────────────────────────────────────

const {
  registerCommands,
  buildCommandDefinitions,
} = require('./src/commands/definitions');
// ── Panels ────────────────────────────────────────────────────────
const {
  buildRolesPanel,
  currentMoneyRate,
  buildVerifyPanel,
  buildTicketPanel,
  buildWebsitePanel,
  buildPanel,
  PANEL_DETECTORS,
  PANEL_REFRESH_REVISION,
  isStockMessage,
  toPanelPayload,
  messageButtons,
  panelDesignSignature,
  refreshPostedPanels,
} = require('./src/services/panels');
// ── Panels automatisch erneuern ───────────────────────────────────

// ── Invite Rewards Panel ──────────────────────────────────────────

// ── Ready ─────────────────────────────────────────────────────────
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  setBrandIcon(client.user.displayAvatarURL({ size: 128 }));
  applyConfiguredPresence();

  for (const guild of client.guilds.cache.values()) {
    try {
      await registerCommands(guild.id);
      await cacheInvites(guild);
    } catch (e) {
      console.error(`Guild error (${guild.name}):`, e);
    }
  }

  await updateStockPanel();
  await updateLeaderboard();
  await refreshPostedPanels().catch(e => console.error('panel refresh error:', e.message));

  // Tempban expiry checker
  setInterval(async () => {
    const data = loadData();
    const now = Date.now();
    for (const [userId, ban] of Object.entries(data.tempbans)) {
      if (ban.expiresAt && now >= ban.expiresAt) {
        try {
          const guild = client.guilds.cache.get(ban.guildId);
          if (guild) {
            await guild.members.unban(userId, 'Tempban abgelaufen');
            await sendPunishLog(guild, {
              action: 'Tempban abgelaufen — Auto-Unban',
              color: 'success',
              target: { id: userId, tag: ban.userTag },
              moderator: client.user,
              reason: `Tempban von ${ban.duration} abgelaufen`
            });
          }
        } catch {}
        delete data.tempbans[userId];
        saveData(data);
      }
    }
  }, 30000);

  // Giveaway timer
  setInterval(async () => {
    const data = loadData();
    for (const [msgId, gw] of Object.entries(data.giveaways)) {
      if (!gw.ended && Date.now() >= gw.endTime) {
        await endGiveaway(msgId);
      }
    }
  }, 10000);
});

client.on('guildCreate', async guild => {
  try {
    await registerCommands(guild.id);
    await cacheInvites(guild);
  } catch (e) {
    console.error('guildCreate error:', e.message);
  }
});

client.on('inviteCreate', inv => {
  cachedInvites.set(inv.code, {
    inviterId: inv.inviter?.id ?? null,
    uses: inv.uses ?? 0
  });
});

client.on('inviteDelete', inv => {
  cachedInvites.delete(inv.code);
});

client.on('messageCreate', async message => {
  try {
    if (message.author?.bot) return;
    if (message.channel?.type !== ChannelType.DM) return;

    const saved = addDmThreadMessage({
      user: message.author,
      direction: 'in',
      content: message.content,
      discordMessageId: message.id,
      attachments: getMessageAttachments(message)
    });

    await notifyStaffAboutDm(saved);
  } catch (e) {
    console.error('dm messageCreate error:', e.message);
  }
});

// ── Member joins ──────────────────────────────────────────────────
client.on('guildMemberAdd', async member => {
  if (!member.user.bot) recordEvent('joins');
  await coreCommands.applyAutoRoles(member);

  try {
    const accountAge = Date.now() - member.user.createdTimestamp;

    if (accountAge < MIN_ACCOUNT_AGE_MS) {
      console.log(`🚫 Alt blocked: ${member.user.tag}`);
      return;
    }

    if (hasBeenCounted(member.id)) {
      console.log(`🔁 Already counted: ${member.user.tag}`);
      return;
    }

    const newInvites = await member.guild.invites.fetch();

    let usedInviterId = null;
    let usedCode = null;

    newInvites.forEach(inv => {
      const cached = cachedInvites.get(inv.code);

      if (cached && inv.uses > cached.uses) {
        usedInviterId = cached.inviterId;
        usedCode = inv.code;
      }
    });

    newInvites.forEach(inv => {
      cachedInvites.set(inv.code, {
        inviterId: inv.inviter?.id ?? null,
        uses: inv.uses ?? 0
      });
    });

    if (usedInviterId === member.id) {
      console.log(`🚫 Self-invite blocked: ${member.user.tag}`);
      return;
    }

    if (usedInviterId) {
      setPending(member.id, usedInviterId);
      console.log(`📥 ${member.user.tag} joined via ${usedCode} — pending verify`);
    } else {
      console.log(`⚠️ No invite found for ${member.user.tag}`);
    }
    // Welcome message
    const data = loadData();
    const wc = data.welcomeConfig;
    if (wc.enabled && wc.channelId) {
      const wChannel = member.guild.channels.cache.get(wc.channelId);
      if (wChannel) {
        const inviterText = usedInviterId
          ? `\n-# Eingeladen von <@${usedInviterId}>`
          : '';
        const embed = buildWelcomeLeaveEmbed(
          (wc.message || 'Willkommen {user} auf **{server}**.') + inviterText,
          member,
          wc.color
        );
        await wChannel.send({ embeds: [embed] }).catch(() => {});
      }
    }

  } catch (e) {
    console.error('guildMemberAdd error:', e.message);
  }
});

// ── Leave message ────────────────────────────────────────────────────
client.on('guildMemberRemove', async member => {
  if (!member.user?.bot) recordEvent('leaves');
  try {
    const data = loadData();
    const lc = data.leaveConfig;
    if (!lc.enabled || !lc.channelId) return;

    const lChannel = member.guild.channels.cache.get(lc.channelId);
    if (!lChannel) return;

    const embed = buildWelcomeLeaveEmbed(
      lc.message || '**{username}** hat den Server verlassen.',
      member,
      lc.color || 'neutral'
    );
    await lChannel.send({ embeds: [embed] }).catch(() => {});
  } catch (e) {
    console.error('guildMemberRemove error:', e.message);
  }
});

// ── Verify role gives invite count ────────────────────────────────────
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  try {
    const gotVerifyRole =
      !oldMember.roles.cache.has(VERIFY_ROLE_ID) &&
      newMember.roles.cache.has(VERIFY_ROLE_ID);

    if (!gotVerifyRole) return;

    const inviterId = getPending(newMember.id);
    if (!inviterId) return;

    markAsCounted(newMember.id);
    removePending(newMember.id);

    const total = addInvite(inviterId);

    console.log(`✅ ${newMember.user.tag} verified — invite counted for ${inviterId} (total: ${total})`);

    await updateLeaderboard();
  } catch (e) {
    console.error('guildMemberUpdate error:', e.message);
  }
});

// ── Interactions ──────────────────────────────────────────────────
const coreContext = {
  getInviteCount: userId => Number(loadData().invites?.[userId] || 0),
  getWarningCount: userId => getWarnings(userId).length,
  getWelcomeConfig: () => loadData().welcomeConfig || {},
  getLeaveConfig: () => loadData().leaveConfig || {},
  defaultModLogChannelId: PUNISH_LOG_CHANNEL_ID
};

const {
  styleNotice,
  AUTO_DEFER_MS,
  decorateInteraction,
  replyWithError,
} = require('./src/interactions');
const renameContext = {
  ticketCategoryId: TICKET_CATEGORY_ID,
  closedTicketCategoryId: CLOSED_TICKET_CATEGORY_ID,
  pingRoles: PING_ROLES
};


client.on('interactionCreate', async interaction => {
  decorateInteraction(interaction);

  try {
    if (interaction.isChatInputCommand() && await coreCommands.handleCommand(interaction, coreContext)) return;
    if (interaction.isChatInputCommand() && await updateCommands.handleCommand(interaction)) return;
    if (interaction.isChatInputCommand() && await structureCommands.handleCommand(interaction)) return;
    if (interaction.isChatInputCommand() && await renameCommands.handleCommand(interaction, renameContext)) return;
    if (interaction.isMessageComponent() && await renameCommands.handleComponent(interaction)) return;
    if (interaction.isMessageComponent() && await coreCommands.handleComponent(interaction)) return;

    await handleInteraction(interaction);
  } catch (error) {
    await replyWithError(interaction, error);
  }
});

// Gemeinsame Hilfsfunktionen und Werte für die Module in src/features und src/web
function buildCtx() {
  return {
    ActionRowBuilder,
    BOT_VERSION,
    BrandEmbed,
    ButtonBuilder,
    ButtonStyle,
    CLOSED_TICKET_CATEGORY_ID,
    ChannelType,
    DASHBOARD_PASSWORD,
    DASHBOARD_URL,
    DEFAULT_PRESENCE_CONFIG,
    GUILD_ID,
    KUNDEN_ROLE_ID,
    ModalBuilder,
    PING_ROLES,
    PermissionFlagsBits,
    REQUIRED_INVITES,
    REVIEWS_CHANNEL_ID,
    REWARD,
    REWARD_LOG_ID,
    RULES_CHANNEL_ID,
    SHOP_PANEL_CHANNEL_ID,
    STAFF_ROLE_IDS,
    STOCK_ITEMS,
    TICKET_CATEGORY_ID,
    TextInputBuilder,
    TextInputStyle,
    VERIFY_ROLE_ID,
    WEBSITE_URL,
    addDmThreadMessage,
    addWarning,
    applyConfiguredPresence,
    buildGiveawayEmbed,
    buildInvoiceFromDashboardInput,
    buildInvoiceFromOrderInput,
    buildLeaderboardEmbed,
    buildOrderStartRow,
    buildOrderTicketButtons,
    buildPanel,
    buildRolesPanel,
    buildSaleEmbed,
    buildShopPanelEmbed,
    buildSaleCard,
    buildShopPanelCard,
    buildStockButtons,
    buildStockEmbed,
    buildTicketPanel,
    buildTranscript,
    buildVerifyPanel,
    buildWebsitePanel,
    cachedInvites,
    cleanDmContent,
    cleanLongText,
    cleanShortText,
    cleanUsername,
    clearWarnings,
    client,
    closeTicket,
    cors,
    endGiveaway,
    express,
    getCachedDashboardUser,
    getDashboardChannel,
    getDashboardOrderDetails,
    getDashboardOrderList,
    getDashboardStaffMembers,
    getDashboardTextChannels,
    getDashboardTicketDetails,
    getDashboardTicketList,
    getDmUserInfo,
    getInvites,
    getLatestShopOffer,
    getMessageAttachments,
    getMutableStockItems,
    getNextOrderId,
    getNextTicketOrderId,
    getOrderDashboardMeta,
    getTicketDashboardMeta,
    getTicketOrderId,
    getTicketOwnerId,
    getTicketType,
    getUserAvatar,
    getUserDisplayName,
    getWarnings,
    hasOrderFormSubmitted,
    hasReviewDecision,
    hasReviewedOrder,
    addReview,
    getReviewSummary,
    getStats,
    isStaff,
    loadData,
    loadPresenceConfig,
    makeDashboardError,
    markOrderFormSubmitted,
    markReviewDecision,
    markReviewedOrder,
    normalizeDashboardAttachments,
    normalizePresenceStatus,
    normalizeStockEmoji,
    normalizeStockItemId,
    notice,
    notifyRestock,
    parseDuration,
    path,
    reopenTicket,
    resolveDashboardTextChannel,
    saveData,
    sendOrderInvoice,
    sendOrderReviewRequest,
    sendPunishLog,
    sendRestockPreview,
    serializeDashboardTicket,
    serializeDmThread,
    setInvites,
    tryDM,
    updateDashboardOrderMeta,
    updateLeaderboard,
    updateStockPanel,
  };
}

let features = null;
function getFeatures() {
  if (!features) {
    const ctx = buildCtx();
    features = ['giveaways', 'admin', 'roles', 'tickets', 'shop', 'invites', 'moderation', 'welcome']
      .map((name) => require(`./src/features/${name}`)(ctx));
  }
  return features;
}

async function handleInteraction(interaction) {
  // Jede Funktion des Bots liegt in src/features/<name>.js
  const feature = getFeatures().find((f) => {
    if (interaction.isChatInputCommand()) return f.commands?.includes(interaction.commandName);
    if (interaction.isButton()) return f.buttons?.some((r) => r.test(interaction.customId));
    if (interaction.isModalSubmit()) return f.modals?.some((r) => r.test(interaction.customId));
    return false;
  });
  if (!feature) return;
  if (interaction.isChatInputCommand()) return feature.command(interaction);
  if (interaction.isButton()) return feature.button(interaction);
  if (interaction.isModalSubmit()) return feature.modal(interaction);
}



// ── Website API ── (src/web/api.js)
const app = require('./src/web/api')(buildCtx());

// Selbsttest (npm test): Jeder eigene Befehl muss bei einem Modul ankommen.
if (process.env.HSB_SELFTEST) {
  const external = new Set([coreCommands, updateCommands, structureCommands, renameCommands].flatMap(m => m.definitions().map(d => d.name)));
  const handled = new Set(getFeatures().flatMap(f => f.commands || []));
  const missing = buildCommandDefinitions().map(d => d.name).filter(n => !external.has(n) && !handled.has(n));
  console.log(`SELFTEST features=${getFeatures().length} missing=${missing.join(',') || '-'}`);
}

// HOST=127.0.0.1 → nur noch über Caddy (HTTPS) erreichbar, nicht direkt über die IP
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`🌐 Website API läuft auf ${HOST}:${PORT} – Version ${BOT_VERSION}`);
  if (!DASHBOARD_URL) {
    console.warn('⚠️ DASHBOARD_URL ist nicht gesetzt – Dashboard-Links in Discord sind deaktiviert.');
  }
});

// Ein Fehler beim Discord-Login darf die Website nicht mitreißen.
process.on('unhandledRejection', err => {
  console.error('unhandled rejection:', err?.message || err);
});

client.on('error', err => {
  console.error('discord client error:', err?.message || err);
});

async function loginDiscord() {
  try {
    await client.login(TOKEN);
  } catch (e) {
    console.error(`discord login error: ${e.message} – neuer Versuch in 60s`);
    setTimeout(loginDiscord, 60 * 1000);
  }
}

loginDiscord();
