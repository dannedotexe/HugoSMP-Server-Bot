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
    const initial = { invites: {}, counted: [], pending: {} };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
    return initial;
  } catch (e) { return { invites: {}, counted: [], pending: {} }; }
}

function saveData(data) {
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); } catch (e) {}
}

function getInvites(userId) { return loadData().invites[userId] ?? 0; }

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

// ── Invite cache ──────────────────────────────────────────────────
const cachedInvites = new Map();

async function cacheInvites(guild) {
  try {
    const invites = await guild.invites.fetch();
    invites.forEach(inv => cachedInvites.set(inv.code, { inviterId: inv.inviter?.id ?? null, uses: inv.uses ?? 0 }));
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

// ── Interaction Handler ───────────────────────────────────────────
client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'setupinviterewards') {
      const embed = new EmbedBuilder().setColor(0x1e1f22).setTitle('🎁 Invite Rewards').setDescription(`Lade Freunde ein für **${REWARD}**!\nZiel: ${REQUIRED_INVITES} Invites.`);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('gen_invite').setLabel('Link erstellen').setEmoji('🔗').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('check_inv').setLabel('Status prüfen').setEmoji('📊').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('claim').setLabel(`Claim ${REWARD}`).setEmoji('💰').setStyle(ButtonStyle.Success)
      );
      await interaction.reply({ content: 'Panel gesendet!', ephemeral: true });
      await interaction.channel.send({ embeds: [embed], components: [row] });
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
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🏆 Leaderboard').setDescription(text).setColor(0x1e1f22)] });
    }
  }

  if (interaction.isButton()) {
    if (interaction.customId === 'gen_invite') {
      const inv = await interaction.channel.createInvite({ maxAge: 0, unique: true });
      await interaction.reply({ content: `Dein Link: ${inv.url}`, ephemeral: true });
    }
    if (interaction.customId === 'check_inv') {
      await interaction.reply({ content: `Du hast aktuell **${getInvites(interaction.user.id)}** Invites.`, ephemeral: true });
    }
    if (interaction.customId === 'claim') {
      const count = getInvites(interaction.user.id);
      if (count < REQUIRED_INVITES) return interaction.reply({ content: `❌ Du brauchst ${REQUIRED_INVITES} Invites (Du hast ${count}).`, ephemeral: true });

      try {
        const ticket = await interaction.guild.channels.create({
          name: `1M-${interaction.user.username}`,
          type: ChannelType.GuildText,
          parent: TICKET_CATEGORY_ID,
          permissionOverwrites: [
            { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
            { id: ADMIN_ROLE_1, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
            { id: ADMIN_ROLE_2, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
          ]
        });

        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_ticket').setLabel('Ticket schließen').setEmoji('🔒').setStyle(ButtonStyle.Danger));
        
        const ticketEmbed = new EmbedBuilder()
          .setTitle('✨ ⎯⎯  DEIN REWARD EINLÖSEN  ⎯⎯ ✨')
          .setDescription(`💎 **Belohnungswert:** 1.000.000 $\n\n🧮 **KURZRECHNUNG:**\nReward (1 Mio) ÷ Ancient-Wert (z.B. 40k) = Menge (25 Stück)\n\n🛠 **DEINE AUFGABE:**\n↳ Order Ingame erstellen (Menge laut Rechnung)\n↳ Preis pro Stück: 1$ \n↳ Steuern: Gehen auf unseren Nacken! \n\n📩 **SCHREIB UNS:**\n• Ingame-Name: ________________\n• Status: "Order ist reingestellt worden!"`)
          .setColor(0x00FF00)
          .setTimestamp();

        await ticket.send({ content: `<@&${ADMIN_ROLE_1}> <@&${ADMIN_ROLE_2}> | <@${interaction.user.id}>`, embeds: [ticketEmbed], components: [row] });
        
        // VERSCHÖNERTER LOG-EINTRAG
        const logChannel = interaction.guild.channels.cache.get(REWARD_LOG_ID);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('💰 Reward Claimed')
            .setDescription(`**${interaction.user.username}** (@${interaction.user.tag}) hat **${REWARD}** beansprucht!`)
            .addFields(
              { name: '👤 User', value: `<@${interaction.user.id}>`, inline: true },
              { name: '📊 Invites', value: `\`${count} verifizierte Invites\``, inline: true },
              { name: '🎫 Ticket', value: `\`#${ticket.name}\``, inline: true }
            )
            .setTimestamp()
            .setThumbnail(interaction.user.displayAvatarURL());

          logChannel.send({ embeds: [logEmbed] });
        }

        setInvites(interaction.user.id, 0);
        await interaction.reply({ content: `✅ Ticket erstellt: ${ticket}`, ephemeral: true });

      } catch (e) {
        console.error(e);
        await interaction.reply({ content: '❌ Fehler beim Erstellen des Tickets.', ephemeral: true });
      }
    }
    if (interaction.customId === 'close_ticket') {
      if (!interaction.member.roles.cache.has(ADMIN_ROLE_1) && !interaction.member.roles.cache.has(ADMIN_ROLE_2)) return interaction.reply({ content: '❌ Nur Admins können das Ticket schließen.', ephemeral: true });
      await interaction.reply('🔒 Ticket wird in 5 Sekunden geschlossen...');
      setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    }
  }
});

// ── Events ────────────────────────────────────────────────────────
client.once('ready', async () => {
  console.log(`✅ ${client.user.tag} ist bereit.`);
  for (const guild of client.guilds.cache.values()) await registerCommands(guild.id);
});

client.on('guildMemberAdd', async m => {
  const age = Date.now() - m.user.createdTimestamp;
  if (age < MIN_ACCOUNT_AGE_MS) return;
  const invs = await m.guild.invites.fetch();
  invs.forEach(inv => {
    const c = cachedInvites.get(inv.code);
    if (c && inv.uses > c.uses) setPending(m.id, c.inviterId);
    cachedInvites.set(inv.code, { inviterId: inv.inviter?.id, uses: inv.uses });
  });
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
    }
  }
});

client.login(TOKEN);
