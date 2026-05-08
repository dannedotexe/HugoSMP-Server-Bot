/**
 * ==============================================================================
 * PROJECT: HugoSMP All-in-One Discord Bot
 * MODULE: Integrated System (Invites, Stock, Tickets, Verify, Rewards)
 * DESCRIPTION: This script combines all features into one robust application.
 * ==============================================================================
 */

// --- 1. DEPENDENCIES & IMPORTS ---
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
    PermissionFlagsBits,
    ChannelType,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    Events,
    Collection,
    AuditLogEvent
} = require('discord.js');

const fs = require('fs');
const path = require('path');

// --- 2. CLIENT INITIALIZATION ---
// We enable all necessary intents to track members, invites and messages.
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildPresences
    ]
});

// --- 3. CONFIGURATION & CONSTANTS ---
// Environment variables and static IDs for the HugoSMP Server.
const TOKEN = process.env.DISCORD_TOKEN;
const DATA_FILE = '/app/data/data.json';

// Channel IDs
const REVIEWS_CHANNEL_ID = '1499131549826813962';
const RULES_CHANNEL_ID = '1499135456133255239';
const REWARD_LOG_ID = '1500479671031169144';
const LEADERBOARD_CHANNEL_ID = '1499132426947919903';
const STOCK_CHANNEL_ID = '1502271613968846878';

// Category IDs
const TICKET_CATEGORY_ID = '1499147835528974356';

// Role IDs
const KUNDEN_ROLE_ID = '1499472189420732421';
const VERIFY_ROLE_ID = '1499149656951885956';
const STAFF_ROLE_IDS = [
    '1499146219946250241',
    '1499159379902074880'
];

// Reward Settings
const REQUIRED_INVITES = 8;
const REWARD = '$1m on HugoSMP';
const MIN_ACCOUNT_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 Days in Milliseconds

// Stock Definitions
const STOCK_ITEMS = [
    { 
        id: 'money', 
        name: '1M Money', 
        emoji: '<:Money:1502281700774772908>', 
        emojiId: '1502281700774772908', 
        price: '1,50 €' 
    },
    { 
        id: 'elytra', 
        name: 'Elytra', 
        emoji: '<:Elytra:1502281765492883497>', 
        emojiId: '1502281765492883497', 
        price: '110 €' 
    },
    { 
        id: 'mace', 
        name: 'Mace mit Windburst I', 
        emoji: '<:Mace:1502281825131692163>', 
        emojiId: '1502281825131692163', 
        price: '1,50 €' 
    },
    { 
        id: 'deepslate', 
        name: 'Deepslate Emerald Ore', 
        emoji: '<:DeepslateEmeraldOre:1502281747667353610>', 
        emojiId: '1502281747667353610', 
        price: '0,70 €' 
    },
    { 
        id: 'ancient', 
        name: 'Ancient Debris', 
        emoji: '<:Ancient:1502281804780933293>', 
        emojiId: '1502281804780933293', 
        price: '0,08 €' 
    },
    { 
        id: 'gilded', 
        name: 'Gilded Blackstone', 
        emoji: '<:GildedBlackstone:1502281854051680469>', 
        emojiId: '1502281854051680469', 
        price: '0,04 €' 
    }
];

// Cache Systems
const cachedInvites = new Collection();
const reviewedUsers = new Set();

// --- 4. DATA MANAGEMENT SYSTEM (I/O) ---

/**
 * loads the JSON database from the disk.
 * If the file does not exist, it creates a default structure.
 */
