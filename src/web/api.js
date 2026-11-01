'use strict';

// Website-API und Dashboard (Express). Aus index.js ausgelagert.

module.exports = function createWebApi(ctx) {
  const {
    BOT_VERSION,
    BrandEmbed,
    CLOSED_TICKET_CATEGORY_ID,
    ChannelType,
    DASHBOARD_PASSWORD,
    DEFAULT_PRESENCE_CONFIG,
    GUILD_ID,
    PING_ROLES,
    SHOP_PANEL_CHANNEL_ID,
    STAFF_ROLE_IDS,
    STOCK_ITEMS,
    TICKET_CATEGORY_ID,
    WEBSITE_URL,
    addDmThreadMessage,
    applyConfiguredPresence,
    buildInvoiceFromDashboardInput,
    buildInvoiceFromOrderInput,
    buildOrderStartRow,
    buildOrderTicketButtons,
    buildSaleEmbed,
    buildShopPanelEmbed,
    buildTranscript,
    cleanDmContent,
    cleanLongText,
    cleanShortText,
    cleanUsername,
    client,
    closeTicket,
    cors,
    express,
    getCachedDashboardUser,
    getDashboardChannel,
    getDashboardOrderDetails,
    getDashboardOrderList,
    getDashboardStaffMembers,
    getDashboardTextChannels,
    getDashboardTicketDetails,
    getDashboardTicketList,
    getDmUserInfo,
    getLatestShopOffer,
    getMessageAttachments,
    getMutableStockItems,
    getNextTicketOrderId,
    getOrderDashboardMeta,
    getTicketDashboardMeta,
    getTicketOrderId,
    getTicketOwnerId,
    getTicketType,
    getUserAvatar,
    getUserDisplayName,
    isStaff,
    loadData,
    loadPresenceConfig,
    makeDashboardError,
    normalizeDashboardAttachments,
    normalizePresenceStatus,
    normalizeStockEmoji,
    normalizeStockItemId,
    notice,
    notifyRestock,
    path,
    reopenTicket,
    resolveDashboardTextChannel,
    saveData,
    sendOrderInvoice,
    sendOrderReviewRequest,
    serializeDashboardTicket,
    serializeDmThread,
    setInvites,
    updateDashboardOrderMeta,
    updateLeaderboard,
    updateStockPanel,
  } = ctx;

  // ── Website API ───────────────────────────────────────────────────
  const app = express();
  // Hinter Caddy (HTTPS) kommt die echte IP im X-Forwarded-For-Header
  app.set('trust proxy', 'loopback');
  app.disable('x-powered-by');

  app.use(cors({
    origin: WEBSITE_URL === '*' ? true : WEBSITE_URL
  }));

  app.use(express.json({ limit: '16mb' }));
  app.use('/assets', express.static(path.join(__dirname, 'assets')));

  // ── Dashboard-Login ── (src/web/auth.js)
  const { createDashboardToken, validDashboardToken, safeEqual, rateLimiter } = require('./auth');

  function getDashboardToken(req) {
    const auth = req.get('authorization') || '';
    if (auth.toLowerCase().startsWith('bearer ')) {
      return auth.slice(7).trim();
    }

    return String(req.body?.token || '').trim();
  }

  function requireDashboardAuth(req, res, next) {
    if (!DASHBOARD_PASSWORD) {
      return res.status(503).json({
        success: false,
        error: 'Dashboard ist nicht konfiguriert. Setze DASHBOARD_PASSWORD in der .env auf dem Server.'
      });
    }

    if (!validDashboardToken(getDashboardToken(req))) {
      return res.status(401).json({
        success: false,
        error: 'Nicht eingeloggt.'
      });
    }

    next();
  }

  function getDashboardPresence() {
    const presence = loadPresenceConfig();

    return {
      status: normalizePresenceStatus(presence.status),
      activityType: presence.activityType || DEFAULT_PRESENCE_CONFIG.activityType,
      activityName: presence.activityName || '',
      activityUrl: presence.activityUrl || ''
    };
  }

  function getDashboardStock(data = loadData()) {
    return (data.stockItems || STOCK_ITEMS).map(item => {
      const amount = Number(data.stock?.[item.id] || 0);

      return {
        id: item.id,
        name: item.name,
        emoji: item.emoji,
        emojiId: item.emojiId || null,
        price: item.price,
        amount,
        status: amount === 0 ? 'out' : amount <= 5 ? 'low' : 'ok'
      };
    });
  }


  async function getDashboardInviteRows(data = loadData(), limit = 25, fetchMissingUsers = true) {
    const rows = Object.entries(data.invites || {})
      .filter(([userId, amount]) => userId !== client.user?.id && Number(amount) > 0)
      .sort(([, a], [, b]) => Number(b) - Number(a))
      .slice(0, limit);

    return Promise.all(rows.map(async ([userId, amount], index) => {
      const cachedUser = getCachedDashboardUser(userId);
      let user = cachedUser;

      if (!user && fetchMissingUsers) {
        user = await client.users.fetch(userId).catch(() => null);
      } else if (!user) {
        client.users.fetch(userId).catch(() => {});
      }

      return {
        rank: index + 1,
        userId,
        username: getUserDisplayName(user, userId),
        avatarUrl: getUserAvatar(user),
        invites: Number(amount || 0)
      };
    }));
  }

  function getDashboardDmStats(data = loadData()) {
    const threads = Object.values(data.dmThreads || {});

    return {
      total: threads.length,
      unread: threads.reduce((sum, thread) => sum + Number(thread.unreadCount || 0), 0),
      archived: threads.filter(thread => thread.archived).length,
      open: threads.filter(thread => !thread.archived).length,
      lastMessageAt: threads.reduce((latest, thread) => Math.max(latest, Number(thread.lastMessageAt || 0)), 0) || null
    };
  }

  async function getDashboardOverview() {
    const data = loadData();
    const guild = client.guilds.cache.get(GUILD_ID) || null;
    const stock = getDashboardStock(data);
    const topInvites = await getDashboardInviteRows(data, 5, false);

    return {
      bot: {
        tag: client.user ? client.user.tag : 'starting',
        id: client.user?.id || null,
        uptimeSeconds: Math.floor(process.uptime()),
        presence: getDashboardPresence()
      },
      guild: {
        id: GUILD_ID,
        name: guild?.name || 'HugoSMP',
        memberCount: guild?.memberCount || null,
        channelCount: guild?.channels?.cache?.size || 0,
        activeTickets: guild
          ? guild.channels.cache.filter(channel =>
            channel.type === ChannelType.GuildText && channel.parentId === TICKET_CATEGORY_ID
          ).size
          : 0,
        closedTickets: guild
          ? guild.channels.cache.filter(channel =>
            channel.type === ChannelType.GuildText && channel.parentId === CLOSED_TICKET_CATEGORY_ID
          ).size
          : 0
      },
      dms: getDashboardDmStats(data),
      stock: {
        totalItems: stock.length,
        out: stock.filter(item => item.status === 'out').length,
        low: stock.filter(item => item.status === 'low').length,
        items: stock
      },
      invites: {
        totalUsers: Object.keys(data.invites || {}).length,
        totalInvites: Object.values(data.invites || {}).reduce((sum, amount) => sum + Number(amount || 0), 0),
        top: topInvites
      },
      moderation: {
        warnedUsers: Object.keys(data.warnings || {}).filter(userId => (data.warnings[userId] || []).length > 0).length,
        totalWarnings: Object.values(data.warnings || {}).reduce((sum, warnings) => sum + (Array.isArray(warnings) ? warnings.length : 0), 0),
        activeTempbans: Object.keys(data.tempbans || {}).length
      }
    };
  }

  async function sendDashboardDm(userId, content, attachments = []) {
    const cleanContent = cleanDmContent(content);
    const files = normalizeDashboardAttachments(attachments);

    if (!/^\d{17,20}$/.test(String(userId))) {
      const err = new Error('Ungültige Discord User-ID.');
      err.status = 400;
      throw err;
    }

    if (!cleanContent && files.length === 0) {
      const err = new Error('Nachricht darf nicht leer sein.');
      err.status = 400;
      throw err;
    }

    const user = await client.users.fetch(userId).catch(() => null);
    if (!user) {
      const err = new Error('User wurde nicht gefunden.');
      err.status = 404;
      throw err;
    }

    const sent = await user.send({
      content: cleanContent || undefined,
      files
    });

    const saved = addDmThreadMessage({
      user,
      direction: 'out',
      content: cleanContent,
      discordMessageId: sent.id,
      attachments: getMessageAttachments(sent)
    });

    return saved;
  }

  app.get('/dashboard', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(path.join(__dirname, 'dashboard.html'));
  });

  app.get('/api/dashboard/status', (req, res) => {
    res.json({
      success: true,
      configured: Boolean(DASHBOARD_PASSWORD),
      bot: client.user ? client.user.tag : 'starting',
      version: BOT_VERSION
    });
  });

  app.post('/api/dashboard/login', rateLimiter({ max: 8, windowMs: 15 * 60 * 1000, message: 'Zu viele Versuche. Warte 15 Minuten.' }), (req, res) => {
    if (!DASHBOARD_PASSWORD) {
      return res.status(503).json({
        success: false,
        error: 'Setze DASHBOARD_PASSWORD in der .env auf dem Server.'
      });
    }

    if (!safeEqual(String(req.body?.password || ''), DASHBOARD_PASSWORD)) {
      return res.status(401).json({
        success: false,
        error: 'Falsches Passwort.'
      });
    }

    return res.json({ success: true, token: createDashboardToken() });
  });

  app.get('/api/dashboard/overview', requireDashboardAuth, async (req, res) => {
    try {
      res.json({
        success: true,
        overview: await getDashboardOverview()
      });
    } catch (e) {
      console.error('dashboard overview error:', e.message);
      res.status(500).json({
        success: false,
        error: 'Übersicht konnte nicht geladen werden.'
      });
    }
  });

  app.get('/api/dashboard/presence', requireDashboardAuth, (req, res) => {
    res.json({
      success: true,
      presence: getDashboardPresence()
    });
  });

  app.patch('/api/dashboard/presence', requireDashboardAuth, (req, res) => {
    const status = normalizePresenceStatus(req.body?.status);
    const activityType = String(req.body?.activityType || 'Watching').trim();
    const activityName = cleanDmContent(req.body?.activityName || '').slice(0, 128);
    const activityUrl = activityType === 'Streaming'
      ? String(req.body?.activityUrl || '').trim()
      : null;

    if (activityType === 'Streaming' && !/^https?:\/\//i.test(activityUrl || '')) {
      return res.status(400).json({
        success: false,
        error: 'Streaming braucht eine Twitch- oder YouTube-URL.'
      });
    }

    const data = loadData();
    data.presence = {
      status,
      activityType,
      activityName,
      activityUrl
    };
    saveData(data);
    applyConfiguredPresence();

    res.json({
      success: true,
      presence: getDashboardPresence()
    });
  });

  app.get('/api/dashboard/invites', requireDashboardAuth, async (req, res) => {
    try {
      const data = loadData();
      res.json({
        success: true,
        invites: await getDashboardInviteRows(data, 50),
        totals: {
          users: Object.keys(data.invites || {}).length,
          invites: Object.values(data.invites || {}).reduce((sum, amount) => sum + Number(amount || 0), 0)
        }
      });
    } catch (e) {
      console.error('dashboard invites error:', e.message);
      res.status(500).json({
        success: false,
        error: 'Invites konnten nicht geladen werden.'
      });
    }
  });

  app.patch('/api/dashboard/invites/:userId', requireDashboardAuth, async (req, res) => {
    const userId = String(req.params.userId || '').trim();
    const amount = Number(req.body?.amount);

    if (!/^\d{17,20}$/.test(userId) || !Number.isInteger(amount) || amount < 0) {
      return res.status(400).json({
        success: false,
        error: 'User-ID und Invite-Zahl prüfen.'
      });
    }

    setInvites(userId, amount);
    await updateLeaderboard();

    const data = loadData();
    res.json({
      success: true,
      invites: await getDashboardInviteRows(data, 50)
    });
  });

  app.get('/api/dashboard/stock', requireDashboardAuth, (req, res) => {
    res.json({
      success: true,
      stock: getDashboardStock()
    });
  });

  app.post('/api/dashboard/stock', requireDashboardAuth, async (req, res) => {
    const name = cleanShortText(req.body?.name, 80);
    const price = cleanShortText(req.body?.price, 40);
    const amount = Number(req.body?.amount ?? 0);
    const id = normalizeStockItemId(req.body?.id || name);
    const data = loadData();
    const stockItems = getMutableStockItems(data);

    if (!name || !price || !id) {
      return res.status(400).json({
        success: false,
        error: 'Name, Preis und eine gültige ID sind erforderlich.'
      });
    }

    if (!Number.isInteger(amount) || amount < 0) {
      return res.status(400).json({
        success: false,
        error: 'Menge muss eine ganze Zahl ab 0 sein.'
      });
    }

    if (stockItems.some(item => item.id === id)) {
      return res.status(409).json({
        success: false,
        error: `Ein Stock-Item mit der ID ${id} existiert bereits.`
      });
    }

    const normalizedEmoji = normalizeStockEmoji(req.body?.emoji);
    stockItems.push({
      id,
      name,
      emoji: normalizedEmoji.emoji,
      emojiId: normalizedEmoji.emojiId,
      price
    });
    data.stock[id] = amount;

    saveData(data);
    await updateStockPanel();
    await notifyRestock(stockItems[stockItems.length - 1], 0, amount);

    res.status(201).json({
      success: true,
      stock: getDashboardStock(loadData())
    });
  });

  app.patch('/api/dashboard/stock/:itemId', requireDashboardAuth, async (req, res) => {
    const itemId = String(req.params.itemId || '').trim();
    const amount = Number(req.body?.amount);
    const data = loadData();
    const stockItems = getMutableStockItems(data);
    const item = stockItems.find(stockItem => stockItem.id === itemId);

    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Stock-Item nicht gefunden.'
      });
    }

    if (!Number.isInteger(amount) || amount < 0) {
      return res.status(400).json({
        success: false,
        error: 'Menge muss eine ganze Zahl ab 0 sein.'
      });
    }

    const oldAmount = Number(data.stock?.[itemId] || 0);
    data.stock[itemId] = amount;

    if (typeof req.body?.name === 'string' && req.body.name.trim()) item.name = req.body.name.trim().slice(0, 80);
    if (typeof req.body?.price === 'string' && req.body.price.trim()) item.price = req.body.price.trim().slice(0, 40);
    if (typeof req.body?.emoji === 'string') {
      const normalizedEmoji = normalizeStockEmoji(req.body.emoji);
      item.emoji = normalizedEmoji.emoji;
      item.emojiId = normalizedEmoji.emojiId;
    }

    saveData(data);
    await updateStockPanel();
    await notifyRestock(item, oldAmount, amount);

    res.json({
      success: true,
      stock: getDashboardStock(loadData())
    });
  });

  app.delete('/api/dashboard/stock/:itemId', requireDashboardAuth, async (req, res) => {
    const itemId = String(req.params.itemId || '').trim();
    const data = loadData();
    const stockItems = getMutableStockItems(data);
    const index = stockItems.findIndex(stockItem => stockItem.id === itemId);

    if (index === -1) {
      return res.status(404).json({
        success: false,
        error: 'Stock-Item nicht gefunden.'
      });
    }

    stockItems.splice(index, 1);
    delete data.stock[itemId];

    saveData(data);
    await updateStockPanel();

    res.json({
      success: true,
      stock: getDashboardStock(loadData())
    });
  });

  app.get('/api/dashboard/channels', requireDashboardAuth, async (req, res) => {
    try {
      res.json({
        success: true,
        channels: await getDashboardTextChannels()
      });
    } catch (e) {
      console.error('dashboard channels error:', e.message);
      res.status(500).json({
        success: false,
        error: 'Channels konnten nicht geladen werden.'
      });
    }
  });

  app.get('/api/dashboard/staff', requireDashboardAuth, async (req, res) => {
    try {
      res.json({
        success: true,
        staff: await getDashboardStaffMembers()
      });
    } catch (e) {
      console.error('dashboard staff error:', e.message);
      res.status(500).json({
        success: false,
        error: 'Staff konnte nicht geladen werden.'
      });
    }
  });

  app.get('/api/dashboard/shop', requireDashboardAuth, async (req, res) => {
    try {
      const data = loadData();

      res.json({
        success: true,
        stock: getDashboardStock(data),
        channels: await getDashboardTextChannels(),
        latestOffer: getLatestShopOffer(data),
        defaultChannelId: data.publicStockChannelId || SHOP_PANEL_CHANNEL_ID
      });
    } catch (e) {
      console.error('dashboard shop error:', e.message);
      res.status(500).json({
        success: false,
        error: 'Shop-Daten konnten nicht geladen werden.'
      });
    }
  });

  app.post('/api/dashboard/shop/panel', requireDashboardAuth, async (req, res) => {
    try {
      const channel = await resolveDashboardTextChannel(req.body?.channelId || SHOP_PANEL_CHANNEL_ID);
      const data = loadData();
      const embed = buildShopPanelEmbed({
        title: req.body?.title,
        description: req.body?.description,
        itemIds: req.body?.itemIds,
        includeSale: Boolean(req.body?.includeSale)
      }, data);

      const msg = await channel.send({
        embeds: [embed],
        components: [buildOrderStartRow()]
      });

      data.dashboardShop = data.dashboardShop || {};
      data.dashboardShop.lastPanel = {
        channelId: channel.id,
        messageId: msg.id,
        title: cleanShortText(req.body?.title || 'HugoSMP Shop', 120),
        postedAt: Date.now()
      };
      saveData(data);

      res.json({
        success: true,
        messageUrl: `https://discord.com/channels/${channel.guild.id}/${channel.id}/${msg.id}`
      });
    } catch (e) {
      console.error('dashboard shop panel error:', e.message);
      res.status(e.status || 500).json({
        success: false,
        error: e.status ? e.message : 'Shop-Panel konnte nicht gepostet werden.'
      });
    }
  });

  app.post('/api/dashboard/shop/sale', requireDashboardAuth, async (req, res) => {
    try {
      const channel = await resolveDashboardTextChannel(req.body?.channelId || SHOP_PANEL_CHANNEL_ID);
      const data = loadData();
      const item = (data.stockItems || STOCK_ITEMS).find(stockItem => stockItem.id === String(req.body?.itemId || ''));
      const offer = {
        id: `${Date.now()}`,
        title: cleanShortText(req.body?.title || (item ? `${item.name} Angebot` : 'Neues Angebot'), 120),
        itemId: item?.id || null,
        itemName: item?.name || cleanShortText(req.body?.itemName || '', 80),
        discount: cleanShortText(req.body?.discount || 'Rabatt', 80),
        description: cleanLongText(req.body?.description || '', 900),
        until: cleanShortText(req.body?.until || '', 80),
        channelId: channel.id,
        postedAt: Date.now()
      };

      const msg = await channel.send({
        content: req.body?.mentionDeals && PING_ROLES.deals ? `<@&${PING_ROLES.deals}>` : undefined,
        embeds: [buildSaleEmbed(offer)],
        components: [buildOrderStartRow()]
      });

      data.shopOffers = Array.isArray(data.shopOffers) ? data.shopOffers : [];
      data.shopOffers.unshift({
        ...offer,
        messageId: msg.id,
        messageUrl: `https://discord.com/channels/${channel.guild.id}/${channel.id}/${msg.id}`
      });
      data.shopOffers = data.shopOffers.slice(0, 30);
      saveData(data);

      res.json({
        success: true,
        offer: data.shopOffers[0]
      });
    } catch (e) {
      console.error('dashboard sale error:', e.message);
      res.status(e.status || 500).json({
        success: false,
        error: e.status ? e.message : 'Angebot konnte nicht gepostet werden.'
      });
    }
  });

  app.get('/api/dashboard/tickets', requireDashboardAuth, async (req, res) => {
    try {
      const state = String(req.query.state || 'open').trim().toLowerCase();
      const type = String(req.query.type || 'all').trim().toLowerCase();

      res.json({
        success: true,
        tickets: await getDashboardTicketList({ state, type })
      });
    } catch (e) {
      console.error('dashboard tickets error:', e.message);
      res.status(500).json({
        success: false,
        error: 'Tickets konnten nicht geladen werden.'
      });
    }
  });

  app.get('/api/dashboard/tickets/:channelId', requireDashboardAuth, async (req, res) => {
    try {
      res.json({
        success: true,
        ...(await getDashboardTicketDetails(String(req.params.channelId || '').trim()))
      });
    } catch (e) {
      res.status(e.status || 500).json({
        success: false,
        error: e.status ? e.message : 'Ticket konnte nicht geladen werden.'
      });
    }
  });

  app.post('/api/dashboard/tickets/:channelId/message', requireDashboardAuth, async (req, res) => {
    try {
      const channel = getDashboardChannel(String(req.params.channelId || '').trim());
      if (!channel) throw makeDashboardError('Ticket nicht gefunden.', 404);

      const content = cleanDmContent(req.body?.content);
      if (!content) throw makeDashboardError('Nachricht darf nicht leer sein.');

      await channel.send({ content });

      res.json({
        success: true,
        ...(await getDashboardTicketDetails(channel.id))
      });
    } catch (e) {
      res.status(e.status || 500).json({
        success: false,
        error: e.status ? e.message : 'Nachricht konnte nicht gesendet werden.'
      });
    }
  });

  app.patch('/api/dashboard/tickets/:channelId/meta', requireDashboardAuth, (req, res) => {
    const channelId = String(req.params.channelId || '').trim();
    const channel = getDashboardChannel(channelId);
    if (!channel) {
      return res.status(404).json({
        success: false,
        error: 'Ticket nicht gefunden.'
      });
    }

    const data = loadData();
    data.dashboardTicketMeta = data.dashboardTicketMeta || {};
    data.dashboardTicketMeta[channelId] = {
      ...getTicketDashboardMeta(data, channelId),
      note: typeof req.body?.note === 'string'
        ? req.body.note.trim().slice(0, 500)
        : getTicketDashboardMeta(data, channelId).note || '',
      pinned: typeof req.body?.pinned === 'boolean'
        ? req.body.pinned
        : Boolean(getTicketDashboardMeta(data, channelId).pinned),
      updatedAt: Date.now()
    };
    saveData(data);

    res.json({
      success: true,
      meta: data.dashboardTicketMeta[channelId]
    });
  });

  app.post('/api/dashboard/tickets/:channelId/close', requireDashboardAuth, async (req, res) => {
    try {
      const channel = getDashboardChannel(String(req.params.channelId || '').trim());
      if (!channel) throw makeDashboardError('Ticket nicht gefunden.', 404);

      await closeTicket(channel, client.user, cleanDmContent(req.body?.reason) || 'Per Dashboard geschlossen');

      res.json({
        success: true,
        ticket: await serializeDashboardTicket(channel, loadData())
      });
    } catch (e) {
      res.status(e.status || 500).json({
        success: false,
        error: e.status ? e.message : 'Ticket konnte nicht geschlossen werden.'
      });
    }
  });

  app.post('/api/dashboard/tickets/:channelId/reopen', requireDashboardAuth, async (req, res) => {
    try {
      const channel = getDashboardChannel(String(req.params.channelId || '').trim());
      if (!channel) throw makeDashboardError('Ticket nicht gefunden.', 404);

      await reopenTicket(channel, client.user);

      res.json({
        success: true,
        ticket: await serializeDashboardTicket(channel, loadData())
      });
    } catch (e) {
      res.status(e.status || 500).json({
        success: false,
        error: e.status ? e.message : 'Ticket konnte nicht wieder geöffnet werden.'
      });
    }
  });

  app.get('/api/dashboard/tickets/:channelId/transcript', requireDashboardAuth, async (req, res) => {
    const channel = getDashboardChannel(String(req.params.channelId || '').trim());
    if (!channel) {
      return res.status(404).json({
        success: false,
        error: 'Ticket nicht gefunden.'
      });
    }

    res.json({
      success: true,
      fileName: `${channel.name}-transcript.txt`,
      transcript: await buildTranscript(channel)
    });
  });

  app.get('/api/dashboard/orders', requireDashboardAuth, async (req, res) => {
    try {
      const status = String(req.query.status || 'active').trim().toLowerCase();
      res.json({
        success: true,
        orders: await getDashboardOrderList({ status })
      });
    } catch (e) {
      console.error('dashboard orders error:', e.message);
      res.status(500).json({
        success: false,
        error: 'Bestellungen konnten nicht geladen werden.'
      });
    }
  });

  app.get('/api/dashboard/orders/:channelId', requireDashboardAuth, async (req, res) => {
    try {
      res.json({
        success: true,
        ...(await getDashboardOrderDetails(String(req.params.channelId || '').trim()))
      });
    } catch (e) {
      res.status(e.status || 500).json({
        success: false,
        error: e.status ? e.message : 'Bestellung konnte nicht geladen werden.'
      });
    }
  });

  app.patch('/api/dashboard/orders/:channelId', requireDashboardAuth, async (req, res) => {
    try {
      const channelId = String(req.params.channelId || '').trim();
      const channel = getDashboardChannel(channelId);
      if (!channel || getTicketType(channel) !== 'bestellung') {
        throw makeDashboardError('Bestellung nicht gefunden.', 404);
      }

      const allowedStatuses = ['offen', 'bearbeitung', 'bezahlt', 'fertig', 'storniert'];
      const status = String(req.body?.status || '').trim().toLowerCase();
      const patch = {};

      if (allowedStatuses.includes(status)) patch.status = status;
      if (typeof req.body?.note === 'string') patch.note = req.body.note.trim().slice(0, 800);

      updateDashboardOrderMeta(channelId, patch);

      res.json({
        success: true,
        ...(await getDashboardOrderDetails(channelId))
      });
    } catch (e) {
      res.status(e.status || 500).json({
        success: false,
        error: e.status ? e.message : 'Bestellung konnte nicht gespeichert werden.'
      });
    }
  });

  app.post('/api/dashboard/orders/:channelId/assign', requireDashboardAuth, async (req, res) => {
    try {
      const channelId = String(req.params.channelId || '').trim();
      const channel = getDashboardChannel(channelId);
      if (!channel || getTicketType(channel) !== 'bestellung') {
        throw makeDashboardError('Bestellung nicht gefunden.', 404);
      }

      const staffId = String(req.body?.staffId || '').trim();
      const data = loadData();
      const currentMeta = getOrderDashboardMeta(data, channelId);

      if (!staffId) {
        if (currentMeta.assigneeId) {
          updateDashboardOrderMeta(channelId, {
            assigneeId: null,
            assigneeName: null
          });

          await channel.send({ embeds: [notice('Bearbeiter wurde entfernt.', 'neutral')] }).catch(() => {});
        }

        return res.json({
          success: true,
          ...(await getDashboardOrderDetails(channelId))
        });
      }

      const member = await channel.guild.members.fetch(staffId).catch(() => null);
      if (!member || !isStaff(member)) {
        throw makeDashboardError('Dieser User ist kein Staff-Mitglied.', 400);
      }

      const assigneeName = getUserDisplayName(member.user, member.id);
      const changedAssignee = currentMeta.assigneeId !== member.id;

      updateDashboardOrderMeta(channelId, {
        assigneeId: member.id,
        assigneeName,
        status: currentMeta.status === 'offen' ? 'bearbeitung' : currentMeta.status
      });

      if (changedAssignee) {
        await channel.send({
          content: `📌 <@${member.id}> bearbeitet jetzt Bestellung #${getTicketOrderId(channel)}.`,
          allowedMentions: { users: [member.id] }
        }).catch(() => {});
      }

      res.json({
        success: true,
        ...(await getDashboardOrderDetails(channelId))
      });
    } catch (e) {
      res.status(e.status || 500).json({
        success: false,
        error: e.status ? e.message : 'Bestellung konnte nicht zugewiesen werden.'
      });
    }
  });

  app.post('/api/dashboard/orders/:channelId/invoice', requireDashboardAuth, async (req, res) => {
    try {
      const channelId = String(req.params.channelId || '').trim();
      const channel = getDashboardChannel(channelId);
      if (!channel || getTicketType(channel) !== 'bestellung') {
        throw makeDashboardError('Bestellung nicht gefunden.', 404);
      }

      const details = await getDashboardOrderDetails(channelId);
      const invoice = buildInvoiceFromDashboardInput(req.body || {}, {
        ...details.invoice,
        orderId: getTicketOrderId(channel),
        ownerId: getTicketOwnerId(channel)
      });

      await sendOrderInvoice(channel, invoice);

      res.json({
        success: true,
        ...(await getDashboardOrderDetails(channelId))
      });
    } catch (e) {
      res.status(e.status || 500).json({
        success: false,
        error: e.status ? e.message : 'Rechnung konnte nicht gesendet werden.'
      });
    }
  });

  app.post('/api/dashboard/orders/:channelId/complete', requireDashboardAuth, async (req, res) => {
    try {
      const channel = getDashboardChannel(String(req.params.channelId || '').trim());
      if (!channel || getTicketType(channel) !== 'bestellung') {
        throw makeDashboardError('Bestellung nicht gefunden.', 404);
      }

      const ownerId = getTicketOwnerId(channel);
      if (!ownerId) throw makeDashboardError('Ticket hat keinen Owner.', 400);

      await sendOrderReviewRequest(channel, ownerId, getTicketOrderId(channel));

      res.json({
        success: true,
        ...(await getDashboardOrderDetails(channel.id))
      });
    } catch (e) {
      res.status(e.status || 500).json({
        success: false,
        error: e.status ? e.message : 'Bestellung konnte nicht fertig markiert werden.'
      });
    }
  });

  app.get('/api/dashboard/users/:userId', requireDashboardAuth, async (req, res) => {
    const userId = String(req.params.userId || '').trim();

    if (!/^\d{17,20}$/.test(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Ungültige Discord User-ID.'
      });
    }

    res.json({
      success: true,
      userInfo: await getDmUserInfo(userId)
    });
  });

  app.get('/api/dashboard/threads', requireDashboardAuth, (req, res) => {
    const data = loadData();
    const search = String(req.query.search || '').trim().toLowerCase();
    const filter = String(req.query.filter || 'active').trim().toLowerCase();

    const threads = Object.values(data.dmThreads || {})
      .map(thread => serializeDmThread(thread))
      .filter(thread => {
        if (filter === 'archived') return thread.archived;
        if (thread.archived) return false;
        if (filter === 'unread') return thread.unreadCount > 0;
        if (filter === 'answered') return thread.answered;
        return true;
      })
      .filter(thread => {
        if (!search) return true;
        return [
          thread.userId,
          thread.username,
          thread.globalName,
          thread.lastMessage?.content
        ].some(value => String(value || '').toLowerCase().includes(search));
      })
      .sort((a, b) => Number(b.lastMessageAt || 0) - Number(a.lastMessageAt || 0));

    res.json({ success: true, threads });
  });

  app.get('/api/dashboard/threads/:userId', requireDashboardAuth, async (req, res) => {
    const userId = String(req.params.userId || '').trim();
    const data = loadData();
    const thread = data.dmThreads?.[userId];

    if (!thread) {
      return res.status(404).json({
        success: false,
        error: 'Thread nicht gefunden.'
      });
    }

    thread.unreadCount = 0;
    saveData(data);

    const serialized = serializeDmThread(thread, true);
    serialized.userInfo = await getDmUserInfo(userId, data);

    res.json({
      success: true,
      thread: serialized
    });
  });

  app.patch('/api/dashboard/threads/:userId', requireDashboardAuth, async (req, res) => {
    const userId = String(req.params.userId || '').trim();
    const data = loadData();
    const thread = data.dmThreads?.[userId];

    if (!thread) {
      return res.status(404).json({
        success: false,
        error: 'Thread nicht gefunden.'
      });
    }

    if (typeof req.body?.archived === 'boolean') {
      thread.archived = req.body.archived;
      thread.archivedAt = req.body.archived ? Date.now() : null;
    }

    if (req.body?.read === true) {
      thread.unreadCount = 0;
    }

    saveData(data);

    const serialized = serializeDmThread(thread, true);
    serialized.userInfo = await getDmUserInfo(userId, data);

    res.json({
      success: true,
      thread: serialized
    });
  });

  app.delete('/api/dashboard/threads/:userId', requireDashboardAuth, (req, res) => {
    const userId = String(req.params.userId || '').trim();
    const data = loadData();

    if (!data.dmThreads?.[userId]) {
      return res.status(404).json({
        success: false,
        error: 'Thread nicht gefunden.'
      });
    }

    delete data.dmThreads[userId];
    saveData(data);

    res.json({ success: true });
  });

  app.post('/api/dashboard/threads/:userId/messages', requireDashboardAuth, async (req, res) => {
    try {
      const saved = await sendDashboardDm(
        String(req.params.userId || '').trim(),
        req.body?.content,
        req.body?.attachments
      );
      const data = loadData();
      const thread = data.dmThreads?.[String(req.params.userId || '').trim()];
      const serialized = thread ? serializeDmThread(thread, true) : null;
      if (serialized) serialized.userInfo = await getDmUserInfo(thread.userId, data);

      return res.json({
        success: true,
        message: saved?.message || null,
        thread: serialized
      });
    } catch (e) {
      return res.status(e.status || 500).json({
        success: false,
        error: e.status ? e.message : 'DM konnte nicht gesendet werden.'
      });
    }
  });

  app.post('/api/dashboard/dm', requireDashboardAuth, async (req, res) => {
    try {
      const userId = String(req.body?.userId || '').trim();
      await sendDashboardDm(userId, req.body?.content, req.body?.attachments);

      const data = loadData();
      const thread = data.dmThreads?.[userId];
      const serialized = thread ? serializeDmThread(thread, true) : null;
      if (serialized) serialized.userInfo = await getDmUserInfo(userId, data);

      return res.json({
        success: true,
        thread: serialized
      });
    } catch (e) {
      return res.status(e.status || 500).json({
        success: false,
        error: e.status ? e.message : 'DM konnte nicht gesendet werden.'
      });
    }
  });

  app.get('/api/health', (req, res) => {
    res.json({
      success: true,
      bot: client.user ? client.user.tag : 'starting',
      guildId: GUILD_ID
    });
  });

  app.get('/api/stock', (req, res) => {
    try {
      const data = loadData();

      const stock = (data.stockItems || STOCK_ITEMS).map(item => ({
        id: item.id,
        name: item.name,
        emoji: item.emoji,
        emojiId: item.emojiId,
        price: item.price,
        amount: data.stock[item.id] ?? 0
      }));

      return res.json({
        success: true,
        stock
      });
    } catch (e) {
      console.error('api stock error:', e.message);
      return res.status(500).json({
        success: false,
        error: 'Stock konnte nicht geladen werden.'
      });
    }
  });

  app.post('/api/order', rateLimiter({ max: 5, windowMs: 10 * 60 * 1000, message: 'Zu viele Bestellungen in kurzer Zeit. Bitte warte ein paar Minuten.' }), async (req, res) => {
    try {
      const {
        discordId,
        username,
        items,
        total,
        paymentMethod,
        note
      } = req.body;

      if (!discordId || !/^\d{17,20}$/.test(String(discordId))) {
        return res.status(400).json({
          success: false,
          error: 'Bitte gib eine gültige Discord User-ID an.'
        });
      }

      if (!username || String(username).trim().length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Bitte gib deinen Namen an.'
        });
      }

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Der Warenkorb ist leer.'
        });
      }

      const guild = client.guilds.cache.get(GUILD_ID);

      if (!guild) {
        return res.status(500).json({
          success: false,
          error: 'Discord Server wurde nicht gefunden.'
        });
      }

      const cleanName = cleanUsername(username);
      const ticketOrderId = getNextTicketOrderId();
      const ticketName = `order-${ticketOrderId}-${cleanName}`.slice(0, 100);

      const existing = guild.channels.cache.find(c =>
        c.name === ticketName || c.name === `closed-${ticketName}`
      );

      if (existing) {
        return res.status(409).json({
          success: false,
          error: 'Für diese Bestellung existiert bereits ein Ticket.',
          ticketUrl: `https://discord.com/channels/${guild.id}/${existing.id}`
        });
      }

      const ticket = await guild.channels.create({
        name: ticketName,
        type: ChannelType.GuildText,
        parent: TICKET_CATEGORY_ID,
        topic: `owner:${discordId};type:bestellung;order:${ticketOrderId}`,
        permissionOverwrites: [
          { id: guild.id, deny: ['ViewChannel'] },
          { id: discordId, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
          ...STAFF_ROLE_IDS.map(roleId => ({
            id: roleId,
            allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
          })),
          {
            id: client.user.id,
            allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageChannels']
          }
        ]
      });

      const itemLines = items.map(item => {
        const name = String(item.name || 'Unbekanntes Item').slice(0, 80);
        const qty = Number(item.quantity || item.qty || 1);
        const price = String(item.price || 'Unbekannt').slice(0, 40);
        return `• **${name}** × ${qty} · ${price}`;
      }).join('\n');

      const embed = new BrandEmbed()
        .setAuthor({ name: `Website-Bestellung #${ticketOrderId}` })
        .setTitle('Neue Bestellung')
        .addFields(
          { name: 'Kunde', value: `<@${discordId}>\n-# ${String(username).slice(0, 80)}`, inline: true },
          { name: 'Zahlung', value: paymentMethod ? String(paymentMethod).slice(0, 80) : '—', inline: true },
          { name: 'Gesamt', value: `**${total ? String(total).slice(0, 40) : '—'}**`, inline: true },
          { name: 'Produkte', value: (itemLines || '—').slice(0, 1024) },
          ...(note ? [{ name: 'Notiz', value: String(note).slice(0, 500) }] : [])
        )
        .setFooter({ text: 'Über die Website erstellt' })
        .setTimestamp();

      await ticket.send({
        content: `<@${discordId}> <@&${STAFF_ROLE_IDS[0]}> <@&${STAFF_ROLE_IDS[1]}>`,
        embeds: [embed],
        components: [buildOrderTicketButtons()]
      });

      const invoice = buildInvoiceFromOrderInput({
        orderId: ticketOrderId,
        ownerId: discordId,
        username,
        category: 'Website-Bestellung',
        items,
        total,
        payment: paymentMethod,
        note: note || 'Automatisch aus der Website-Bestellung erstellt.'
      });
      updateDashboardOrderMeta(ticket.id, {
        status: 'offen',
        invoice,
        category: 'Website-Bestellung'
      });
      await sendOrderInvoice(ticket, invoice, { automatic: true });

      return res.json({
        success: true,
        ticketId: ticket.id,
        ticketUrl: `https://discord.com/channels/${guild.id}/${ticket.id}`
      });
    } catch (e) {
      console.error('api order error:', e);

      return res.status(500).json({
        success: false,
        error: 'Bestellung konnte nicht erstellt werden.'
      });
    }
  });

  return app;
};
