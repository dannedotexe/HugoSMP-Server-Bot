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

// --- EINSTELLUNGEN ---
const REQUIRED_INVITES = 8;
const REWARD = '$1m on HugoSMP';
const VERIFY_ROLE_ID = '1499149656951885956'; // Deine ID aus dem Log
const REWARD_LOG_CHANNEL_ID = '1500479671031169144';
const RULES_CHANNEL_ID = '1499135456133255239';

// SICHERHEIT: Account-Alter (1 Tag)
const MIN_ACCOUNT_AGE = 1 * 24 * 60 * 60 * 1000; 
const DATA_FILE = './data.json';

// ───────────────── DATA MANAGEMENT ─────────────────

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (err) {}
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

  // SICHERUNG: Dieselbe Person zählt pro Inviter nur einmal
  if (data.usedByInviter[inviterId].includes(joinedUserId)) {
    console.log(`❌ Duplikat: ${joinedUserId} wurde für ${inviterId} bereits gezählt.`);
    return false;
  }

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
  } catch (e) {}
}

// ───────────────── PANEL BUILDER (NEUER TEXT) ─────────────────

function buildPanel() {
  const embed = new EmbedBuilder()
    .setTitle('🎁 Invite Rewards')
    .setColor(0x1e1f22)
    .setDescription(
      `Invite your friends to the server to earn rewards!\n\n` +
      `**Goal:** 8 Verified Invites\n` +
      `**Reward:** $1m on HugoSMP\n\n` +
      `Click the buttons below to generate your personal link or check your progress.`
    ); // Text angepasst an dein Bild

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('gen_invite').setLabel('Generate Invite').setEmoji('🔗').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('check_inv').setLabel('Check Invites').setEmoji('📊').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('claim').setLabel('Claim 1M').setEmoji('💰').setStyle(ButtonStyle.Success) // Claim 1M Label
  );

  return { embeds: [embed], components: [row] };
}

// ───────────────── INVITE CACHE ─────────────────

const cachedInvites = new Map();

async function cacheInvites(guild) {
  try {
    const invites = await guild.invites.fetch();
    invites.forEach(i => cachedInvites.set(i.code, { inviterId: i.inviter?.id || null, uses: i.uses || 0 }));
  } catch (e) {}
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
  try {
    // SICHERUNG: Account-Alter Prüfung (1 Tag)
    if ((Date.now() - member.user.createdTimestamp) < MIN_ACCOUNT_AGE) {
      console.log(`⚠️ User ${member.user.tag} zu jung.`);
      return;
    }

    const invites = await member.guild.invites.fetch();
    let inviterId = null;

    invites.forEach(invite => {
      const cached = cachedInvites.get(invite.code);
      if (cached && invite.uses > cached.uses) {
        inviterId = cached.inviterId;
      }
    });

    invites.forEach(i => cachedInvites.set(i.code, { inviterId: i.inviter?.id, uses: i.uses || 0 }));

    if (inviterId && inviterId !== member.id) {
      const data = loadData();
      data.pending[member.id] = inviterId;
      saveData(data);
      console.log(`📍 Beitritt erkannt: ${member.user.tag} eingeladen von ${inviterId}`);
    }
  } catch (err) { console.error(err); }
});

client.on('guildMemberUpdate', (oldMember, newMember) => {
  const data = loadData();
  const inviterId = data.pending[newMember.id];
  
  if (!inviterId) return;

  const verifiedNow = !oldMember.roles.cache.has(VERIFY_ROLE_ID) && newMember.roles.cache.has(VERIFY_ROLE_ID);
  
  if (verifiedNow) {
    const success = addInvite(inviterId, newMember.id);
    if (success) {
        console.log(`✅ Invite gezählt für ${inviterId}`);
    }
    delete data.pending[newMember.id];
    saveData(data);
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
      return interaction.reply({ content: `📊 Dein aktueller Stand: **${count}/${REQUIRED_INVITES}**`, ephemeral: true });
    }
  }

  if (!interaction.isButton()) return;

  if (interaction.customId === 'gen_invite') {
    await interaction.deferReply({ ephemeral: true });
    try {
      const channel = interaction.guild.channels.cache.get(RULES_CHANNEL_ID);
      const invite = await channel.createInvite({ maxAge: 0, maxUses: 0, unique: true });
      cachedInvites.set(invite.code, { inviterId: interaction.user.id, uses: 0 });
      return interaction.editReply(`✅ Dein Invite-Link: https://discord.gg/${invite.code}`);
    } catch (e) { return interaction.editReply('❌ Fehler beim Erstellen.'); }
  }

  if (interaction.customId === 'check_inv') {
    const data = loadData();
    const count = data.invites[interaction.user.id] || 0;
    return interaction.reply({ content: `📊 Du hast **${count}/${REQUIRED_INVITES}** verifizierte Invites gesammelt.`, ephemeral: true });
  }

  if (interaction.customId === 'claim') {
    const data = loadData();
    const count = data.invites[interaction.user.id] || 0;
    
    // Zähler wird NUR auf 0 gesetzt, wenn man wirklich 8 hat!
    if (count < REQUIRED_INVITES) {
      return interaction.reply({ 
        content: `❌ Du brauchst 8 Invites zum Einlösen. Dein aktueller Stand von **${count}/8** bleibt erhalten!`, 
        ephemeral: true 
      });
    }

    // Reset auf 0 nach erfolgreichem Claim
    data.invites[interaction.user.id] = 0;
    saveData(data);

    const log = interaction.guild.channels.cache.get(REWARD_LOG_CHANNEL_ID);
    if (log) log.send(`💰 **${interaction.user.tag}** hat die Belohnung geclaimt!`);
    
    return interaction.reply({ content: `✅ Erfolg! Deine Belohnung wurde registriert und dein Zähler auf 0/8 zurückgesetzt.`, ephemeral: true });
  }
});

client.login(TOKEN);