function loadData() {
    console.log('[DATABASE] Attempting to load data file...');
    try {
        if (fs.existsSync(DATA_FILE)) {
            const fileContent = fs.readFileSync(DATA_FILE, 'utf8');
            const parsedData = JSON.parse(fileContent);

            // Default Structure Enforcement
            if (!parsedData.invites) parsedData.invites = {};
            if (!parsedData.counted) parsedData.counted = [];
            if (!parsedData.pending) parsedData.pending = {};
            if (!parsedData.leaderboardMessageId) parsedData.leaderboardMessageId = null;
            if (!parsedData.stockMessageId) parsedData.stockMessageId = null;
            if (!parsedData.stockButtonsMessageId) parsedData.stockButtonsMessageId = null;
            if (!parsedData.stockChannelId) parsedData.stockChannelId = STOCK_CHANNEL_ID;
            if (!parsedData.publicStockMessageId) parsedData.publicStockMessageId = null;
            if (!parsedData.publicStockChannelId) parsedData.publicStockChannelId = null;
            if (typeof parsedData.nextOrderId !== 'number') parsedData.nextOrderId = 1;
            if (!parsedData.stock) parsedData.stock = {};

            // Synchronize Stock Items with DB
            STOCK_ITEMS.forEach(item => {
                if (typeof parsedData.stock[item.id] !== 'number') {
                    parsedData.stock[item.id] = 0;
                }
            });

            console.log('[DATABASE] Data loaded successfully.');
            return parsedData;
        }
    } catch (error) {
        console.error('[DATABASE ERROR] Critical error loading data:', error);
    }

    // Default Initial Data Object
    console.log('[DATABASE] No file found. Creating initial data structure.');
    const initialStructure = {
        invites: {},
        counted: [],
        pending: {},
        leaderboardMessageId: null,
        stockMessageId: null,
        stockButtonsMessageId: null,
        stockChannelId: STOCK_CHANNEL_ID,
        publicStockMessageId: null,
        publicStockChannelId: null,
        nextOrderId: 1,
        stock: {}
    };

    STOCK_ITEMS.forEach(item => {
        initialStructure.stock[item.id] = 0;
    });

    return initialStructure;
}

/**
 * writes the data object to the JSON file.
 */
function saveData(dataObject) {
    console.log('[DATABASE] Saving data to disk...');
    try {
        const stringified = JSON.stringify(dataObject, null, 2);
        fs.writeFileSync(DATA_FILE, stringified, 'utf8');
        console.log('[DATABASE] Save operation complete.');
    } catch (error) {
        console.error('[DATABASE ERROR] Failed to write to disk:', error);
    }
}

// --- 5. CORE LOGIC FUNCTIONS ---

/**
 * retrieves the invite count for a specific user.
 */
function getInvites(userId) {
    const data = loadData();
    const count = data.invites[userId] || 0;
    return count;
}

/**
 * updates or sets the invite count for a user manually.
 */
function setInvites(userId, newAmount) {
    const data = loadData();
    data.invites[userId] = Math.max(0, newAmount);
    saveData(data);
    console.log(`[LOG] Set invites for ${userId} to ${newAmount}`);
}

/**
 * increments the invite count for a user by 1.
 */
function addInvite(userId) {
    const data = loadData();
    const currentCount = data.invites[userId] || 0;
    const updatedCount = currentCount + 1;
    
    data.invites[userId] = updatedCount;
    saveData(data);
    
    console.log(`[INVITES] User ${userId} now has ${updatedCount} invites.`);
    return updatedCount;
}

/**
 * checks if a user has already been counted towards an invitation.
 */
function hasBeenCounted(memberId) {
    const data = loadData();
    const list = data.counted || [];
    const isPresent = list.includes(memberId);
    return isPresent;
}

/**
 * marks a member as counted so they don't trigger multiple invites.
 */
function markAsCounted(memberId) {
    const data = loadData();
    if (!data.counted) data.counted = [];
    
    if (!data.counted.includes(memberId)) {
        data.counted.push(memberId);
        saveData(data);
        console.log(`[LOG] Member ${memberId} is now marked as counted.`);
    }
}

/**
 * links a new member to their inviter while they are pending verification.
 */
function setPending(memberId, inviterId) {
    const data = loadData();
    if (!data.pending) data.pending = {};
    
    data.pending[memberId] = inviterId;
    saveData(data);
    console.log(`[LOG] Set pending inviter for ${memberId} -> ${inviterId}`);
}

/**
 * gets the inviter ID for a pending member.
 */
