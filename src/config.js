'use strict';

// Feste IDs und Einstellungen des HugoSMP-Servers. Werte aus der .env haben Vorrang.
const path = require('path');

// ── Config ────────────────────────────────────────────────────────
const TOKEN = process.env.DISCORD_TOKEN;
const DATA_FILE = process.env.DATA_FILE || '/app/data/data.json';
const PORT = process.env.PORT || 3000;
const WEBSITE_URL = process.env.WEBSITE_URL || '*';
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || '';
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://130.61.188.221:3000/dashboard';
const GUILD_ID = '1499129162378514524';

const REVIEWS_CHANNEL_ID = '1499131549826813962';
const KUNDEN_ROLE_ID = '1499472189420732421';

const REQUIRED_INVITES = 8;
const REWARD = '$5m on HugoSMP';

const RULES_CHANNEL_ID = '1499135456133255239';
const VERIFY_ROLE_ID = '1499149656951885956';
const REWARD_LOG_ID = '1500479671031169144';
const LEADERBOARD_CHANNEL_ID = '1499132426947919903';

const TICKET_CATEGORY_ID = '1499147835528974356';
const CLOSED_TICKET_CATEGORY_ID = '1499148006270963732';
const TICKET_LOG_CHANNEL_ID = '1499147413355626646';
const DM_STAFF_CHANNEL_ID = process.env.DM_STAFF_CHANNEL_ID || TICKET_LOG_CHANNEL_ID;
const DM_STAFF_MENTION = process.env.DM_STAFF_MENTION || '';
const MAX_DASHBOARD_ATTACHMENTS = 5;
const MAX_DASHBOARD_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const MAX_DASHBOARD_ATTACHMENT_TOTAL_BYTES = 12 * 1024 * 1024;

const STOCK_CHANNEL_ID = '1502271613968846878';
const RESTOCK_CHANNEL_ID = process.env.RESTOCK_CHANNEL_ID || '1533616215963209828';
const SHOP_PANEL_CHANNEL_ID = process.env.SHOP_PANEL_CHANNEL_ID || STOCK_CHANNEL_ID;

const PUNISH_LOG_CHANNEL_ID = '1506807507564232714'; // ← Mod-Log Channel ID eintragen

const STAFF_ROLE_IDS = [
  '1499146219946250241',
  '1499159379902074880'
];

const PING_ROLES = {
  giveaways: '1501296933732618360',
  restocks: '1501297036719423700',
  deals: '1501297197113938100',
  news: '1501297279804641474'
};

const MIN_ACCOUNT_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// ── Stock items ───────────────────────────────────────────────────
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
  },
  {
    id: 'skeleton_spawner',
    name: 'Skeleton Spawner',
    emoji: '<:SkeletonSpawner:1504552157053980793>',
    emojiId: '1504552157053980793',
    price: '6 €'
  },
];

module.exports = {
  TOKEN,
  DATA_FILE,
  PORT,
  WEBSITE_URL,
  DASHBOARD_PASSWORD,
  DASHBOARD_URL,
  GUILD_ID,
  REVIEWS_CHANNEL_ID,
  KUNDEN_ROLE_ID,
  REQUIRED_INVITES,
  REWARD,
  RULES_CHANNEL_ID,
  VERIFY_ROLE_ID,
  REWARD_LOG_ID,
  LEADERBOARD_CHANNEL_ID,
  TICKET_CATEGORY_ID,
  CLOSED_TICKET_CATEGORY_ID,
  TICKET_LOG_CHANNEL_ID,
  DM_STAFF_CHANNEL_ID,
  DM_STAFF_MENTION,
  MAX_DASHBOARD_ATTACHMENTS,
  MAX_DASHBOARD_ATTACHMENT_BYTES,
  MAX_DASHBOARD_ATTACHMENT_TOTAL_BYTES,
  STOCK_CHANNEL_ID,
  RESTOCK_CHANNEL_ID,
  SHOP_PANEL_CHANNEL_ID,
  PUNISH_LOG_CHANNEL_ID,
  STAFF_ROLE_IDS,
  PING_ROLES,
  MIN_ACCOUNT_AGE_MS,
  STOCK_ITEMS,
};
