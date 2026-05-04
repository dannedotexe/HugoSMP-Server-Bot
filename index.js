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
const DATA_FILE          = '/app/data/data.json';
const VERIFY_ROLE_ID     = '1499149656951885956';
const REWARD_LOG_ID      = '1500479671031169144';
const MIN_ACCOUNT_AGE_MS = 1 * 24 * 60 * 60 * 1000;
const RULES_CHANNEL_ID   = '1499135456133255239';

const TICKET_CATEGORY_ID = '1499147835528974356';
const ADMIN_ROLE_1       = '1499146219946250241';
const ADMIN_ROLE_2       = '1499159379902074880';

const EMBED_COLOR_VIOLET = '#b10de7';

// ── Data helpers ──────────────────────────────────────────────────
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const initial = { invites: {}, counted: [], pending: {} };
    fs.mkdirSync('/app/data', { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
    return initial;
  } catch (e) { return { invites: {}, counted: [], pending: {} }; }
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
    if (interaction.customId === 'gen_invite') {
      const rulesChannel = interaction.guild.channels.cache.get(RULES_CHANNEL_ID)
        ?? interaction.guild.channels.cache.find(c => c.name === 'rules')
        ?? interaction.channel;
      const inv = await rulesChannel.createInvite({ maxAge: 0, unique: true });
      await interaction.reply({ content: `Hier ist dein persönlicher Link: ${inv.url}\nTeile diesen Link mit deinen Freunden!`, ephemeral: true });
    }

    if (interaction.customId === 'check_inv') {
      await interaction.reply({ content: `Du hast aktuell **${getInvites(interaction.user.id)}** verifizierte Invites.`, ephemeral: true });
    }

    if (interaction.customId === 'claim') {
      const currentInvites = getInvites(interaction.user.id);
      if (currentInvites < REQUIRED_INVITES) return interaction.reply({ content: `❌ Du brauchst ${REQUIRED_INVITES} Invites (Du hast ${currentInvites}).`, ephemeral: true });

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
          .setColor(EMBED_COLOR_VIOLET)
          .setTimestamp();

        await ticket.send({ content: `<@&${ADMIN_ROLE_1}> <@&${ADMIN_ROLE_2}> | <@${interaction.user.id}>`, embeds: [ticketEmbed], components: [row] });

        const logChannel = interaction.guild.channels.cache.get(REWARD_LOG_ID);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setColor(EMBED_COLOR_VIOLET)
            .setTitle('💰 Reward Claimed')
            .setDescription(`**${interaction.user.username}** hat seinen Reward beansprucht!`)
            .addFields(
              { name: '📊 Abgezogen', value: `\`${REQUIRED_INVITES} Invites\``, inline: true },
              { name: '📉 Restguthaben', value: `\`${currentInvites - REQUIRED_INVITES} Invites\``, inline: true },
              { name: '🎫 Ticket', value: `\`#${ticket.name}\``, inline: true }
            )
            .setTimestamp();
          logChannel.send({ embeds: [logEmbed] });
        }

        removeInvites(interaction.user.id, REQUIRED_INVITES);
        await interaction.reply({ content: `✅ Ticket erstellt: ${ticket}\nDir wurden ${REQUIRED_INVITES} Invites abgezogen.`, ephemeral: true });
      } catch (e) {
        console.error(e);
        await interaction.reply({ content: '❌ Fehler beim Erstellen des Tickets.', ephemeral: true });
      }
    }

    if (interaction.customId === 'close_ticket') {
      const hasPerm = interaction.member.roles.cache.has(ADMIN_ROLE_1) || interaction.member.roles.cache.has(ADMIN_ROLE_2);
      if (!hasPerm) return interaction.reply({ content: '❌ Nur Admins können das Ticket schließen.', ephemeral: true });
      await interaction.reply('🔒 Ticket wird in 5 Sekunden geschlossen...');
      setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    }
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
  console.log(`✅ Neuer Server: ${guild.name}`);
});

client.on('guildMemberAdd', async m => {
  const age = Date.now() - m.user.createdTimestamp;
  if (age < MIN_ACCOUNT_AGE_MS) return;
  if (hasBeenCounted(m.id)) return;

  const invs = await m.guild.invites.fetch();
  invs.forEach(inv => {
    const c = cachedInvites.get(inv.code);
    if (c && inv.uses > c.uses) {
      if (c.inviterId === m.id) return;
      setPending(m.id, c.inviterId);
    }
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