function getPending(memberId) {
    const data = loadData();
    const inviterId = data.pending ? data.pending[memberId] : null;
    return inviterId;
}

/**
 * removes a member from the pending list after they are processed.
 */
function removePending(memberId) {
    const data = loadData();
    if (data.pending && data.pending[memberId]) {
        delete data.pending[memberId];
        saveData(data);
    }
}

/**
 * generates a unique order ID for shop transactions.
 */
function getNextOrderId() {
    const data = loadData();
    const currentId = data.nextOrderId || 1;
    const formattedId = `#${String(currentId).padStart(4, '0')}`;
    
    data.nextOrderId = currentId + 1;
    saveData(data);
    
    return formattedId;
}

// --- 6. CACHE & INVITE TRACKING ---

/**
 * fetches all current server invites and stores their usage count.
 */
async function cacheInvites(guild) {
    console.log(`[CACHE] Refreshing invite cache for ${guild.name}...`);
    try {
        const guildInvites = await guild.invites.fetch();
        
        guildInvites.forEach(invite => {
            cachedInvites.set(invite.code, {
                inviterId: invite.inviter ? invite.inviter.id : null,
                uses: invite.uses || 0
            });
        });
        
        console.log(`[CACHE] Successfully cached ${guildInvites.size} invites.`);
    } catch (error) {
        console.error('[CACHE ERROR] Error fetching invites:', error);
    }
}

// --- 7. EMBED & COMPONENT BUILDERS ---

/**
 * builds the Leaderboard Embed based on stored data.
 */
function buildLeaderboardEmbed() {
    const data = loadData();
    const botId = client.user.id;
    
    // Sort logic: filter out 0 counts and the bot itself
    const sortedEntries = Object.entries(data.invites)
        .filter(([id, count]) => count > 0 && id !== botId)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10);
        
    const medals = ['🥇', '🥈', '🥉'];
    let leaderboardString = '';
    
    if (sortedEntries.length === 0) {
        leaderboardString = '*Keine aktiven Einladungen vorhanden.*';
    } else {
        sortedEntries.forEach(([userId, count], index) => {
            const position = medals[index] || `**${index + 1}.**`;
            const inviteLabel = count === 1 ? 'invite' : 'invites';
            leaderboardString += `${position} <@${userId}> — **${count}** ${inviteLabel}\n`;
        });
    }
    
    const embed = new EmbedBuilder()
        .setColor('#b10de7')
        .setTitle('🏆 HugoSMP — Invite Leaderboard')
        .setThumbnail('https://cdn.discordapp.com/icons/1499131549826813962/a_8e6b.png')
        .setDescription(leaderboardString)
        .addFields({ 
            name: '🎁 Aktuelle Belohnung', 
            value: `Erreiche **${REQUIRED_INVITES}** verifizierte Einladungen für: **${REWARD}**` 
        })
        .setFooter({ text: 'Wird alle 5 Minuten aktualisiert' })
        .setTimestamp();
        
    return embed;
}

/**
 * builds the Stock Status Embed.
 */
function buildStockEmbed() {
    const data = loadData();
    let stockDescription = '';
    
    STOCK_ITEMS.forEach(item => {
        const amountInStock = data.stock[item.id] || 0;
        let statusIndicator = '';
        
        if (amountInStock === 0) {
            statusIndicator = '🔴 **Ausverkauft**';
        } else if (amountInStock <= 5) {
            statusIndicator = `🟡 **Knapper Bestand: ${amountInStock} verfügbar**`;
        } else {
            statusIndicator = `🟢 **Auf Lager: ${amountInStock} verfügbar**`;
        }
        
        stockDescription += `${item.emoji} **${item.name}**\n`;
        stockDescription += `┣ Preis: \`${item.price}\`\n`;
        stockDescription += `┗ Status: ${statusIndicator}\n\n`;
    });
    
    const embed = new EmbedBuilder()
        .setColor('#b10de7')
        .setTitle('🏪 Hugo Shop — Live Lagerbestand')
        .setDescription(stockDescription)
        .setThumbnail('https://cdn.discordapp.com/attachments/1499135826624249996/1501579033291522299/Hugo_SMP_Icon.jpg')
        .setFooter({ text: 'Support-Tickets für Kaufanfragen öffnen' })
        .setTimestamp();
        
    return embed;
}

