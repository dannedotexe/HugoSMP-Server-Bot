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

const VERIFY_ROLE_ID = '1499149656951885956';
const REWARD_LOG_CHANNEL_ID = '1500479671031169144';
const RULES_CHANNEL_ID = '1499135456133255239';

const MIN_ACCOUNT_AGE = 1 * 24 * 60 * 60 * 1000; 
const DATA_FILE = './data.json';

// ───────────────── DATA MANAGEMENT ─────────────────

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(content);
    }
  } catch (err) {}
  // Struktur erweitert um 'usedByInviter'
  return { 
    invites: {}, 
    pending: {}, 
    countedUsers: {},
    usedByInviter: {} // Speichert: { inviterId: [userId1, userId2] }
  };
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ───────────────── INVITE LOGIC ─────────────────

function getInvites(userId) {
  const data = loadData();
  return data.invites[userId] || 0;
}

function addInvite(inviterId, joinedUserId) {
  const data = loadData();
  
  // Initialisiere Tracker für diesen Inviter, falls nicht vorhanden
  if (!data.usedByInviter[inviterId]) {
    data.usedByInviter[inviterId] = [];
  }

  // PRÜFUNG: Wurde dieser User schon mal von diesem Inviter benutzt?
  if (data.usedByInviter[inviterId].includes(joinedUserId)) {
    console.log(`Invite von ${joinedUserId} für ${inviterId} ignoriert (bereits früher genutzt).`);
    return false; 
  }

  // Erhöhe Counter und füge User zur "Benutzt"-Liste hinzu
  data.invites[inviterId] = (data.invites[inviterId] || 0) + 1;
  data.usedByInviter[inviterId].push(joinedUserId);
  
  saveData(data);
  return true;
}

function resetInvites(userId) {
  const data = loadData();
  data.invites[userId] = 0;
  // Hinweis: data.usedByInviter[userId] wird NICHT gelöscht, 
  // damit die Personen für immer "verbraucht" bleiben.
  saveData(data);
}

// ───────────────── PENDING & COUNTED ─────────────────

function setPending(memberId, inviterId) {
  const data = loadData();
  data.pending[memberId] = inviterId;
  saveData(data);
}

function getPending(memberId) {
  const data = loadData();
  return data.pending[memberId];
}

function removePending(memberId) {
  const data = loadData();
  delete data.pending[memberId];
  saveData(data);
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
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, guild.id),
      { body: commands.map(c => c.toJSON()) }
    );
  } catch (error) {}
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
    new ButtonBuilder()
      .setCustomId('gen_invite')
      .setLabel('Generate Invite')
      .setEmoji('🔗')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('check_inv')
      .setLabel('Check Invites')
      .setEmoji('📊')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('claim')
      .setLabel('Claim 1M')
      .setEmoji('💰')
      .setStyle(ButtonStyle.Success)
  );

  return { embeds: [embed], components: [row] };
}

// ───────────────── INVITE CACHE ─────────────────

const cachedInvites = new Map();

async function cacheInvites(guild) {
  try {
    const invites = await guild.invites.fetch();
    invites.forEach(invite => {
      cachedInvites.set(invite.code, {
        inviterId: invite.inviter?.id || null,
        uses: invite.uses || 0
      });
    });
  } catch {}
}

// ───────────────── EVENTS ─────────────────

client.once('ready', async () => {
  console.log(`Bot ist online: ${client.user.tag}`);
  for (const guild of client.guilds.cache.values()) {
    await registerCommands(guild);
    await cacheInvites(guild);
  }
});

client.on('guildMemberAdd', async member => {
  try {
    const invites = await member.guild.invites.fetch();
    let inviterId = null;

    invites.forEach(invite => {
      const cached = cachedInvites.get(invite.code);
      if (cached && invite.uses > cached.uses) {
        inviterId = cached.inviterId;
      }
    });

    invites.forEach(invite => {
      cachedInvites.set(invite.code, {
        inviterId: invite.inviter?.id,
        uses: invite.uses || 0
      });
    });

    if (!inviterId || inviterId === member.id) return;
    if ((Date.now() - member.user.createdTimestamp) < MIN_ACCOUNT_AGE) return;

    setPending(member.id, inviterId);
  } catch (err) {
    console.error(err);
  }
});

client.on('guildMemberUpdate', (oldMember, newMember) => {
  const inviterId = getPending(newMember.id);
  if (!inviterId) return;

  const verifiedNow = !oldMember.roles.cache.has(VERIFY_ROLE_ID) && newMember.roles.cache.has(VERIFY_ROLE_ID);
  if (!verifiedNow) return;

  // Versuche Invite hinzuzufügen (prüft auf Duplikate)
  const success = addInvite(inviterId, newMember.id);
  
  if (success) {
    console.log(`Invite von ${newMember.user.tag} für ${inviterId} gezählt.`);
  }
  
  removePending(newMember.id);
});

// ───────────────── INTERACTIONS ─────────────────

client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'setupinviterewards') {
      await interaction.deferReply({ ephemeral: true });
      try {
        await interaction.channel.send(buildPanel());
        return interaction.editReply('✅ Panel erfolgreich gesendet.');
      } catch (e) {
        return interaction.editReply('❌ Fehler beim Senden.');
      }
    }

    if (interaction.commandName === 'inviterewards') {
      const count = getInvites(interaction.user.id);
      return interaction.reply({ 
        content: `📊 Du hast aktuell **${count}/${REQUIRED_INVITES}** neue verifizierte Invites.`, 
        ephemeral: true 
      });
    }
  }

  if (!interaction.isButton()) return;

  if (interaction.customId === 'gen_invite') {
    await interaction.deferReply({ ephemeral: true });
    const channel = interaction.guild.channels.cache.get(RULES_CHANNEL_ID);
    if (!channel) return interaction.editReply('❌ Rules Channel nicht gefunden.');

    try {
      const invite = await channel.createInvite({ maxAge: 0, maxUses: 0, unique: true });
      cachedInvites.set(invite.code, { inviterId: interaction.user.id, uses: 0 });
      return interaction.editReply(`✅ Dein Link: https://discord.gg/${invite.code}`);
    } catch (e) {
      return interaction.editReply('❌ Fehler beim Erstellen des Invites.');
    }
  }

  if (interaction.customId === 'check_inv') {
    const count = getInvites(interaction.user.id);
    return interaction.reply({ 
      content: `📊 Du hast **${count}/${REQUIRED_INVITES}** verifizierte Invites für die nächste Belohnung.`, 
      ephemeral: true 
    });
  }

  if (interaction.customId === 'claim') {
    const count = getInvites(interaction.user.id);
    if (count < REQUIRED_INVITES) {
      return interaction.reply({ 
        content: `❌ Dir fehlen noch ${REQUIRED_INVITES - count} neue verifizierte Invites.`, 
        ephemeral: true 
      });
    }

    resetInvites(interaction.user.id);
    const log = interaction.guild.channels.cache.get(REWARD_LOG_CHANNEL_ID);
    if (log) {
      await log.send(`💰 **${interaction.user.tag}** hat **${REWARD}** geclaimt! Sein Counter wurde auf 0 zurückgesetzt.`);
    }
    return interaction.reply({ content: `✅ Belohnung geclaimt! Dein Zähler steht wieder bei 0/8. Beachte: Du kannst dieselben Freunde nicht zweimal einladen!`, ephemeral: true });
  }
});

client.login(TOKEN);
