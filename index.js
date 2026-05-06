const {
  Client, GatewayIntentBits, EmbedBuilder,
  ButtonBuilder, ButtonStyle, ActionRowBuilder,
  REST, Routes, SlashCommandBuilder, PermissionFlagsBits,
  ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle
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
const DATA_FILE = '/app/data/data.json';
const REVIEWS_CHANNEL_ID = '1499131549826813962';
const KUNDEN_ROLE_ID = '1499472189420732421';

const REQUIRED_INVITES = 8;
const REWARD = '$1m on HugoSMP';
const RULES_CHANNEL_ID = '1499135456133255239';
const VERIFY_ROLE_ID = '1499149656951885956';
const REWARD_LOG_ID = '1500479671031169144';
const LEADERBOARD_CHANNEL_ID = '1499132426947919903';
const TICKET_CATEGORY_ID = '1499147835528974356';

const STAFF_ROLE_IDS = [
  '1499146219946250241',
  '1499159379902074880'
];
const MIN_ACCOUNT_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// ── Data helpers ──────────────────────────────────────────────────
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      data.invites = data.invites || {};
      data.counted = data.counted || [];
      data.pending = data.pending || {};
      data.leaderboardMessageId = data.leaderboardMessageId || null;
      if (typeof data.nextOrderId !== 'number') data.nextOrderId = 1;
      return data;
    }
  } catch (e) {
    console.error('loadData error:', e.message);
  }
  return { invites: {}, counted: [], pending: {}, leaderboardMessageId: null, nextOrderId: 1 };
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('saveData error:', e.message);
  }
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
function hasBeenCounted(memberId) { return loadData().counted?.includes(memberId) ?? false; }
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
function getPending(memberId) { return loadData().pending?.[memberId] ?? null; }
function removePending(memberId) {
  const data = loadData();
  if (data.pending) delete data.pending[memberId];
  saveData(data);
}

// ── Order ID ──────────────────────────────────────────────────────
function getNextOrderId() {
  const data = loadData();
  const orderId = `#${String(data.nextOrderId).padStart(4, '0')}`;
  data.nextOrderId += 1;
  saveData(data);
  return orderId;
}

// ── Invite cache ──────────────────────────────────────────────────
const cachedInvites = new Map();
async function cacheInvites(guild) {
  try {
    const invites = await guild.invites.fetch();
    invites.forEach(inv => {
      cachedInvites.set(inv.code, {
        inviterId: inv.inviter?.id ?? null,
        uses: inv.uses ?? 0
      });
    });
    console.log(`📋 Cached ${invites.size} invites for ${guild.name}`);
  } catch (e) {
    console.error('cacheInvites error:', e.message);
  }
}

// ── Live Leaderboard ──────────────────────────────────────────────
function buildLeaderboardEmbed() {
  const data = loadData();
  const botId = client.user.id;
  const sorted = Object.entries(data.invites)
    .filter(([userId, v]) => v > 0 && userId !== botId)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);
  const medals = ['🥇', '🥈', '🥉'];
  const lines = sorted.length > 0
    ? sorted.map(([userId, count], i) =>
        `${medals[i] ?? `**${i + 1}.**`} <@${userId}> — **${count}** invite${count === 1 ? '' : 's'}`
      ).join('\n')
    : '*Noch keine Einladungen vorhanden.*';
  return new EmbedBuilder()
    .setColor('#b10de7')
    .setTitle('🏆 Invite Leaderboard')
    .setDescription(lines)
    .setFooter({ text: `Ziel: ${REQUIRED_INVITES} verifizierte Einladungen → ${REWARD}` })
    .setTimestamp();
}

async function updateLeaderboard() {
  try {
    const channel = client.channels.cache.get(LEADERBOARD_CHANNEL_ID);
    if (!channel) return;
    const data = loadData();
    const embed = buildLeaderboardEmbed();
    if (data.leaderboardMessageId) {
      try {
        const msg = await channel.messages.fetch(data.leaderboardMessageId);
        await msg.edit({ embeds: [embed] });
        return;
      } catch (e) {}
    }
    const msg = await channel.send({ embeds: [embed] });
    data.leaderboardMessageId = msg.id;
    saveData(data);
    console.log(`📊 Leaderboard message created: ${msg.id}`);
  } catch (e) {
    console.error('updateLeaderboard error:', e.message);
  }
}

