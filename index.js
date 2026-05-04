const {
  Client, GatewayIntentBits, EmbedBuilder,
  ButtonBuilder, ButtonStyle, ActionRowBuilder,
  REST, Routes, SlashCommandBuilder, PermissionFlagsBits,
  ChannelType
} = require('discord.js');

const fs = require('fs');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildMembers,
  ]
});

// ── Config ─────────────────────────────────
const TOKEN = process.env.DISCORD_TOKEN;
const REQUIRED_INVITES = 8;
const REWARD = '$1m on HugoSMP';
const DATA_FILE = './data.json';

const RULES_CHANNEL_ID = '1499135456133255239';
const VERIFY_ROLE_ID = '1499149656951885956';
const REWARD_LOG_ID = '1500479671031169144';

const TICKET_CATEGORY_ID = '1499147835528974356';
const STAFF_ROLE_IDS = [
  '1499146219946250241',
  '1499159379902074880'
];

const MIN_ACCOUNT_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// ── Data ───────────────────────────────────
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE))
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {}
  return { invites: {}, counted: [], pending: {} };
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function getInvites(id) {
  return loadData().invites[id] ?? 0;
}

function setInvites(id, amount) {
  const data = loadData();
  data.invites[id] = Math.max(0, amount);
  saveData(data);
}

function addInvite(id) {
  const data = loadData();
  data.invites[id] = (data.invites[id] ?? 0) + 1;
  saveData(data);
  return data.invites[id];
}

function hasBeenCounted(id) {
  return loadData().counted.includes(id);
}

function markAsCounted(id) {
  const data = loadData();
  if (!data.counted.includes(id)) data.counted.push(id);
  saveData(data);
}

function setPending(member, inviter) {
  const data = loadData();
  data.pending[member] = inviter;
  saveData(data);
}

function getPending(member) {
  return loadData().pending[member];
}

function removePending(member) {
  const data = loadData();
  delete data.pending[member];
  saveData(data);
}

// ── Invite Cache ───────────────────────────
const cachedInvites = new Map();

async function cacheInvites(guild) {
  const invites = await guild.invites.fetch();
  invites.forEach(inv => {
    cachedInvites.set(inv.code, {
      inviterId: inv.inviter?.id,
      uses: inv.uses
    });
  });
}

// ── Commands ───────────────────────────────
async function registerCommands(guildId) {
  const rest = new REST({ version: '10' }).setToken(TOKEN);

  const commands = [
    new SlashCommandBuilder()
      .setName('setupinviterewards')
      .setDescription('Setup panel')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
      .setName('inviterewards')
      .setDescription('Show panel'),

    new SlashCommandBuilder()
      .setName('leaderboard')
      .setDescription('Top inviters'),

    new SlashCommandBuilder()
      .setName('setinvites')
      .setDescription('Set invites (Admin)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption(o => o.setName('user').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setRequired(true))
  ];

  await rest.put(
    Routes.applicationGuildCommands(client.user.id, guildId),
    { body: commands.map(c => c.toJSON()) }
  );
}

// ── Panel ──────────────────────────────────
function buildPanel() {
  const embed = new EmbedBuilder()
    .setColor('#b10de7')
    .setTitle('🎁 Invite Rewards')
    .setDescription(
      `Invite your friends to the server to earn rewards!\n\n` +
      `**Goal:** ${REQUIRED_INVITES}\n` +
      `**Reward:** ${REWARD}\n\n` +
      `⚠️ **IMPORTANT:**\n` +
      `Only invites generated with the button below will count!\n` +
      `Normal Discord invites will NOT count.\n\n` +
      `Use the buttons below:`
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('gen_invite').setLabel('Generate Invite').setEmoji('🔗').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('check_inv').setLabel('Check Invites').setEmoji('📊').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('claim').setLabel('Claim Reward').setEmoji('💰').setStyle(ButtonStyle.Success)
  );

  return { embeds: [embed], components: [row] };
}

// ── Ready ──────────────────────────────────
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  for (const guild of client.guilds.cache.values()) {
    await registerCommands(guild.id);
    await cacheInvites(guild);
  }
});

// ── Join ───────────────────────────────────
client.on('guildMemberAdd', async member => {
  const age = Date.now() - member.user.createdTimestamp;
  if (age < MIN_ACCOUNT_AGE_MS) return;
  if (hasBeenCounted(member.id)) return;

  const invites = await member.guild.invites.fetch();
  let inviter = null;

  invites.forEach(inv => {
    const cached = cachedInvites.get(inv.code);
    if (cached && inv.uses > cached.uses)
      inviter = cached.inviterId;
  });

  invites.forEach(inv => {
    cachedInvites.set(inv.code, {
      inviterId: inv.inviter?.id,
      uses: inv.uses
    });
  });

  if (inviter && inviter !== member.id)
    setPending(member.id, inviter);
});