/**
 * creates the interactive buttons for the staff stock management.
 */
function buildStockButtons() {
    const rows = [];
    
    // We create a row for each item (Discord allows max 5 rows, each max 5 buttons)
    STOCK_ITEMS.forEach((item, index) => {
        const actionRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`stock_minus10_${item.id}`)
                .setLabel('-10')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`stock_minus1_${item.id}`)
                .setLabel('-1')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`stock_set_${item.id}`)
                .setLabel(item.name)
                .setEmoji({ id: item.emojiId })
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`stock_plus1_${item.id}`)
                .setLabel('+1')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`stock_plus10_${item.id}`)
                .setLabel('+10')
                .setStyle(ButtonStyle.Success)
        );
        rows.push(actionRow);
    });
    
    return rows;
}

/**
 * builds the Invite Rewards Panel with buttons.
 */
function buildInvitePanel() {
    const embed = new EmbedBuilder()
        .setColor('#b10de7')
        .setTitle('🎁 Invite Rewards')
        .setDescription(
            'Verdiene Belohnungen, indem du deine Freunde einlädst!\n\n' +
            `**Ziel:** ${REQUIRED_INVITES} Verifizierte Einladungen\n` +
            `**Belohnung:** ${REWARD}\n\n` +
            '⚠️ **WICHTIG:**\n' +
            'Nur Einladungen, die über den Button unten generiert werden, zählen!\n' +
            'Personalisierte oder permanente Discord-Links werden nicht getrackt.'
        )
        .setFooter({ text: 'HugoSMP Rewards System' });

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('gen_invite')
            .setLabel('Link generieren')
            .setEmoji('🔗')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('check_inv')
            .setLabel('Status prüfen')
            .setEmoji('📊')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('claim_reward')
            .setLabel('Belohnung anfordern')
            .setEmoji('💰')
            .setStyle(ButtonStyle.Success)
    );

    return { embeds: [embed], components: [buttons] };
}

// --- 8. UPDATER FUNCTIONS ---

async function updateLeaderboardDisplay() {
    const data = loadData();
    const channel = client.channels.cache.get(LEADERBOARD_CHANNEL_ID);
    if (!channel) return console.error('[UPDATE] Leaderboard channel not found.');

    const embed = buildLeaderboardEmbed();
    
    try {
        if (data.leaderboardMessageId) {
            const message = await channel.messages.fetch(data.leaderboardMessageId);
            await message.edit({ embeds: [embed] });
        } else {
            const newMessage = await channel.send({ embeds: [embed] });
            data.leaderboardMessageId = newMessage.id;
            saveData(data);
        }
    } catch (e) {
        // If message was deleted, send new one
        const fallbackMessage = await channel.send({ embeds: [embed] });
        data.leaderboardMessageId = fallbackMessage.id;
        saveData(data);
    }
}

async function updateStockPanels() {
    const data = loadData();
    const stockEmbed = buildStockEmbed();
    const buttonRows = buildStockButtons();
    
    // 1. Staff Panel (Internal Management)
    if (data.stockMessageId && data.stockChannelId) {
        const staffChannel = client.channels.cache.get(data.stockChannelId);
        if (staffChannel) {
            try {
                const staffMsg = await staffChannel.messages.fetch(data.stockMessageId);
                await staffMsg.edit({ 
                    embeds: [stockEmbed], 
                    components: buttonRows.slice(0, 5) 
                });
                
                if (data.stockButtonsMessageId) {
                    const secondMsg = await staffChannel.messages.fetch(data.stockButtonsMessageId);
                    await secondMsg.edit({ 
                        content: '‎', 
                        components: buttonRows.slice(5) 
                    });
                }
            } catch (e) {}
        }
    }
    
    // 2. Public Panel (Store Front)
    if (data.publicStockMessageId && data.publicStockChannelId) {
        const publicChannel = client.channels.cache.get(data.publicStockChannelId);
        if (publicChannel) {
            try {
                const publicMsg = await publicChannel.messages.fetch(data.publicStockMessageId);
                await publicMsg.edit({ embeds: [stockEmbed], components: [] });
            } catch (e) {}
        }
    }
}