// ── Register slash commands ───────────────────────────────────────
async function registerCommands(guildId) {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  const commands = [
    new SlashCommandBuilder()
      .setName('setupinviterewards')
      .setDescription('Send the invite rewards panel to this channel. Admin only.')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON(),
    new SlashCommandBuilder()
      .setName('setupleaderboard')
      .setDescription('Send the live leaderboard to this channel. Admin only.')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON(),
    new SlashCommandBuilder()
      .setName('inviterewards')
      .setDescription('Invite your friends to earn rewards!')
      .toJSON(),
    new SlashCommandBuilder()
      .setName('leaderboard')
      .setDescription('Show the top inviters!')
      .toJSON(),
    new SlashCommandBuilder()
      .setName('fertig')
      .setDescription('Bestellung als fertig markieren + Bewertung anfordern')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption(opt =>
        opt.setName('user')
          .setDescription('Der Käufer')
          .setRequired(true)
      )
      .toJSON(),
    new SlashCommandBuilder()
      .setName('setinvites')
      .setDescription('Set invites manually. Admin only.')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption(opt =>
        opt.setName('user')
          .setDescription('User whose invites should be changed')
          .setRequired(true)
      )
      .addIntegerOption(opt =>
        opt.setName('amount')
          .setDescription('New invite amount')
          .setRequired(true)
          .setMinValue(0)
      )
      .toJSON(),
  ];
  await rest.put(
    Routes.applicationGuildCommands(client.user.id, guildId),
    { body: commands }
  );
  console.log(`✅ Commands registered for guild ${guildId}`);
}

// ── Panel builder ─────────────────────────────────────────────────
function buildPanel() {
  const embed = new EmbedBuilder()
    .setColor('#b10de7')
    .setTitle('🎁 Invite Rewards')
    .setDescription(
      'Lade deine Freunde auf den Server ein und verdiene Belohnungen!\n\n' +
      `**Ziel:** ${REQUIRED_INVITES} Verifizierte Einladungen\n` +
      `**Belohnung:** ${REWARD}\n\n` +
      '⚠️ **WICHTIG:**\n' +
      'Nur Einladungen die über den Button unten generiert werden zählen!\n' +
      'Normale Discord Einladungslinks zählen **NICHT**.\n\n' +
      'Klicke unten auf die Buttons um deinen persönlichen Link zu erstellen oder deinen Fortschritt zu prüfen.'
    );
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('gen_invite')
      .setLabel('Generate Invite Link')
      .setEmoji('🔗')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('check_inv')
      .setLabel('Check Invites')
      .setEmoji('📊')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('claim')
      .setLabel(`Claim ${REWARD}`)
      .setEmoji('💰')
      .setStyle(ButtonStyle.Success),
  );
  return { embeds: [embed], components: [row] };
}

// ── Ready ─────────────────────────────────────────────────────────
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  for (const guild of client.guilds.cache.values()) {
    try {
      await registerCommands(guild.id);
      await cacheInvites(guild);
    } catch (e) {
      console.error(`Guild error (${guild.name}):`, e);
    }
  }
  await updateLeaderboard();
  setInterval(updateLeaderboard, 5 * 60 * 1000);
});

client.on('guildCreate', async guild => {
  try {
    await registerCommands(guild.id);
    await cacheInvites(guild);
    console.log(`✅ Joined new guild: ${guild.name}`);
  } catch (e) {
    console.error('guildCreate error:', e.message);
  }
});

client.on('inviteCreate', inv => {
  cachedInvites.set(inv.code, { inviterId: inv.inviter?.id ?? null, uses: inv.uses ?? 0 });
});
client.on('inviteDelete', inv => cachedInvites.delete(inv.code));

// ── Member joins ──────────────────────────────────────────────────
client.on('guildMemberAdd', async member => {
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
      cachedInvites.set(inv.code, { inviterId: inv.inviter?.id ?? null, uses: inv.uses ?? 0 });
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
  } catch (e) {
    console.error('guildMemberAdd error:', e.message);
  }
});

