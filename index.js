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
const TOKEN              = process.env.DISCORD_TOKEN;
const REQUIRED_INVITES   = 8;
const REWARD             = '$1m on HugoSMP';
const DATA_FILE          = './data.json';
const VERIFY_ROLE_ID     = '1499149656951885956';
const REWARD_LOG_ID      = '1500479671031169144';
const MIN_ACCOUNT_AGE_MS = 1 * 24 * 60 * 60 * 1000;

const TICKET_CATEGORY_ID = '1499147835528974356';
const ADMIN_ROLE_1       = '1499146219946250241';
const ADMIN_ROLE_2       = '1499159379902074880';

// ── Data helpers ──────────────────────────────────────────────────
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) { console.error('loadData error:', e.message); }
  return { invites: {}, counted: [], pending: {} };
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (e) { console.error('saveData error:', e.message); }
}

function getInvites(userId) {
  return loadData().invites[userId] ?? 0;
}

function setInvites(userId, amount) {
  const data = loadData();
  data.invites[userId] = Math.max(0, amount);
  saveData(data);
}

function addInvite(userId) {
  const data = loadData();
  data.invites[userId] = (data.invites[userId] ?? 0) + 1;
  saveData(data);
  return data.invites[userId];
}

function resetInvites(userId) {
  setInvites(userId, 0);
}

function hasBeenCounted(memberId) {
  return loadData().counted?.includes(memberId) ?? false;
}

function markAsCounted(memberId) {
  const data = loadData();
  if (!data.counted) data.counted = [];
  if (!data.counted.includes(memberId)) data.counted.push(memberId);
  saveData(data);
}

function setPending(memberId, inviterId) {
  const data = loadData();
  if (!data.pending) data.pending = {};
  data.pending[memberId] = inviterId;
  saveData(data);
}

function getPending(memberId) {
  return loadData().pending?.[memberId] ?? null;
}

function removePending(memberId) {
  const data = loadData();
  if (data.pending) delete data.pending[memberId];
  saveData(data);
}

// ── Invite cache ──────────────────────────────────────────────────
const cachedInvites = new Map();

async function cacheInvites(guild) {
  try {
    const invites = await guild.invites.fetch();
    invites.forEach(inv => {
      cachedInvites.set(inv.code, { inviterId: inv.inviter?.id ?? null, uses: inv.uses ?? 0 });
    });
  } catch (e) { console.error('cacheInvites error:', e.message); }
}

// ── Register slash commands ───────────────────────────────────────
async function registerCommands(guildId) {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  const commands = [
    new SlashCommandBuilder()
      .setName('setupinviterewards')
      .setDescription('Sendet das Belohnungs-Panel.')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON(),
    new SlashCommandBuilder()
      .setName('leaderboard')
      .setDescription('Zeigt die Top-Einlader.')
      .toJSON(),
    new SlashCommandBuilder()
      .setName('setinvites')
      .setDescription('Setzt manuell die Einladungen für einen User.')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption(opt => opt.setName('user').setDescription('Der User').setRequired(true))
      .addIntegerOption(opt => opt.setName('amount').setDescription('Anzahl der Invites').setRequired(true).setMinValue(0))
      .toJSON(),
  ];
  await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: commands });
}

// ── Panel builder ─────────────────────────────────────────────────
function buildPanel() {
  const embed = new EmbedBuilder()
    .setColor(0x1e1f22)
    .setTitle('🎁 Invite Rewards')
    .setDescription(
      `Lade Freunde ein, um Belohnungen zu erhalten!\n\n` +
      `**Ziel:** ${REQUIRED_INVITES} Verifizierte Invites\n` +
      `**Belohnung:** ${REWARD}\n\n` +
      `Klicke unten, um deinen Link zu erstellen oder deinen Fortschritt zu prüfen.`
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('gen_invite').setLabel('Link erstellen').setEmoji('🔗').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('check_inv').setLabel('Invites prüfen').setEmoji('📊').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('claim').setLabel(`Claim ${REWARD}`).setEmoji('💰').setStyle(ButtonStyle.Success),
  );

  return { embeds: [embed], components: [row] };
}

// ── Events ────────────────────────────────────────────────────────
client.once('ready', async () => {
  console.log(`✅ Eingeloggt als ${client.user.tag}`);
  for (const guild of client.guilds.cache.values()) {
    await registerCommands(guild.id);
    await cacheInvites(guild);
  }
});