// --- 9. SLASH COMMAND REGISTRATION ---

async function deployCommands(guildId) {
    const commands = [
        new SlashCommandBuilder()
            .setName('setupinviterewards')
            .setDescription('Sendet das Belohnungs-Panel.')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
            
        new SlashCommandBuilder()
            .setName('setupleaderboard')
            .setDescription('Initialisiert das Live-Leaderboard.')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
            
        new SlashCommandBuilder()
            .setName('setupstock')
            .setDescription('Sendet das öffentliche Stock-Panel.')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
            
        new SlashCommandBuilder()
            .setName('setupstockpanel')
            .setDescription('Sendet das Staff Stock Management Panel.')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
            
        new SlashCommandBuilder()
            .setName('setuptickets')
            .setDescription('Sendet das Ticket-System Panel.')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
            
        new SlashCommandBuilder()
            .setName('setupverify')
            .setDescription('Sendet das Verifizierungs-Panel.')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
            
        new SlashCommandBuilder()
            .setName('say')
            .setDescription('Sendet eine Nachricht als Bot.')
            .addStringOption(o => o.setName('text').setDescription('Nachricht').setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
            
        new SlashCommandBuilder()
            .setName('invites')
            .setDescription('Überprüfe deinen Invite-Status.'),
            
        new SlashCommandBuilder()
            .setName('leaderboard')
            .setDescription('Zeige die Top 10 Einlader.'),
            
        new SlashCommandBuilder()
            .setName('setinvites')
            .setDescription('Admin: Setzt Einladungen für einen User.')
            .addUserOption(o => o.setName('user').setDescription('Zieluser').setRequired(true))
            .addIntegerOption(o => o.setName('anzahl').setDescription('Anzahl').setRequired(true).setMinValue(0))
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

        new SlashCommandBuilder()
            .setName('fertig')
            .setDescription('Markiert eine Bestellung als fertig und fordert Bewertung an.')
            .addUserOption(o => o.setName('user').setDescription('Der Käufer').setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    ].map(cmd => cmd.toJSON());

    const rest = new REST({ version: '10' }).setToken(TOKEN);
    
    try {
        console.log(`[SLASH] Deploying commands to Guild ${guildId}...`);
        await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: commands });
        console.log('[SLASH] Successfully registered application commands.');
    } catch (error) {
        console.error('[SLASH ERROR] Failed to deploy commands:', error);
    }
}

// --- 10. GLOBAL EVENT HANDLERS ---

client.once(Events.ClientReady, async () => {
    console.log(`
    --------------------------------------------------
    BOT STATUS: ONLINE
    LOGGED IN AS: ${client.user.tag}
    DATABASE: LOADED
    --------------------------------------------------
    `);
    
    // Process all guilds the bot is in
    for (const guild of client.guilds.cache.values()) {
        await deployCommands(guild.id);
        await cacheInvites(guild);
    }
    
    // Initial Updates
    await updateLeaderboardDisplay();
    
    // Set Intervals for background tasks
    setInterval(updateLeaderboardDisplay, 1000 * 60 * 5); // 5 Minutes
});

/**
 * Handle new members joining to track invites
 */
client.on(Events.GuildMemberAdd, async member => {
    const data = loadData();
    const accountAge = Date.now() - member.user.createdTimestamp;
    
    // Security check: Ignore very young accounts if needed
    if (accountAge < MIN_ACCOUNT_AGE_MS) {
        console.log(`[SECURITY] Account ${member.user.tag} too young for invite tracking.`);
        return;
    }
    
    // Fetch latest invites
    const newGuildInvites = await member.guild.invites.fetch();
    let usedInviterId = null;
    
    newGuildInvites.forEach(invite => {
        const cached = cachedInvites.get(invite.code);
        if (cached && invite.uses > cached.uses) {
            usedInviterId = cached.inviterId;
        }
    });
    
    // Update Cache
    newGuildInvites.forEach(invite => {
        cachedInvites.set(invite.code, {
            inviterId: invite.inviter ? invite.inviter.id : null,
            uses: invite.uses || 0
        });
    });
    
    // Process Pending
    if (usedInviterId && usedInviterId !== member.id) {
        setPending(member.id, usedInviterId);
        console.log(`[JOIN] ${member.user.tag} likely invited by ${usedInviterId}`);
    }
});