// ── Verify role assigned → count invite ──────────────────────────
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
const reviewedUsers = new Set();

client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'setupinviterewards') {
      await interaction.deferReply({ ephemeral: true });
      try {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return interaction.editReply('❌ You need Administrator permissions!');
        }
        await interaction.channel.send(buildPanel());
        return interaction.editReply('✅ Invite Rewards panel sent!');
      } catch (e) {
        console.error('setupinviterewards error:', e.message);
        return interaction.editReply('❌ Could not send panel. Check bot permissions.');
      }
    }
    if (interaction.commandName === 'setupleaderboard') {
      await interaction.deferReply({ ephemeral: true });
      try {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return interaction.editReply('❌ You need Administrator permissions!');
        }
        const msg = await interaction.channel.send({ embeds: [buildLeaderboardEmbed()] });
        const data = loadData();
        data.leaderboardMessageId = msg.id;
        saveData(data);
        return interaction.editReply('✅ Live Leaderboard gesendet! Es aktualisiert sich automatisch.');
      } catch (e) {
        console.error('setupleaderboard error:', e.message);
        return interaction.editReply('❌ Fehler beim Senden des Leaderboards.');
      }
    }
    if (interaction.commandName === 'inviterewards') {
      return interaction.reply(buildPanel());
    }
    if (interaction.commandName === 'leaderboard') {
      await interaction.deferReply();
      return interaction.editReply({ embeds: [buildLeaderboardEmbed()] });
    }
    if (interaction.commandName === 'setinvites') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ You need Administrator permissions!', ephemeral: true });
      }
      const user = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      setInvites(user.id, amount);
      await updateLeaderboard();
      return interaction.reply({ content: `✅ Set invite count for <@${user.id}> to **${amount}**.`, ephemeral: true });
    }
    if (interaction.commandName === 'fertig') {
      const user = interaction.options.getUser('user');
      const orderId = getNextOrderId();
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`bewerten_${user.id}_${orderId}`)
          .setLabel('Jetzt bewerten')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('⭐')
      );
      await interaction.reply({
        content: `✅ Bestellung für ${user} wurde als **fertig** markiert!\n**Order-ID:** ${orderId}\n\n${user}, bitte bewertete den Shop!\n\n> Nach der Bewertung erhältst du automatisch die **Kunden-Rolle**.`,
        components: [row]
      });
    }
  }

  if (interaction.isButton()) {
    if (interaction.customId === 'gen_invite') {
      await interaction.deferReply({ ephemeral: true });
      try {
        const rulesChannel = interaction.guild.channels.cache.get(RULES_CHANNEL_ID) ?? interaction.channel;
        const invite = await rulesChannel.createInvite({ maxAge: 0, maxUses: 0, unique: true });
        cachedInvites.set(invite.code, { inviterId: interaction.user.id, uses: 0 });
        return interaction.editReply(`✅ Here is your personal invite link: https://discord.gg/${invite.code}\n\nMake sure your friends **verify** after joining!`);
      } catch (e) {
        return interaction.editReply('❌ Could not create invite. Missing permissions?');
      }
    }
    if (interaction.customId === 'check_inv') {
      await interaction.deferReply({ ephemeral: true });
      const count = getInvites(interaction.user.id);
      return interaction.editReply(`📊 You currently have **${count}** verified invite${count === 1 ? '' : 's'}!`);
    }
    if (interaction.customId === 'claim') {
      await interaction.deferReply({ ephemeral: true });
      const count = getInvites(interaction.user.id);
      if (count < REQUIRED_INVITES) {
        return interaction.editReply(`❌ You don't have enough verified invites yet!\n\n**${count}/${REQUIRED_INVITES}** — You need **${REQUIRED_INVITES - count}** more.`);
      }
      // Dein Ticket-Code hier (bitte deinen Original-Claim-Code einfügen, falls er fehlt)
    }
    if (interaction.customId === 'close_ticket') {
      const isStaff = STAFF_ROLE_IDS.some(roleId => interaction.member.roles.cache.has(roleId));
      if (!isStaff) {
        return interaction.reply({ content: '❌ Only staff can close this ticket.', ephemeral: true });
      }
      await interaction.reply({ content: '🔒 Ticket will be closed in 3 seconds...', ephemeral: true });
      setTimeout(async () => {
        try { await interaction.channel.delete(); } catch (e) {}
      }, 3000);
    }

    if (interaction.customId.startsWith('bewerten_')) {
      const parts = interaction.customId.split('_');
      const buyerId = parts[1];
      const orderId = parts[2] || 'Unbekannt';
      if (interaction.user.id !== buyerId) {
        return interaction.reply({ content: '❌ Du darfst nur deine eigene Bestellung bewerten!', ephemeral: true });
      }
      if (reviewedUsers.has(buyerId)) {
        return interaction.reply({ content: '❌ Du hast bereits eine Bewertung abgegeben!', ephemeral: true });
      }
      const modal = new ModalBuilder()
        .setCustomId(`review_modal_${buyerId}_${orderId}`)
        .setTitle('HugoSMP Market Bewertung');
      const stars = new TextInputBuilder()
        .setCustomId('stars')
        .setLabel('Sterne (1-5)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('5')
        .setRequired(true)
        .setMaxLength(1);
      const text = new TextInputBuilder()
        .setCustomId('text')
        .setLabel('Deine Bewertung')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('War alles schnell, kein Scam, 1 Stack Ancient mehr...')
        .setRequired(true);
      modal.addComponents(
        new ActionRowBuilder().addComponents(stars),
        new ActionRowBuilder().addComponents(text)
      );
      await interaction.showModal(modal);
    }
  }

  // Modal abgesendet
  if (interaction.isModalSubmit() && interaction.customId.startsWith('review_modal_')) {
    const parts = interaction.customId.split('_');
    const buyerId = parts[2];
    const orderId = parts[3] || 'Unbekannt';

    const starsStr = interaction.fields.getTextInputValue('stars');
    const text = interaction.fields.getTextInputValue('text');
    const stars = parseInt(starsStr);

    if (isNaN(stars) || stars < 1 || stars > 5) {
      return interaction.reply({ content: '❌ Bitte eine Zahl zwischen **1** und **5** eingeben!', ephemeral: true });
    }

    const reviewChannel = interaction.guild.channels.cache.get(REVIEWS_CHANNEL_ID);
    if (!reviewChannel) {
      return interaction.reply({ content: '❌ Reviews-Channel nicht gefunden!', ephemeral: true });
    }

    const starsEmoji = '⭐'.repeat(stars);
    const reviewer = interaction.user;

    const embed = new EmbedBuilder()
      .setAuthor({ name: reviewer.username, iconURL: reviewer.displayAvatarURL() })
      .setTitle('Bewertung — HugoSMP Market')
      .setDescription(`**Bewertet von:** **<@${reviewer.id}>**\n\n${starsEmoji} **(${stars}/5)**\n\n${text}`)
      .setThumbnail('https://cdn.discordapp.com/attachments/1499135826624249996/1501579033291522299/Hugo_SMP_Shop_Icon.jpg')
      .setFooter({ text: `Order-ID: ${orderId}` })
      .setColor(0x00ff00)
      .setTimestamp();

    await reviewChannel.send({ embeds: [embed] });

    try {
      const member = await interaction.guild.members.fetch(reviewer.id);
      if (!member.roles.cache.has(KUNDEN_ROLE_ID)) {
        await member.roles.add(KUNDEN_ROLE_ID);
      }
    } catch (e) {
      console.error('Rolle konnte nicht vergeben werden:', e.message);
    }

    reviewedUsers.add(buyerId);

    await interaction.reply({ 
      content: '✅ **Danke für deine Bewertung!**\nDu hast die **Kunden-Rolle** erhalten.\n\nDas Ticket wird in 3 Sekunden automatisch geschlossen...', 
      ephemeral: true 
    });

    // Automatisches Schließen nur bei normalen Kauf-Tickets
    if (!interaction.channel.name.toLowerCase().startsWith('1m-')) {
      setTimeout(async () => {
        try {
          await interaction.channel.delete();
        } catch (e) {
          console.error('Ticket konnte nicht geschlossen werden:', e.message);
        }
      }, 3000);
    }
  }
});

client.login(TOKEN);
