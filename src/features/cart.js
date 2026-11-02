'use strict';

// Bestellen mit Warenkorb:
//   „Jetzt bestellen“ → Item aus dem Lager wählen → Menge → (weitere Items)
//   → Zahlungsart + Ingame-Name → Preis prüfen → „Bestellung absenden“
// Danach entsteht der private Bestell-Kanal mit fertiger Rechnung.

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags
} = require('discord.js');
const { STAFF_ROLE_IDS, TICKET_CATEGORY_ID, STOCK_ITEMS } = require('../config');
const { loadData, saveData, getNextTicketOrderId, markOrderFormSubmitted } = require('../store');
const { parsePriceNumber, formatEuroValue, cleanUsername, cleanShortText } = require('../util');
const { card } = require('../cards');
const { e } = require('../emojis');
const tickets = require('../services/tickets');

const PAYMENTS = {
  paypal: { label: 'PayPal', emoji: '🅿️', surcharge: 0 },
  bitcoin: { label: 'Bitcoin', emoji: '🪙', surcharge: 0 },
  paysafe: { label: 'Paysafecard', emoji: '💳', surcharge: 0.10 }
};

const CART_TTL_MS = 30 * 60 * 1000;
const carts = new Map(); // userId → { items: [{ id, qty }], payment, ingame, at }

function getCart(userId) {
  const now = Date.now();
  let cart = carts.get(userId);
  if (!cart || now - cart.at > CART_TTL_MS) {
    cart = { items: [], payment: null, ingame: loadData().ingameNames?.[userId] || '', at: now };
    carts.set(userId, cart);
  }
  cart.at = now;
  return cart;
}

function stockItems(data = loadData()) {
  return data.stockItems || STOCK_ITEMS;
}

function available(itemId, data = loadData()) {
  return Number(data.stock?.[itemId] || 0);
}

function emojiOption(item) {
  const m = String(item.emoji || '').match(/<(a?):([^:]+):(\d+)>/);
  if (m) return { id: m[3], name: m[2], animated: Boolean(m[1]) };
  return item.emoji && !String(item.emoji).startsWith('<') ? item.emoji : undefined;
}

// Preise und Summe des Warenkorbs
function priceCart(cart, data = loadData()) {
  const lines = cart.items.map(entry => {
    const item = stockItems(data).find(i => i.id === entry.id);
    const unit = parsePriceNumber(item?.price);
    return {
      id: entry.id,
      name: item?.name || entry.id,
      emoji: item?.emoji || '',
      price: item?.price || '',
      qty: entry.qty,
      subtotal: unit === null ? null : Math.round(unit * entry.qty * 100) / 100
    };
  });
  const base = lines.reduce((sum, l) => sum + (l.subtotal || 0), 0);
  const surcharge = cart.payment ? PAYMENTS[cart.payment].surcharge : 0;
  const total = Math.round(base * (1 + surcharge) * 100) / 100;
  return { lines, base, surcharge, total, hasUnknownPrice: lines.some(l => l.subtotal === null) };
}

function isReady(cart) {
  return cart.items.length > 0 && Boolean(cart.payment) && Boolean(cart.ingame);
}

// ── Ansicht des Warenkorbs ──
function buildCartView(userId) {
  const cart = getCart(userId);
  const data = loadData();
  const priced = priceCart(cart, data);

  const itemLines = priced.lines.length
    ? priced.lines.map(l =>
      `${l.emoji || '•'} **${l.name}** × ${l.qty}${l.subtotal !== null ? ` — ${formatEuroValue(l.subtotal)}` : ''}`
    ).join('\n')
    : '-# Noch leer – wähle unten ein Item aus.';

  const totalLine = priced.lines.length
    ? [
      priced.surcharge ? `-# + ${Math.round(priced.surcharge * 100)} % Paysafecard-Gebühr` : null,
      `**Gesamt: ${formatEuroValue(priced.total)}**${priced.hasUnknownPrice ? ' (+ Preis auf Anfrage)' : ''}`
    ].filter(Boolean).join('\n')
    : null;

  const infoLines = [
    `${e('user', '👤')} **Ingame-Name:** ${cart.ingame ? cart.ingame : '*fehlt noch*'}`,
    `${e('card', '💳')} **Zahlung:** ${cart.payment ? PAYMENTS[cart.payment].label : '*wählen*'}`
  ].join('\n');

  const options = stockItems(data)
    .filter(item => available(item.id, data) > 0)
    .slice(0, 25)
    .map(item => ({
      label: item.name.slice(0, 100),
      value: item.id,
      description: `${item.price} · ${available(item.id, data)} verfügbar`.slice(0, 100),
      emoji: emojiOption(item)
    }));

  const rows = [];
  if (options.length) {
    rows.push(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('cart_add')
        .setPlaceholder(cart.items.length ? '➕ Weiteres Item hinzufügen…' : '🛒 Item auswählen…')
        .addOptions(options)
    ));
  }
  rows.push(new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('cart_payment')
      .setPlaceholder('💳 Zahlungsart wählen…')
      .addOptions(Object.entries(PAYMENTS).map(([value, p]) => ({
        label: p.surcharge ? `${p.label} (+${Math.round(p.surcharge * 100)} %)` : p.label,
        value,
        emoji: p.emoji,
        default: cart.payment === value
      })))
  ));
  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('cart_ingame').setLabel(cart.ingame ? 'Ingame-Name ändern' : 'Ingame-Name').setEmoji('👤').setStyle(cart.ingame ? ButtonStyle.Secondary : ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('cart_clear').setLabel('Leeren').setEmoji('🗑️').setStyle(ButtonStyle.Secondary).setDisabled(!cart.items.length),
    new ButtonBuilder().setCustomId('cart_submit').setLabel('Bestellung absenden').setEmoji('✅').setStyle(ButtonStyle.Success).setDisabled(!isReady(cart))
  ));

  return card({
    tone: isReady(cart) ? 'success' : 'primary',
    eyebrow: `${e('cart', '🛒')} Warenkorb`,
    title: 'Deine Bestellung',
    body: options.length ? null : '⚠️ Gerade ist leider alles ausverkauft.',
    blocks: [itemLines, totalLine, infoLines],
    rows,
    footer: isReady(cart) ? 'Alles bereit – jetzt absenden!' : 'Gleiches Item nochmal wählen = Menge ändern',
    timestamp: false
  });
}

