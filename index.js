const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits
} = require('discord.js');

const fs = require('fs');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildMembers
  ]
});

const TOKEN = process.env.DISCORD_TOKEN;

const REQUIRED_INVITES = 8;
const REWARD = '$1m on HugoSMP';

// PRÜFE DIESE IDs NOCHMAL!
const VERIFY_ROLE_ID = '1499149656951885956';
const REWARD_LOG_CHANNEL_ID = '1500479671031169144';
const RULES_CHANNEL_ID = '1499135456133255239';

const DATA_FILE = './data.json';

// ───────────────── DATA MANAGEMENT ─────────────────

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (err) {
    console.log("Fehler beim Laden der data.json - erstelle neue Struktur.");
  }
  return { invites: {}, pending: {}, countedUsers: {}, usedByInviter: {} };
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ───────────────── INVITE LOGIC ─────────────────

function addInvite(inviterId, joinedUserId) {
  const data = loadData();
  
  if (!data.usedByInviter[inviterId]) {
    data.usedByInviter[inviterId] = [];
  }

  // TEST-MODUS: Die Sperre für doppelte Personen ist hier DEAKTIVIERT, damit du testen kannst!
  data.invites[inviterId] = (data.invites[inviterId] || 0) + 1;
  data.usedByInviter[inviterId].push(joinedUserId);
  
  saveData(data);
  return true;
}

// ───────────────── SLASH COMMANDS ─────────────────

const commands = [
  new SlashCommandBuilder()
    .setName('setupinviterewards')
    .setDescription('Sendet das Invite-Rewards Panel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('inviterewards')
    .setDescription('Zeigt deine Statistiken.')
];

async function registerCommands(guild) {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), { body: commands.map(c => c.toJSON()) });
  } catch (e) { console.log("Command Register Error"); }
}

// ───────────────── PANEL BUILDER ─────────────────

function buildPanel() {
  const embed = new EmbedBuilder()
    .setTitle('🎁 Invite Rewards')
    .setColor(0x1e1f22)
    .setDescription(
      `Invite your friends to the server to earn rewards!\n\n` +
      `**Goal:** 8 Verified Invites\n` +
      `**Reward:** $1m on HugoSMP\n\n` +
      `Click the buttons below to generate your personal link or check your progress.`
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('gen_invite').setLabel('Generate Invite').setEmoji('🔗').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('check_inv').setLabel('Check Invites').setEmoji('📊').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('claim').setLabel('Claim 1M').setEmoji('💰').setStyle(ButtonStyle.Success)
  );

  return { embeds: [embed], components: [row] };
}

// ───────────────── INVITE CACHE ─────────────────

const cachedInvites = new Map();

async function cacheInvites(guild) {
  try {
    const invites = await guild.invites.fetch();
    invites.forEach(i => cachedInvites.set(i.code, { inviterId: i.inviter?.id || null, uses: i.uses || 0 }));
    console.log(`Cache für ${guild.name} geladen.`);
  } catch (e) { console.log("Invite Fetch Error"); }
}

// ───────────────── EVENTS ─────────────────

client.once('ready', async () => {
  console.log(`✅ Bot online: ${client.user.tag}`);
  for (const guild of client.guilds.cache.values()) {
    await registerCommands(guild);
    await cacheInvites(guild);
  }
});

client.on('guildMemberAdd', async member => {
  console.log(`➡️ User beigetreten: ${member.user.tag}`);
  try {
    const invites = await member.guild.invites.fetch();
    let inviterId = null;

    invites.forEach(invite => {
      const cached = cachedInvites.get(invite.code);
      if (cached && invite.uses > cached.uses) {
        inviterId = cached.inviterId;
      }
    });

    // Cache erneuern
    invites.forEach(i => cachedInvites.set(i.code, { inviterId: i.inviter?.id, uses: i.uses || 0 }));

    if (inviterId) {
      const data = loadData();
      data.pending[member.id] = inviterId;
      saveData(data);
      console.log(`📍 Inviter gefunden: <@${inviterId}> hat ${member.user.tag} eingeladen.`);
    } else {
      console.log(`❓ Konnte Inviter für ${member.user.tag} nicht bestimmen.`);
    }
  } catch (err) { console.error(err); }
});

client.on('guildMemberUpdate', (oldMember, newMember) => {
  const data = loadData();
  const inviterId = data.pending[newMember.id];
  
  if (!inviterId) return;

  const verifiedNow = !oldMember.roles.cache.has(VERIFY_ROLE_ID) && newMember.roles.cache.has(VERIFY_ROLE_ID);
  
  if (verifiedNow) {
    console.log(`⭐ Rolle erkannt für ${newMember.user.tag}. Zähle Invite für ${inviterId}...`);
    addInvite(inviterId, newMember.id);
    
    delete data.pending[newMember.id];
    saveData(data);
    console.log(`✅ Invite erfolgreich gespeichert.`);
  }
});

// ───────────────── INTERACTIONS ─────────────────

client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'setupinviterewards') {
      await interaction.deferReply({ ephemeral: true });
      await interaction.channel.send(buildPanel());
      return interaction.editReply('✅ Panel gesendet.');
    }
    if (interaction.commandName === 'inviterewards') {
      const data = loadData();
      const count = data.invites[interaction.user.id] || 0;
      return interaction.reply({ content: `📊 Aktueller Stand: **${count}/${REQUIRED_INVITES}** Invites.`, ephemeral: true });
    }
  }

  if (!interaction.isButton()) return;

  if (interaction.customId === 'gen_invite') {
    await interaction.deferReply({ ephemeral: true });
    const channel = interaction.guild.channels.cache.get(RULES_CHANNEL_ID);
    const invite = await channel.createInvite({ maxAge: 0, maxUses: 0, unique: true });
    cachedInvites.set(invite.code, { inviterId: interaction.user.id, uses: 0 });
    return interaction.editReply(`✅ Link: https://discord.gg/${invite.code}`);
  }

  if (interaction.customId === 'check_inv') {
    const data = loadData();
    const count = data.invites[interaction.user.id] || 0;
    return interaction.reply({ content: `📊 Du hast **${count}/${REQUIRED_INVITES}** Invites gesammelt.`, ephemeral: true });
  }

  if (interaction.customId === 'claim') {
    const data = loadData();
    const count = data.invites[interaction.user.id] || 0;
    
    if (count < REQUIRED_INVITES) {
      return interaction.reply({ content: `❌ Du brauchst 8 Invites (du hast ${count}).`, ephemeral: true });
    }

    data.invites[interaction.user.id] = 0;
    saveData(data);

    const log = interaction.guild.channels.cache.get(REWARD_LOG_CHANNEL_ID);
    if (log) log.send(`💰 **${interaction.user.tag}** hat die Belohnung geclaimt!`);
    
    return interaction.reply({ content: `✅ Erfolg! Dein Counter wurde auf 0 gesetzt.`, ephemeral: true });
  }
});

client.login(TOKEN);
