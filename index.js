const {
  Client, GatewayIntentBits, EmbedBuilder,
  ButtonBuilder, ButtonStyle, ActionRowBuilder,
  REST, Routes, SlashCommandBuilder, PermissionFlagsBits, ChannelType
} = require('discord.js');
const fs = require('fs');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildMembers,
  ]
});

// ── Config ────────────────────────────────────────────────────────
const TOKEN = process.env.DISCORD_TOKEN;
const REQUIRED_INVITES = 8;
const REWARD = '$1m on HugoSMP';
const DATA_FILE = '/app/data/data.json';
const VERIFY_ROLE_ID = '1499149656951885956';
const REWARD_LOG_ID = '1500479671031169144';
const MIN_ACCOUNT_AGE_MS = 1 * 24 * 60 * 60 * 1000;
const RULES_CHANNEL_ID = '1499135456133255239';
const TICKET_CATEGORY_ID = '1499147835528974356';
const ADMIN_ROLE_1 = '1499146219946250241';
const ADMIN_ROLE_2 = '1499159379902074880';
const EMBED_COLOR_VIOLET = '#b10de7';

// Data Functions (unverändert)
function loadData() { /* ... dein alter Code ... */ }
function saveData(data) { /* ... dein alter Code ... */ }
function getInvites(userId) { return loadData().invites[userId] ?? 0; }
function setInvites(userId, amount) { /* ... */ }
function removeInvites(userId, amount) { /* ... */ }
function addInvite(userId) { /* ... */ }
function markAsCounted(memberId) { /* ... */ }
function hasBeenCounted(memberId) { return loadData().counted?.includes(memberId) ?? false; }
function setPending(memberId, inviterId) { /* ... */ }

// Invite Cache
const cachedInvites = new Map();

async function cacheInvites(guild) {
  try {
    const invites = await guild.invites.fetch();
    invites.forEach(inv => {
      cachedInvites.set(inv.code, { inviterId: inv.inviter?.id ?? null, uses: inv.uses ?? 0 });
    });
    console.log(`[CACHE] ${invites.size} Invites geladen für ${guild.name}`);
  } catch (e) { console.error('[CACHE ERROR]', e); }
}

// Panel & Commands & Interactions (unverändert - ich lass sie weg für die Übersicht)
// Kopiere einfach deinen alten `buildPanel()`, `registerCommands()` und `interactionCreate` hier rein.

client.once('ready', async () => {
  console.log(`✅ ${client.user.tag} ist bereit.`);
  for (const guild of client.guilds.cache.values()) {
    await registerCommands(guild.id);
    await cacheInvites(guild);
  }
});

// ── WICHTIG: Verbessertes + stark geloggtes Tracking ─────────────
client.on('guildMemberAdd', async m => {
  console.log(`[JOIN] ${m.user.tag} (${m.id}) ist beigetreten`);

  const age = Date.now() - m.user.createdTimestamp;
  if (age < MIN_ACCOUNT_AGE_MS) {
    console.log(`[JOIN] Account zu jung → ignoriert`);
    return;
  }
  if (hasBeenCounted(m.id)) {
    console.log(`[JOIN] Bereits gezählt → ignoriert`);
    return;
  }

  try {
    const invs = await m.guild.invites.fetch({ cache: false });
    console.log(`[INVITES] ${invs.size} aktuelle Invites geladen`);

    let usedInvite = null;

    for (const inv of invs.values()) {
      const cached = cachedInvites.get(inv.code);
      const oldUses = cached ? cached.uses : 0;

      console.log(`[CHECK] Code: ${inv.code} | Uses: ${oldUses} → ${inv.uses} | Inviter: ${inv.inviter?.tag || 'Unbekannt'}`);

      if (inv.uses > oldUses) {
        if (inv.inviter?.id === m.id) {
          console.log(`[SKIP] Selbst-Einladung`);
          continue;
        }
        usedInvite = inv;
        console.log(`[FOUND] MÖGLICHER INVITER: ${inv.inviter?.tag} (${inv.inviter?.id})`);
        break;
      }
    }

    if (usedInvite && usedInvite.inviter) {
      setPending(m.id, usedInvite.inviter.id);
      console.log(`[SUCCESS] Pending gesetzt → ${m.user.tag} von ${usedInvite.inviter.tag}`);
    } else {
      console.log(`[FAIL] Kein passender Invite gefunden für ${m.user.tag}`);
    }

    // Cache aktualisieren
    invs.forEach(inv => {
      cachedInvites.set(inv.code, { inviterId: inv.inviter?.id, uses: inv.uses });
    });

  } catch (e) {
    console.error('[ERROR] Invite Tracking:', e);
  }
});

client.on('guildMemberUpdate', async (o, n) => {
  if (!o.roles.cache.has(VERIFY_ROLE_ID) && n.roles.cache.has(VERIFY_ROLE_ID)) {
    console.log(`[VERIFY] ${n.user.tag} hat jetzt die Verify-Rolle`);

    const data = loadData();
    const inviterId = data.pending[n.id];

    if (inviterId) {
      const newCount = addInvite(inviterId);
      markAsCounted(n.id);
      delete data.pending[n.id];
      saveData(data);
      console.log(`[SUCCESS] Invite gezählt! ${n.user.tag} → ${inviterId} (${newCount} Invites)`);
    } else {
      console.log(`[FAIL] Kein Pending-Eintrag für ${n.user.tag}`);
    }
  }
});

client.login(TOKEN);