/**
 * Handle Role updates for Verification tracking
 */
client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    const roleAdded = !oldMember.roles.cache.has(VERIFY_ROLE_ID) && newMember.roles.cache.has(VERIFY_ROLE_ID);
    
    if (roleAdded) {
        console.log(`[VERIFY] Member ${newMember.user.tag} verified.`);
        
        if (hasBeenCounted(newMember.id)) return;
        
        const inviterId = getPending(newMember.id);
        if (inviterId) {
            addInvite(inviterId);
            markAsCounted(newMember.id);
            removePending(newMember.id);
            
            await updateLeaderboardDisplay();
            console.log(`[SUCCESS] Invite counted for ${inviterId}`);
        }
    }
});

/**
 * Handle all Interactions (Commands, Buttons, Modals)
 */
client.on(Events.InteractionCreate, async interaction => {
    
    // A. SLASH COMMANDS
    if (interaction.isChatInputCommand()) {
        const { commandName, options } = interaction;
        
        if (commandName === 'setupverify') {
            const embed = new EmbedBuilder()
                .setColor('#b10de7')
                .setTitle('🛡️ HugoSMP Verifizierung')
                .setDescription(
                    'Willkommen auf HugoSMP!\n\n' +
                    'Um Zugriff auf alle Kanäle zu erhalten, klicke bitte auf den Button unten.\n' +
                    'Damit bestätigst du auch, dass du die Regeln gelesen hast.'
                )
                .setThumbnail(interaction.guild.iconURL());
                
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('btn_verify_start')
                    .setLabel('Verifizieren')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅')
            );
            
            await interaction.channel.send({ embeds: [embed], components: [row] });
            return interaction.reply({ content: 'Verifizierungs-Panel gesendet.', ephemeral: true });
        }
        
        if (commandName === 'setuptickets') {
            const embed = new EmbedBuilder()
                .setColor('#b10de7')
                .setTitle('🎫 Support & Shop Tickets')
                .setDescription('Wähle eine Kategorie, um ein Ticket zu öffnen.');
                
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('btn_open_ticket')
                    .setLabel('Ticket erstellen')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📩')
            );
            
            await interaction.channel.send({ embeds: [embed], components: [row] });
            return interaction.reply({ content: 'Ticket-Panel gesendet.', ephemeral: true });
        }
        
        if (commandName === 'setupstockpanel') {
            const rows = buildStockButtons();
            const embed = buildStockEmbed();
            
            const msg1 = await interaction.channel.send({ 
                embeds: [embed], 
                components: rows.slice(0, 5) 
            });
            
            const msg2 = await interaction.channel.send({ 
                content: '‎', 
                components: rows.slice(5) 
            });
            
            const db = loadData();
            db.stockMessageId = msg1.id;
            db.stockButtonsMessageId = msg2.id;
            db.stockChannelId = interaction.channel.id;
            saveData(db);
            
            return interaction.reply({ content: 'Admin Stock Panel eingerichtet.', ephemeral: true });
        }

        if (commandName === 'fertig') {
            const targetUser = options.getUser('user');
            const reviewEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Bestellung Abgeschlossen')
                .setDescription(
                    `Hallo <@${targetUser.id}>!\n\nDeine Bestellung wurde soeben fertiggestellt.\n` +
                    `Wir würden uns sehr freuen, wenn du eine Bewertung in <#${REVIEWS_CHANNEL_ID}> hinterlässt!`
                )
                .setFooter({ text: 'Danke für deinen Einkauf!' });
                
            const reviewButton = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('Jetzt Bewerten')
                    .setURL(`https://discord.com/channels/${interaction.guild.id}/${REVIEWS_CHANNEL_ID}`)
                    .setStyle(ButtonStyle.Link)
            );
            
            await interaction.channel.send({ embeds: [reviewEmbed], components: [reviewButton] });
            
            // Try to DM the user
            try {
                await targetUser.send('Deine Bestellung auf HugoSMP ist fertig!');
            } catch (err) {
                console.log('Could not DM user.');
            }
            
            return interaction.reply({ content: 'Bestellung markiert.', ephemeral: true });
        }
        
        // ... Weitere Slash Commands hier ...
    }
    
    // B. BUTTON INTERACTIONS
    if (interaction.isButton()) {
        const customId = interaction.customId;
        const db = loadData();
        
        // Verification Button
        if (customId === 'btn_verify_start') {
            await interaction.member.roles.add(VERIFY_ROLE_ID);
            return interaction.reply({ content: 'Du hast nun Zugriff auf den Server!', ephemeral: true });
        }
        
        // Ticket Creation
        if (customId === 'btn_open_ticket') {
            const ticketName = `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9]/g, '');
            
            const existing = interaction.guild.channels.cache.find(c => c.name === ticketName);
            if (existing) return interaction.reply({ content: `Du hast bereits ein Ticket: <#${existing.id}>`, ephemeral: true });
            
            const ticketChannel = await interaction.guild.channels.create({
                name: ticketName,
                type: ChannelType.GuildText,
                parent: TICKET_CATEGORY_ID,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
                    ...STAFF_ROLE_IDS.map(id => ({ id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }))
                ]
            });
            
            const closeRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_close_ticket').setLabel('Schließen').setStyle(ButtonStyle.Danger).setEmoji('🔒')
            );
            
            await ticketChannel.send({ 
                content: `Willkommen <@${interaction.user.id}>! Ein Teammitglied wird sich in Kürze melden.`,
                components: [closeRow]
            });
            
            return interaction.reply({ content: `Ticket erstellt: <#${ticketChannel.id}>`, ephemeral: true });
        }
        
        if (customId === 'btn_close_ticket') {
            await interaction.reply('Ticket wird in 5 Sekunden geschlossen...');
            setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
        }

        // Stock Management Buttons Logic
        if (customId.startsWith('stock_')) {
            // Permission check
            const isStaff = STAFF_ROLE_IDS.some(roleId => interaction.member.roles.cache.has(roleId));
            if (!isStaff) return interaction.reply({ content: 'Keine Berechtigung.', ephemeral: true });
            
            const parts = customId.split('_'); // [stock, action, itemid]
            const action = parts[1];
            const itemId = parts[2];
            
            if (action === 'plus1') db.stock[itemId] += 1;
            if (action === 'plus10') db.stock[itemId] += 10;
            if (action === 'minus1') db.stock[itemId] = Math.max(0, db.stock[itemId] - 1);
            if (action === 'minus10') db.stock[itemId] = Math.max(0, db.stock[itemId] - 10);
            
            saveData(db);
            await updateStockPanels();
            return interaction.reply({ content: `Bestand für **${itemId}** aktualisiert.`, ephemeral: true });
        }
        
        // Invite Reward Buttons
        if (customId === 'gen_invite') {
            const invite = await interaction.channel.createInvite({
                maxAge: 0, // Permanent
                maxUses: 0,
                unique: true,
                reason: `Invite Reward System for ${interaction.user.tag}`
            });
            
            cachedInvites.set(invite.code, { inviterId: interaction.user.id, uses: 0 });
            return interaction.reply({ content: `Hier ist dein Invite-Link: ${invite.url}`, ephemeral: true });
        }
    }
});

// --- 11. ERROR HANDLING ---
process.on('unhandledRejection', error => {
    console.error('[CRITICAL] Unhandled promise rejection:', error);
});

// --- 12. LOGIN ---
client.login(TOKEN);

// END OF SCRIPT