// ── Verify ─────────────────────────────────
client.on('guildMemberUpdate', (oldM, newM) => {
  if (!oldM.roles.cache.has(VERIFY_ROLE_ID) &&
      newM.roles.cache.has(VERIFY_ROLE_ID)) {

    const inviter = getPending(newM.id);
    if (!inviter) return;

    markAsCounted(newM.id);
    removePending(newM.id);
    addInvite(inviter);
  }
});

// ── Interactions ───────────────────────────
client.on('interactionCreate', async interaction => {

  if (interaction.isChatInputCommand()) {

    if (interaction.commandName === 'setupinviterewards') {
      await interaction.channel.send(buildPanel());
      return interaction.reply({ content: 'Done', ephemeral: true });
    }

    if (interaction.commandName === 'inviterewards')
      return interaction.reply(buildPanel());

    if (interaction.commandName === 'leaderboard') {
      const data = loadData();
      const sorted = Object.entries(data.invites)
        .sort((a,b)=>b[1]-a[1]).slice(0,10);

      return interaction.reply(
        sorted.map((x,i)=>`${i+1}. <@${x[0]}> - ${x[1]}`).join('\n')
      );
    }

    if (interaction.commandName === 'setinvites') {
      const user = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      setInvites(user.id, amount);
      return interaction.reply({ content: 'Set.', ephemeral: true });
    }
  }

  if (!interaction.isButton()) return;

  // Invite
  if (interaction.customId === 'gen_invite') {
    const ch = interaction.guild.channels.cache.get(RULES_CHANNEL_ID);
    const invite = await ch.createInvite({ maxAge: 0, maxUses: 0 });
    return interaction.reply({
      content: `https://discord.gg/${invite.code}`,
      ephemeral: true
    });
  }

  // Check
  if (interaction.customId === 'check_inv') {
    return interaction.reply({
      content: `You have ${getInvites(interaction.user.id)} invites`,
      ephemeral: true
    });
  }

  // Claim
  if (interaction.customId === 'claim') {

    const count = getInvites(interaction.user.id);

    if (count < REQUIRED_INVITES) {
      return interaction.reply({
        content: 'Not enough invites',
        ephemeral: true
      });
    }

    const ticket = await interaction.guild.channels.create({
      name: `1m-${interaction.user.username}`,
      type: ChannelType.GuildText,
      parent: TICKET_CATEGORY_ID
    });

    const embed = new EmbedBuilder()
      .setColor('#b10de7')
      .setTitle('✨ — DEIN REWARD EINLÖSEN — ✨')
      .setDescription(
        `💎 **Belohnungswert:** 1.000.000 $\n\n` +
        `🧮 **KURZRECHNUNG:**\n` +
        `Reward (1 Mio) ÷ Ancient-Wert (z.B. 40k) = Menge (25 Stück)\n\n` +
        `🛠️ **DEINE AUFGABE:**\n` +
        `↳ Order Ingame erstellen\n` +
        `↳ Preis pro Stück: 1$\n` +
        `↳ Steuern: Wir zahlen!\n\n` +
        `📩 **SCHREIB UNS:**\n` +
        `• Ingame-Name\n` +
        `• Status`
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('close_ticket')
        .setLabel('Close')
        .setStyle(ButtonStyle.Danger)
    );

    await ticket.send({
      content: `<@${interaction.user.id}>`,
      embeds: [embed],
      components: [row]
    });

    setInvites(interaction.user.id, count - REQUIRED_INVITES);

    const log = interaction.guild.channels.cache.get(REWARD_LOG_ID);
    if (log) log.send(`Ticket: <#${ticket.id}>`);

    return interaction.reply({
      content: `Ticket created: <#${ticket.id}>`,
      ephemeral: true
    });
  }

  // Close
  if (interaction.customId === 'close_ticket') {

    const isStaff =
      STAFF_ROLE_IDS.some(r =>
        interaction.member.roles.cache.has(r)
      );

    if (!isStaff)
      return interaction.reply({
        content: 'No permission',
        ephemeral: true
      });

    setTimeout(() => interaction.channel.delete(), 2000);
  }
});

client.login(TOKEN);
