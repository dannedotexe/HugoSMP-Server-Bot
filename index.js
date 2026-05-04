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

// ── Data helpers ──────────────────────────────────────────────────
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const initial = { invites: {}, counted: [], pending: {} };
    fs.mkdirSync('/app/data', { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
    return initial;
  } catch (e) { 
    console.error('LoadData Error:', e.message);
    return { invites: {}, counted: [], pending: {} }; 
  }
}

function saveData(data) {
  try {
    fs.mkdirSync('/app/data', { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (e) { console.error('saveData error:', e.message); }
}

function getInvites(userId) { return loadData().invites[userId] ?? 0; }

function setInvites(userId, amount) {
  const data = loadData();
  data.invites[userId] = Math.max(0, amount);
  saveData(data);
}

function removeInvites(userId, amount) {
  const data = loadData();
  const current = data.invites[userId] ?? 0;
  data.invites[userId] = Math.max(0, current - amount);
  saveData(data);
  return data.invites[userId];
}

function addInvite(userId) {
  const data = loadData();
  data.invites[userId] = (data.invites[userId] ?? 0) + 1;
  saveData(data);
  return data.invites[userId];
}

function markAsCounted(memberId) {
  const data = loadData();
  if (!data.counted) data.counted = [];
  if (!data.counted.includes(memberId)) data.counted.push(memberId);
  saveData(data);
}

function hasBeenCounted(memberId) {
  return loadData().counted?.includes(memberId) ?? false;
}

function setPending(memberId, inviterId) {
  const data = loadData();
  if (!data.pending) data.pending = {};
  data.pending[memberId] = inviterId;
  saveData(data);
}

// ── Invite cache ──────────────────────────────────────────────────
const cachedInvites = new Map();

async function cacheInvites(guild) {
  try {
    const invites = await guild.invites.fetch();
    invites.forEach(inv => cachedInvites.set(inv.code, { inviterId: inv.inviter?.id ?? null, uses: inv.uses ?? 0 }));
    console.log(`[CACHE] ${invites.size} Invites geladen`);
  } catch (e) {}
}

// ── Register commands ─────────────────────────────────────────────
async function registerCommands(guildId) {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  const commands = [
    new SlashCommandBuilder().setName('setupinviterewards').setDescription('Panel senden').setDefaultMemberPermissions(PermissionFlagsBits.Administrator).toJSON(),
    new SlashCommandBuilder().setName('leaderboard').setDescription('Top Einlader').toJSON(),
    new SlashCommandBuilder().setName('setinvites').setDescription('Invites setzen').setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Anzahl').setRequired(true)).toJSON()
  ];
  try {
    await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: commands });
    console.log(`✅ Befehle für ${guildId} registriert.`);
  } catch (e) { console.error("Registrierungsfehler:", e); }
}

// ── Panel builder ─────────────────────────────────────────────────
function buildPanel() {
  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR_VIOLET)
    .setTitle('🎁 Invite Rewards')
    .setDescription(
      `Invite your friends to the server to earn rewards!\n\n` +
      `**Goal:** ${REQUIRED_INVITES} Verified Invites\n` +
      `**Reward:** ${REWARD}\n\n` +
      `⚠️ **WICHTIG:** Damit deine Invites gezählt werden, **MUSST** du den Link verwenden, der über den Button unten generiert wird!`
    );
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('gen_invite').setLabel('Generate Invite Link').setEmoji('🔗').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('check_inv').setLabel('Check Invites').setEmoji('📊').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('claim').setLabel(`Claim ${REWARD}`).setEmoji('💰').setStyle(ButtonStyle.Success)
  );
  return { embeds: [embed], components: [row] };
}

// ── Interaction Handler ───────────────────────────────────────────
client.on('interactionCreate', async interaction => {
  // ... dein kompletter alter Interaction-Code (unverändert) ...
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'setupinviterewards') {
      await interaction.reply({ content: 'Panel gesendet!', ephemeral: true });
      await interaction.channel.send(buildPanel());
    }
    if (interaction.commandName === 'setinvites') {
      const target = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      setInvites(target.id, amount);
      await interaction.reply({ content: `✅ Die Invites von **${target.username}** wurden auf **${amount}** gesetzt.`, ephemeral: true });
    }
    if (interaction.commandName === 'leaderboard') {
      const data = loadData();
      const sorted = Object.entries(data.invites).sort(([,a],[,b]) => b-a).slice(0,10);
      const text = sorted.map(([id, c], i) => `${i+1}. <@${id}>: ${c}`).join('\n') || 'Keine Daten';
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🏆 Leaderboard').setDescription(text).setColor(EMBED_COLOR_VIOLET)] });
    }
  }

  if (interaction.isButton()) {
    // Dein kompletter Button-Code hier (genau wie vorher)
    if (interaction.customId === 'gen_invite') { /* ... */ }
    if (interaction.customId === 'check_inv') { /* ... */ }
    if (interaction.customId === 'claim') { /* ... dein ganzer Claim-Code ... */ }
    if (interaction.customId === 'close_ticket') { /* ... */ }
  }
});

// ── Events ────────────────────────────────────────────────────────
client.once('ready', async () => {
  console.log(`✅ ${client.user.tag} ist bereit.`);
  for (const guild of client.guilds.cache.values()) {
    await registerCommands(guild.id);
    await cacheInvites(guild);
  }
});

client.on('guildCreate', async guild => {
  await registerCommands(guild.id);
  await cacheInvites(guild);
});

// Verbessertes + geloggtes Tracking
client.on('guildMemberAdd', async m => {
  console.log(`[JOIN] ${m.user.tag} ist beigetreten`);

  const age = Date.now() - m.user.createdTimestamp;
  if (age < MIN_ACCOUNT_AGE_MS) return console.log(`[JOIN] Zu jung`);
  if (hasBeenCounted(m.id)) return console.log(`[JOIN] Bereits gezählt`);

  try {
    const invs = await m.guild.invites.fetch({ cache: false });
    let usedInvite = null;

    for (const inv of invs.values()) {
      const cached = cachedInvites.get(inv.code);
      if (cached && inv.uses > cached.uses) {
        if (inv.inviter?.id !== m.id) {
          usedInvite = inv;
          console.log(`[FOUND] Invite von ${inv.inviter?.tag}`);
          break;
        }
      }
    }

    if (usedInvite?.inviter) {
      setPending(m.id, usedInvite.inviter.id);
      console.log(`[PENDING] Gesetzt für ${m.user.tag}`);
    }

    invs.forEach(inv => cachedInvites.set(inv.code, { inviterId: inv.inviter?.id, uses: inv.uses }));
  } catch (e) {
    console.error('[INVITE ERROR]', e);
  }
});

client.on('guildMemberUpdate', async (o, n) => {
  if (!o.roles.cache.has(VERIFY_ROLE_ID) && n.roles.cache.has(VERIFY_ROLE_ID)) {
    const data = loadData();
    const inviterId = data.pending[n.id];
    if (inviterId) {
      addInvite(inviterId);
      markAsCounted(n.id);
      delete data.pending[n.id];
      saveData(data);
      console.log(`[SUCCESS] Invite gezählt! ${n.user.tag} → ${inviterId}`);
    }
  }
});

client.login(TOKEN);