function existingOrderTicket(interaction) {
  return interaction.guild?.channels.cache.find(c =>
    c.type === ChannelType.GuildText &&
    c.parentId === TICKET_CATEGORY_ID &&
    tickets.getTicketOwnerId(c) === interaction.user.id &&
    !c.name.startsWith('closed-')
  ) || null;
}

const ephemeralCard = payload => ({ ...payload, flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
const updateCard = payload => ({ components: payload.components });

// ── Bestell-Kanal erstellen ──
async function createOrderTicket(interaction, cart) {
  const data = loadData();
  const priced = priceCart(cart, data);
  const payment = PAYMENTS[cart.payment];
  const ticketOrderId = getNextTicketOrderId();
  const ticketName = `order-${ticketOrderId}-${cleanUsername(interaction.user.username)}`.slice(0, 100);
  const client = interaction.client;

  const ticket = await interaction.guild.channels.create({
    name: ticketName,
    type: ChannelType.GuildText,
    parent: TICKET_CATEGORY_ID,
    topic: `owner:${interaction.user.id};type:bestellung;order:${ticketOrderId}`,
    permissionOverwrites: [
      { id: interaction.guild.id, deny: ['ViewChannel'] },
      { id: interaction.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
      ...STAFF_ROLE_IDS.map(roleId => ({ id: roleId, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] })),
      { id: client.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageChannels'] }
    ]
  });

  const itemsText = priced.lines.map(l =>
    `${l.emoji || '•'} **${l.name}** × ${l.qty}${l.subtotal !== null ? ` — ${formatEuroValue(l.subtotal)}` : ''}`
  ).join('\n');
  const totalText = priced.hasUnknownPrice ? 'Offen' : formatEuroValue(priced.total);
  const info = data.paymentInfo?.[cart.payment];

  // Alles in EINER Karte: Was, wie viel, wie bezahlen – plus Team-Buttons
  await ticket.send(card({
    tone: 'primary',
    eyebrow: `${e('cart', '🛒')} Bestellung #${ticketOrderId}`,
    title: `Gesamt: ${totalText}`,
    body: [
      itemsText,
      `-# ${payment.label}${priced.surcharge ? ` (inkl. ${Math.round(priced.surcharge * 100)} % Gebühr)` : ''} · Ingame: ${cart.ingame}`
    ].join('\n'),
    blocks: [
      `${e('card', '💳')} **Bezahlen:** ${info || 'Das Team schickt dir gleich die Zahlungsdaten.'}`
    ],
    footer: `Bestellung #${ticketOrderId}`,
    rows: [tickets.buildOrderTicketButtons()],
    mention: `<@${interaction.user.id}> ${STAFF_ROLE_IDS.slice(0, 2).map(id => `<@&${id}>`).join(' ')}`,
    allowedMentions: { users: [interaction.user.id], roles: STAFF_ROLE_IDS.slice(0, 2) }
  }));

  markOrderFormSubmitted(ticket.id);

  const invoice = tickets.buildInvoiceFromOrderInput({
    orderId: ticketOrderId,
    ownerId: interaction.user.id,
    username: interaction.user.username,
    category: 'Items & Geld',
    items: priced.lines.map(l => ({ name: l.name, quantity: l.qty, price: l.price })),
    total: totalText,
    payment: payment.label,
    ingame: cart.ingame,
    note: priced.surcharge ? `Inkl. ${Math.round(priced.surcharge * 100)} % ${payment.label}-Gebühr.` : 'Über den Warenkorb bestellt.'
  }, data);
  invoice.fromCart = true;
  invoice.cartItems = priced.lines.map(l => ({ id: l.id, qty: l.qty }));

  // Rechnung nur speichern (Dashboard), nicht nochmal als Nachricht schicken
  tickets.updateDashboardOrderMeta(ticket.id, {
    status: 'offen',
    invoice,
    invoiceSentAt: Date.now(),
    ingame: cart.ingame,
    category: 'Items & Geld'
  });

  return ticket;
}

module.exports = function createCart() {
  // /zahlungsinfo – was Kunden nach der Bestellung zum Bezahlen sehen
  async function command(interaction) {
    if (interaction.commandName !== 'zahlungsinfo') return;
    const method = interaction.options.getString('methode');
    const raw = interaction.options.getString('text');
    const data = loadData();
    data.paymentInfo = data.paymentInfo || {};

    // Ohne Text: Fenster mit großem Textfeld (am Handy viel einfacher)
    if (!raw) {
      const input = new TextInputBuilder()
        .setCustomId('info')
        .setLabel(`Zahlungsdaten für ${PAYMENTS[method].label}`)
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('z. B. paypal.me/DeinName\nBitte „Freunde & Familie“ wählen\n(leer lassen = löschen)')
        .setRequired(false)
        .setMaxLength(1000);
      if (data.paymentInfo[method]) input.setValue(data.paymentInfo[method]);
      return interaction.showModal(
        new ModalBuilder()
          .setCustomId(`cart_payinfo_${method}`)
          .setTitle('Zahlungsinfo')
          .addComponents(new ActionRowBuilder().addComponents(input))
      );
    }

    if (raw.trim() === '-') {
      delete data.paymentInfo[method];
      saveData(data);
      return interaction.reply({ content: `✅ Zahlungsinfo für **${PAYMENTS[method].label}** entfernt.`, ephemeral: true });
    }
    // In Slash-Befehlen gibt es keine Zeilenumbrüche: „ | “ wird zu neuer Zeile
    const text = raw.split(/\s*\|\s*/).join('\n').slice(0, 1000);
    data.paymentInfo[method] = text;
    saveData(data);
    return interaction.reply({
      content: `✅ Gespeichert. So sehen Kunden das bei **${PAYMENTS[method].label}**:\n>>> ${text}`,
      ephemeral: true
    });
  }

  async function start(interaction) {
    const existing = existingOrderTicket(interaction);
    if (existing) {
      return interaction.reply({ content: `❌ Du hast bereits ein offenes Ticket: <#${existing.id}>`, ephemeral: true });
    }
    return interaction.reply(ephemeralCard(buildCartView(interaction.user.id)));
  }

  async function select(interaction) {
    const cart = getCart(interaction.user.id);

    if (interaction.customId === 'cart_payment') {
      cart.payment = PAYMENTS[interaction.values[0]] ? interaction.values[0] : null;
      return interaction.update(updateCard(buildCartView(interaction.user.id)));
    }

    if (interaction.customId === 'cart_add') {
      const itemId = interaction.values[0];
      const item = stockItems().find(i => i.id === itemId);
      if (!item) return interaction.update(updateCard(buildCartView(interaction.user.id)));
      const max = available(itemId);
      const current = cart.items.find(i => i.id === itemId)?.qty;
      const input = new TextInputBuilder()
        .setCustomId('qty')
        .setLabel(`Wie viele? (${max} verfügbar)`.slice(0, 45))
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(/money/i.test(item.name) ? `z. B. 10 = 10× ${item.name}` : `1 bis ${max}`)
        .setRequired(true)
        .setMaxLength(6);
      if (current) input.setValue(String(current));
      return interaction.showModal(
        new ModalBuilder()
          .setCustomId(`cart_qty_${itemId}`)
          .setTitle(`${item.name} · ${item.price}`.slice(0, 45))
          .addComponents(new ActionRowBuilder().addComponents(input))
      );
    }
  }

  async function button(interaction) {
    if (interaction.customId === 'ticket_cat_items_geld') return start(interaction);

    const cart = getCart(interaction.user.id);

    if (interaction.customId === 'cart_clear') {
      cart.items = [];
      return interaction.update(updateCard(buildCartView(interaction.user.id)));
    }

    if (interaction.customId === 'cart_ingame') {
      const input = new TextInputBuilder()
        .setCustomId('ingame')
        .setLabel('Dein Minecraft-Name')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('z. B. Steve123')
        .setRequired(true)
        .setMinLength(3)
        .setMaxLength(16);
      if (cart.ingame) input.setValue(cart.ingame);
      return interaction.showModal(
        new ModalBuilder().setCustomId('cart_ingame_modal').setTitle('Ingame-Name')
          .addComponents(new ActionRowBuilder().addComponents(input))
      );
    }

    if (interaction.customId === 'cart_submit') {
      if (!isReady(cart)) return interaction.update(updateCard(buildCartView(interaction.user.id)));
      const existing = existingOrderTicket(interaction);
      if (existing) {
        return interaction.reply({ content: `❌ Du hast bereits ein offenes Ticket: <#${existing.id}>`, ephemeral: true });
      }
      // Bestand nochmal prüfen (kann sich inzwischen geändert haben)
      const data = loadData();
      const tooMuch = cart.items.find(i => i.qty > available(i.id, data));
      if (tooMuch) {
        const item = stockItems(data).find(i => i.id === tooMuch.id);
        tooMuch.qty = available(tooMuch.id, data);
        cart.items = cart.items.filter(i => i.qty > 0);
        await interaction.update(updateCard(buildCartView(interaction.user.id)));
        return interaction.followUp({ content: `⚠️ Von **${item?.name || tooMuch.id}** ist nicht mehr so viel da – Menge angepasst. Bitte nochmal prüfen.`, ephemeral: true });
      }

      await interaction.deferUpdate();
      try {
        const ticket = await createOrderTicket(interaction, cart);
        const names = loadData();
        names.ingameNames = names.ingameNames || {};
        names.ingameNames[interaction.user.id] = cart.ingame;
        saveData(names);
        carts.delete(interaction.user.id);
        return interaction.editReply(updateCard(card({
          tone: 'success',
          eyebrow: `${e('check', '✅')} Bestellt`,
          title: 'Deine Bestellung ist raus!',
          body: `Hier geht es weiter: <#${ticket.id}>\n-# Den Stand siehst du jederzeit mit /bestellung.`,
          timestamp: false
        })));
      } catch (err) {
        console.error('cart submit error:', err);
        return interaction.followUp({ content: '❌ Bestellung konnte nicht erstellt werden. Bitte versuch es nochmal oder öffne ein Support-Ticket.', ephemeral: true });
      }
    }
  }

  async function modal(interaction) {
    if (interaction.customId.startsWith('cart_payinfo_')) {
      const method = interaction.customId.slice('cart_payinfo_'.length);
      if (!PAYMENTS[method]) return;
      const text = interaction.fields.getTextInputValue('info').trim().slice(0, 1000);
      const data = loadData();
      data.paymentInfo = data.paymentInfo || {};
      if (text) data.paymentInfo[method] = text;
      else delete data.paymentInfo[method];
      saveData(data);
      return interaction.reply({
        content: text
          ? `✅ Gespeichert. So sehen Kunden das bei **${PAYMENTS[method].label}**:\n>>> ${text}`
          : `✅ Zahlungsinfo für **${PAYMENTS[method].label}** entfernt.`,
        ephemeral: true
      });
    }

    const cart = getCart(interaction.user.id);

    if (interaction.customId === 'cart_ingame_modal') {
      const name = cleanShortText(interaction.fields.getTextInputValue('ingame'), 16).trim();
      if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) {
        return interaction.reply({ content: '❌ Ein Minecraft-Name hat 3–16 Zeichen (Buchstaben, Zahlen, _).', ephemeral: true });
      }
      cart.ingame = name;
      return interaction.update(updateCard(buildCartView(interaction.user.id)));
    }

    if (interaction.customId.startsWith('cart_qty_')) {
      const itemId = interaction.customId.slice('cart_qty_'.length);
      const qty = Number.parseInt(String(interaction.fields.getTextInputValue('qty')).replace(/\D/g, ''), 10);
      const max = available(itemId);
      if (!Number.isFinite(qty) || qty < 0) {
        return interaction.reply({ content: '❌ Bitte eine Zahl eingeben.', ephemeral: true });
      }
      if (qty > max) {
        return interaction.reply({ content: `❌ Es sind nur **${max}** verfügbar.`, ephemeral: true });
      }
      cart.items = cart.items.filter(i => i.id !== itemId);
      if (qty > 0) cart.items.push({ id: itemId, qty });
      return interaction.update(updateCard(buildCartView(interaction.user.id)));
    }
  }

  return {
    name: 'cart',
    commands: ['zahlungsinfo'],
    command,
    buttons: [/^ticket_cat_items_geld$/, /^cart_(clear|ingame|submit)$/],
    selects: [/^cart_(add|payment)$/],
    modals: [/^cart_ingame_modal$/, /^cart_qty_/, /^cart_payinfo_/],
    button,
    select,
    modal
  };
};

module.exports.PAYMENTS = PAYMENTS;
module.exports._internals = { getCart, priceCart, buildCartView, carts };