client.on('guildMemberAdd', async member => {
  const accountAge = Date.now() - member.user.createdTimestamp;
  if (accountAge < MIN_ACCOUNT_AGE_MS || hasBeenCounted(member.id)) return;
  const newInvites = await member.guild.invites.fetch();
  let usedInviterId = null;
  newInvites.forEach(inv => {
    const cached = cachedInvites.get(inv.code);
    if (cached && inv.uses > cached.uses) usedInviterId = cached.inviterId;
  });
  newInvites.forEach(inv => {
    cachedInvites.set(inv.code, { inviterId: inv.inviter?.id ?? null, uses: inv.uses ?? 0 });
  });
  if (usedInviterId && usedInviterId !== member.id) setPending(member.id, usedInviterId);
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
  const gotRole = !oldMember.roles.cache.has(VERIFY_ROLE_ID) && newMember.roles.cache.has(VERIFY_ROLE_ID);
  if (!gotRole) return;
  const inviterId = getPending(newMember.id);
  if (!inviterId) return;
  markAsCounted(newMember.id);
  removePending(newMember.id);
  addInvite(inviterId);
});

// ── Interaction Handler ───────────────────────────────────────────
client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'setupinviterewards') {
      await interaction.reply({ content: 'Panel gesendet!', ephemeral: true });
      await interaction.channel.send(buildPanel());
    }
    if (interaction.commandName === 'leaderboard') {
      const data = loadData();
      const sorted = Object.entries(data.invites).sort(([, a], [, b]) => b - a).slice(0, 10);
      const lb = sorted.map(([id, count], i) => `${i + 1}. <@${id}> — **${count}**`).join('\n') || 'Keine Daten.';
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🏆 Leaderboard').setDescription(lb).setColor(0x1e1f22)] });
    }
    if (interaction.commandName === 'setinvites') {
      const target = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      setInvites(target.id, amount);
      await interaction.reply({ content: `✅ Die Invites von **${target.tag}** wurden auf **${amount}** gesetzt.`, ephemeral: true });
    }
  }

  if (interaction.isButton()) {
    const userId = interaction.user.id;

    if (interaction.customId === 'gen_invite') {
      const inv = await interaction.channel.createInvite({ maxAge: 0, unique: true });
      await interaction.reply({ content: `Dein Link: ${inv.url}`, ephemeral: true });
    }

    if (interaction.customId === 'check_inv') {
      await interaction.reply({ content: `Du hast **${getInvites(userId)}** verifizierte Invites.`, ephemeral: true });
    }

    if (interaction.customId === 'claim') {
      const count = getInvites(userId);
      if (count < REQUIRED_INVITES) {
        return interaction.reply({ content: `❌ Du brauchst ${REQUIRED_INVITES} Invites (Du hast ${count}).`, ephemeral: true });
      }

      try {
        const ticket = await interaction.guild.channels.create({
          name: `1M-${interaction.user.username}`,
          type: ChannelType.GuildText,
          parent: TICKET_CATEGORY_ID,
          permissionOverwrites: [
            { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
            { id: ADMIN_ROLE_1, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
            { id: ADMIN_ROLE_2, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          ],
        });

        const ticketText = 
          `✨ ⎯⎯  DEIN REWARD EINLÖSEN  ⎯⎯ ✨\n\n` +
          `💎 **Belohnungswert:** 1.000.000 $\n\n` +
          `🧮 **KURZRECHNUNG:**\n` +
          `Reward (1 Mio) ÷ Ancient-Wert (z.B. 40k) = Menge (25 Stück)\n\n` +
          `🛠 **DEINE AUFGABE:**\n` +
          `↳ Order Ingame erstellen (Menge laut Rechnung)\n` +
          `↳ Preis pro Stück: 1$ \n` +
          `↳ Steuern: Gehen auf unseren Nacken! \n\n` +
          `📩 **SCHREIB UNS:**\n` +
          `• Ingame-Name: ________________\n` +
          `• Status: "Order ist reingestellt worden!"`;

        const embed = new EmbedBuilder()
          .setTitle('🎫 1M-Reward Ticket')
          .setDescription(ticketText)
          .setColor(0x00FF00)
          .setTimestamp();

        const closeRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('close_ticket').setLabel('Ticket schließen').setEmoji('🔒').setStyle(ButtonStyle.Danger)
        );

        await ticket.send({ 
          content: `<@&${ADMIN_ROLE_1}> <@&${ADMIN_ROLE_2}> | <@${userId}>`, 
          embeds: [embed],
          components: [closeRow]
        });
        
        resetInvites(userId);
        await interaction.reply({ content: `✅ Ticket erstellt: ${ticket}`, ephemeral: true });

      } catch (e) {
        console.error(e);
        await interaction.reply({ content: '❌ Fehler beim Erstellen des Tickets.', ephemeral: true });
      }
    }

    if (interaction.customId === 'close_ticket') {
      const hasPerm = interaction.member.roles.cache.has(ADMIN_ROLE_1) || interaction.member.roles.cache.has(ADMIN_ROLE_2);
      if (!hasPerm) return interaction.reply({ content: '❌ Nur Admins können das Ticket schließen.', ephemeral: true });

      await interaction.reply('🔒 Ticket wird in 5 Sekunden geschlossen...');
      setTimeout(() => interaction.channel.delete().catch(() => null), 5000);
    }
  }
});

client.login(TOKEN);
