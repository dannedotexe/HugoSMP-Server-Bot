'use strict';

// Tickets und Bestellungen: öffnen, schließen, Bestellformular, Bewertungen
// Aus index.js ausgelagert; gemeinsame Hilfsfunktionen kommen über ctx.

module.exports = function createTickets(ctx) {
  const {
    ActionRowBuilder,
    BrandEmbed,
    ButtonBuilder,
    ButtonStyle,
    CLOSED_TICKET_CATEGORY_ID,
    ChannelType,
    KUNDEN_ROLE_ID,
    ModalBuilder,
    REVIEWS_CHANNEL_ID,
    STAFF_ROLE_IDS,
    TICKET_CATEGORY_ID,
    TextInputBuilder,
    TextInputStyle,
    buildInvoiceFromOrderInput,
    buildOrderTicketButtons,
    cleanUsername,
    client,
    closeTicket,
    getNextOrderId,
    getNextTicketOrderId,
    getOrderDashboardMeta,
    getTicketOrderId,
    getTicketOwnerId,
    getTicketType,
    getUserDisplayName,
    hasOrderFormSubmitted,
    hasReviewDecision,
    hasReviewedOrder,
    isStaff,
    loadData,
    markOrderFormSubmitted,
    markReviewDecision,
    markReviewedOrder,
    notice,
    reopenTicket,
    sendOrderInvoice,
    updateDashboardOrderMeta,
    addReview,
    GUILD_ID,
  } = ctx;
  const reviewsService = require('../services/reviews');
  const { buildReviewSummaryEmbed, buildReviewCard } = require('../services/reviews');
  const { card } = require('../cards');
  const { e } = require('../emojis');

  // Was wurde bestellt? (aus der Rechnung der Bestellung in diesem Kanal)
  // Was wurde gekauft? 1. Bestellung im Kanal, 2. gemerkter Bestell-Kanal,
  // 3. letzte Bestellung des Kunden – der Kunde muss es nie selbst eintippen
  function orderItemsText(channel, orderId, userId) {
    const data = loadData();
    const fromInvoice = invoice => String(
      invoice?.itemsText || (invoice?.items || []).map(row => `${row.name} x${row.quantity}`).join(', ') || ''
    ).replace(/\s*-\s*[\d.,]+\s*€/g, '').replace(/\n/g, ', ').slice(0, 100);

    const channelIds = [
      channel && !channel.isDMBased?.() ? channel.id : null,
      reviewsService.getReviewRequest(orderId)?.channelId
    ].filter(Boolean);
    for (const id of channelIds) {
      const text = fromInvoice(getOrderDashboardMeta(data, id)?.invoice);
      if (text) return text;
    }
    if (userId) {
      const latest = Object.values(data.dashboardOrderMeta || {})
        .filter(meta => meta?.invoice?.ownerId === userId)
        .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))[0];
      const text = fromInvoice(latest?.invoice);
      if (text) return text;
    }
    return '';
  }

  function orderDoneCard(userId, orderId, row) {
    return card({
      tone: 'success',
      eyebrow: `${e('check', '✅')} Bestellung fertig`,
      title: `Bestellung ${orderId} ist erledigt`,
      body:
        `<@${userId}>, danke für deinen Einkauf! Wie zufrieden bist du?\n` +
        '-# Nach der Bewertung bekommst du automatisch die **Kunden-Rolle**.',
      rows: [row],
      footer: `Bestellung ${orderId}`,
      mention: `<@${userId}>`,
      allowedMentions: { users: [userId] }
    });
  }

  async function command(interaction) {
    if (interaction.commandName === 'bestellung') {
      const { getUserOrders, buildMyOrdersCard } = require('../services/orderStatus');
      return interaction.reply({
        ...buildMyOrdersCard(interaction.user, getUserOrders(interaction.user.id)),
        flags: require('discord.js').MessageFlags.IsComponentsV2 | require('discord.js').MessageFlags.Ephemeral
      });
    }

    if (interaction.commandName === 'bewertungen') {
      return interaction.reply({ embeds: [buildReviewSummaryEmbed(undefined, { latest: 3 })] });
    }

    if (interaction.commandName === 'getorder') {
      const embed = new BrandEmbed()
        .setTitle('So erhältst du deine Bestellung')
        .setDescription('Sobald die Zahlung eingegangen ist:')
        .addFields(
          {
            name: '1 · Menge berechnen',
            value: 'Bestellung ÷ Ancient-Wert = Menge\n-# Beispiel: 5 Mio ÷ 40k = 125 Stück'
          },
          {
            name: '2 · Order ingame erstellen',
            value: 'Menge laut Rechnung, Preis **1 $** pro Stück\n-# Steuern fallen praktisch keine an'
          },
          {
            name: '3 · Fertig',
            value: 'Wir liefern das Ancient in deine Order – damit hast du dein Geld.'
          }
        );

      await interaction.channel.send({
        embeds: [embed]
      });

      return interaction.reply({
        content: '✅ Bestell-Anleitung gesendet!',
        ephemeral: true
      });
    }

    if (interaction.commandName === 'adduser') {
      const user = interaction.options.getUser('user');
      const channel = interaction.channel;

      // Check it's a ticket channel
      const ownerId = getTicketOwnerId(channel);
      if (!ownerId) {
        return interaction.reply({
          content: '❌ Dieser Befehl kann nur in einem Ticket-Channel verwendet werden.',
          ephemeral: true
        });
      }

      try {
        await channel.permissionOverwrites.edit(user.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true
        });

        await channel.send({
          embeds: [notice(`<@${user.id}> wurde von <@${interaction.user.id}> zum Ticket hinzugefügt.`, 'neutral')]
        });

        return interaction.reply({
          content: `✅ <@${user.id}> wurde zum Ticket hinzugefügt!`,
          ephemeral: true
        });
      } catch (e) {
        console.error('adduser error:', e);
        return interaction.reply({
          content: '❌ Fehler beim Hinzufügen des Users. Prüfe die Bot-Rechte.',
          ephemeral: true
        });
      }
    }

    if (interaction.commandName === 'adduser') {
      const user = interaction.options.getUser('user');
      const channel = interaction.channel;
      const ownerId = getTicketOwnerId(channel);

      if (!ownerId) {
        return interaction.reply({
          content: '❌ Dieser Befehl kann nur in einem Ticket-Channel verwendet werden.',
          ephemeral: true
        });
      }

      try {
        await channel.permissionOverwrites.edit(user.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true
        });

        await channel.send({
          embeds: [notice(`<@${user.id}> wurde von <@${interaction.user.id}> zum Ticket hinzugefügt.`, 'neutral')]
        });

        return interaction.reply({
          content: `✅ <@${user.id}> wurde zum Ticket hinzugefügt!`,
          ephemeral: true
        });
      } catch (e) {
        console.error('adduser error:', e);
        return interaction.reply({
          content: '❌ Fehler beim Hinzufügen des Users. Prüfe die Bot-Rechte.',
          ephemeral: true
        });
      }
    }

    if (interaction.commandName === 'close') {
      const targetUser = interaction.options.getUser('user');

      if (targetUser) {
        // Find the ticket channel of that user
        const ticketChannel = interaction.guild.channels.cache.find(c => {
          const owner = getTicketOwnerId(c);
          return owner === targetUser.id && !c.name.startsWith('closed-');
        });

        if (!ticketChannel) {
          return interaction.reply({
            content: `❌ Kein offenes Ticket für <@${targetUser.id}> gefunden.`,
            ephemeral: true
          });
        }

        await interaction.reply({
          content: `ℹ️ Ticket von <@${targetUser.id}> wird geschlossen…`,
          ephemeral: true
        });

        await closeTicket(ticketChannel, interaction.user, `Von ${interaction.user.tag} per /close geschlossen`);
        return;
      }

      // No user specified — close current channel
      const channel = interaction.channel;
      const ownerId = getTicketOwnerId(channel);

      if (!ownerId) {
        return interaction.reply({
          content: '❌ Dieser Befehl kann nur in einem Ticket-Channel verwendet werden (oder gib einen User an).',
          ephemeral: true
        });
      }

      if (channel.parentId === CLOSED_TICKET_CATEGORY_ID || channel.name.startsWith('closed-')) {
        return interaction.reply({
          content: '❌ Dieses Ticket ist bereits geschlossen.',
          ephemeral: true
        });
      }

      await interaction.reply({
        content: 'ℹ️ Ticket wird geschlossen…',
        ephemeral: true
      });

      await closeTicket(channel, interaction.user, `Von ${interaction.user.tag} per /close geschlossen`);
      return;
    }

    if (interaction.commandName === 'fertig') {
      const user = interaction.options.getUser('user');
      const orderId = getNextOrderId();
      if (interaction.channel && getTicketType(interaction.channel) === 'bestellung') {
        updateDashboardOrderMeta(interaction.channel.id, { status: 'fertig', completedAt: Date.now(), reviewOrderId: orderId });
      }
      reviewsService.trackReviewRequest(orderId, user.id, interaction.channel?.id);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`bewerten_${user.id}_${orderId}`)
          .setLabel('Jetzt bewerten')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('⭐')
      );

      // Als eigene Nachricht senden → kein „… verwendet /fertig“ über der Karte
      await interaction.channel.send(orderDoneCard(user.id, orderId, row));
      return interaction.reply({ content: `✅ Bestellung für ${user} als fertig markiert.`, ephemeral: true });
    }
  }

  async function button(interaction) {
    if (interaction.customId === 'create_support_ticket') {
      const cleanName = cleanUsername(interaction.user.username);
      const ticketName = `support-${cleanName}`.slice(0, 100);

      const existing = interaction.guild.channels.cache.find(c =>
        c.name === ticketName &&
        c.type === ChannelType.GuildText &&
        c.parentId === TICKET_CATEGORY_ID &&
        !c.name.startsWith('closed-')
      );

      if (existing) {
        return interaction.reply({
          content: `❌ Du hast bereits ein offenes Support-Ticket: <#${existing.id}>`,
          ephemeral: true
        });
      }

      try {
        const ticket = await interaction.guild.channels.create({
          name: ticketName,
          type: ChannelType.GuildText,
          parent: TICKET_CATEGORY_ID,
          topic: `owner:${interaction.user.id};type:support;order:none`,
          permissionOverwrites: [
            { id: interaction.guild.id, deny: ['ViewChannel'] },
            { id: interaction.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
            ...STAFF_ROLE_IDS.map(roleId => ({ id: roleId, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] })),
            { id: client.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageChannels'] }
          ]
        });

        const ticketButtons = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('close_ticket').setLabel('Ticket schließen').setEmoji('🔒').setStyle(ButtonStyle.Secondary)
        );

        await ticket.send(card({
          tone: 'primary',
          eyebrow: `${e('support', '🎫')} Support`,
          title: 'Wie können wir helfen?',
          body:
            `Hi <@${interaction.user.id}>, danke für deine Anfrage.\n` +
            'Beschreib dein Anliegen so genau wie möglich – das Team meldet sich hier.',
          thumbnail: interaction.user.displayAvatarURL({ size: 128 }),
          rows: [ticketButtons],
          mention: `<@${interaction.user.id}> ${STAFF_ROLE_IDS.slice(0, 2).map(id => `<@&${id}>`).join(' ')}`,
          allowedMentions: { users: [interaction.user.id], roles: STAFF_ROLE_IDS.slice(0, 2) }
        }));

        return interaction.reply({ content: `✅ Support-Ticket erstellt: <#${ticket.id}>`, ephemeral: true });
      } catch (e) {
        console.error('create support ticket error:', e);
        return interaction.reply({ content: '❌ Fehler beim Erstellen des Tickets. Prüfe die Bot-Rechte.', ephemeral: true });
      }
    }

    if (interaction.customId.startsWith('ticket_cat_')) {
      const catMap = {
        'ticket_cat_items_geld': { label: 'Items & Geld', emoji: '💰' }
      };
      const cat = catMap[interaction.customId];
      if (!cat) {
        // Alte Buttons (Schematics/Resource Pack gibt es nicht mehr)
        return interaction.reply({ content: '❌ Diese Kategorie gibt es nicht mehr. Bestell über **Items & Geld**.', ephemeral: true });
      }

      // Check for existing ticket before showing modal
      const existingCheck = interaction.guild.channels.cache.find(c => {
        const owner = getTicketOwnerId(c);
        return owner === interaction.user.id && c.type === ChannelType.GuildText &&
          (c.parentId === TICKET_CATEGORY_ID) && !c.name.startsWith('closed-');
      });
      if (existingCheck) {
        return interaction.reply({ content: `❌ Du hast bereits ein offenes Ticket: <#${existingCheck.id}>`, ephemeral: true });
      }

      // Show category-specific modal BEFORE creating the ticket
      const modal = new ModalBuilder()
        .setCustomId(`pre_order_modal_${interaction.customId}`)
        .setTitle(`Bestellung — ${cat.label}`);

      if (interaction.customId === 'ticket_cat_items_geld') {
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('item').setLabel('Was möchtest du kaufen?')
              .setStyle(TextInputStyle.Short).setPlaceholder('z.B. 1M Money, Elytra, Ancient Debris').setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('amount').setLabel('Menge')
              .setStyle(TextInputStyle.Short).setPlaceholder('z.B. 5 Stück / 10M').setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('ingame').setLabel('Ingame-Name')
              .setStyle(TextInputStyle.Short).setPlaceholder('Dein Minecraft Name').setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('payment').setLabel('Zahlungsmethode')
              .setStyle(TextInputStyle.Short).setPlaceholder('z.B. PayPal, Paysafecard').setRequired(true)
          )
        );
      }

      return interaction.showModal(modal);
    }

    if (interaction.customId === 'order_form') {
      const ownerId = getTicketOwnerId(interaction.channel);

      if (ownerId && interaction.user.id !== ownerId) {
        return interaction.reply({
          content: '❌ Nur der Ticket-Ersteller kann das Bestellformular ausfüllen.',
          ephemeral: true
        });
      }

      if (hasOrderFormSubmitted(interaction.channel.id)) {
        return interaction.reply({
          content: '❌ Das Bestellformular wurde in diesem Ticket bereits abgesendet.',
          ephemeral: true
        });
      }

      const modal = new ModalBuilder()
        .setCustomId('order_form_modal')
        .setTitle('Bestellformular');

      const itemInput = new TextInputBuilder()
        .setCustomId('item')
        .setLabel('Was möchtest du kaufen?')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('z.B. 1M Money, Elytra, Ancient Debris')
        .setRequired(true);

      const amountInput = new TextInputBuilder()
        .setCustomId('amount')
        .setLabel('Menge')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('z.B. 5')
        .setRequired(true);

      const ingameInput = new TextInputBuilder()
        .setCustomId('ingame')
        .setLabel('Ingame-Name')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Dein Minecraft Name')
        .setRequired(true);

      const paymentInput = new TextInputBuilder()
        .setCustomId('payment')
        .setLabel('Zahlungsmethode')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('z.B. PayPal, Paysafecard')
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(itemInput),
        new ActionRowBuilder().addComponents(amountInput),
        new ActionRowBuilder().addComponents(ingameInput),
        new ActionRowBuilder().addComponents(paymentInput)
      );

      return interaction.showModal(modal);
    }

    if (interaction.customId === 'order_assign_self') {
      if (!isStaff(interaction.member)) {
        return interaction.reply({
          content: '❌ Nur Staff kann Bestellungen übernehmen.',
          ephemeral: true
        });
      }

      if (getTicketType(interaction.channel) !== 'bestellung') {
        return interaction.reply({
          content: '❌ Das ist kein Bestell-Ticket.',
          ephemeral: true
        });
      }

      const data = loadData();
      const meta = getOrderDashboardMeta(data, interaction.channel.id);
      updateDashboardOrderMeta(interaction.channel.id, {
        assigneeId: interaction.user.id,
        assigneeName: getUserDisplayName(interaction.user, interaction.user.id),
        status: meta.status === 'offen' ? 'bearbeitung' : meta.status
      });

      return interaction.reply({
        content: `📌 <@${interaction.user.id}> bearbeitet jetzt Bestellung #${getTicketOrderId(interaction.channel)}.`,
        allowedMentions: { users: [interaction.user.id] }
      });
    }

    if (interaction.customId === 'close_ticket') {
      const ownerId = getTicketOwnerId(interaction.channel);

      if (!ownerId) {
        return interaction.reply({
          content: '❌ Ticket-Ersteller konnte nicht gefunden werden.',
          ephemeral: true
        });
      }

      if (!isStaff(interaction.member) && interaction.user.id !== ownerId) {
        return interaction.reply({
          content: '❌ Du darfst dieses Ticket nicht schließen.',
          ephemeral: true
        });
      }

      if (interaction.channel.parentId === CLOSED_TICKET_CATEGORY_ID || interaction.channel.name.startsWith('closed-')) {
        return interaction.reply({
          content: '❌ Dieses Ticket ist bereits geschlossen.',
          ephemeral: true
        });
      }

      if (interaction.user.id === ownerId) {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('confirm_close_ticket')
            .setLabel('Ja, schließen')
            .setEmoji('✅')
            .setStyle(ButtonStyle.Danger),

          new ButtonBuilder()
            .setCustomId('cancel_close_ticket')
            .setLabel('Abbrechen')
            .setEmoji('❌')
            .setStyle(ButtonStyle.Secondary)
        );

        return interaction.reply({
          embeds: [notice('Möchtest du dieses Ticket wirklich schließen?', 'warning')],
          components: [row],
          ephemeral: true
        });
      }

      const stamp = Date.now().toString();
      const requestId = `close_${interaction.channel.id}_${ownerId}_${stamp}`;

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket_close_yes_${ownerId}_${stamp}`)
          .setLabel('Ticket schließen')
          .setEmoji('🔒')
          .setStyle(ButtonStyle.Danger),

        new ButtonBuilder()
          .setCustomId(`ticket_close_no_${ownerId}_${stamp}`)
          .setLabel('Offen lassen')
          .setEmoji('📌')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.reply({
        content: `✅ Anfrage an <@${ownerId}> gesendet.`,
        ephemeral: true
      });

      await interaction.channel.send({
        content:
          `<@${ownerId}> soll dieses Ticket geschlossen werden?\n` +
          `⏳ Wenn du nichts auswählst, wird das Ticket in **5 Minuten** automatisch geschlossen.`,
        components: [row]
      });

      setTimeout(async () => {
        try {
          if (hasReviewDecision(requestId)) return;

          markReviewDecision(requestId);
          await closeTicket(interaction.channel, interaction.user, 'Auto-Close nach Staff-Anfrage');
        } catch (e) {
          console.error('ticket close auto error:', e.message);
        }
      }, 5 * 60 * 1000);

      return;
    }

    if (interaction.customId.startsWith('ticket_close_yes_')) {
      const parts = interaction.customId.split('_');
      const ownerId = parts[3];
      const stamp = parts[4];

      if (interaction.user.id !== ownerId) {
        return interaction.reply({
          content: '❌ Nur der Ticket-Ersteller kann das bestätigen.',
          ephemeral: true
        });
      }

      const requestId = `close_${interaction.channel.id}_${ownerId}_${stamp}`;
      markReviewDecision(requestId);

      await interaction.update({
        content: '',
        embeds: [notice('Ticket wird geschlossen', 'neutral')],
        components: []
      });

      setTimeout(async () => {
        try {
          await closeTicket(interaction.channel, interaction.user, 'Ticket-Ersteller hat Schließen bestätigt');
        } catch (e) {
          console.error('ticket owner close yes error:', e.message);
        }
      }, 2000);

      return;
    }

    if (interaction.customId.startsWith('ticket_close_no_')) {
      const parts = interaction.customId.split('_');
      const ownerId = parts[3];
      const stamp = parts[4];

      if (interaction.user.id !== ownerId) {
        return interaction.reply({
          content: '❌ Nur der Ticket-Ersteller kann das auswählen.',
          ephemeral: true
        });
      }

      const requestId = `close_${interaction.channel.id}_${ownerId}_${stamp}`;
      markReviewDecision(requestId);

      return interaction.update({
        content: '',
        embeds: [notice('Das Ticket bleibt offen.', 'neutral')],
        components: []
      });
    }

    if (interaction.customId === 'cancel_close_ticket') {
      return interaction.update({
        content: '❌ Schließen abgebrochen.',
        components: []
      });
    }

    if (interaction.customId === 'confirm_close_ticket') {
      const ownerId = getTicketOwnerId(interaction.channel);
      const allowed = isStaff(interaction.member) || interaction.user.id === ownerId;

      if (!allowed) {
        return interaction.reply({
          content: '❌ Du darfst dieses Ticket nicht schließen.',
          ephemeral: true
        });
      }

      await interaction.update({
        content: '',
        embeds: [notice('Ticket wird geschlossen', 'neutral')],
        components: []
      });

      setTimeout(async () => {
        try {
          await closeTicket(interaction.channel, interaction.user, 'Manuell geschlossen');
        } catch (e) {
          console.error('confirm close error:', e.message);
        }
      }, 2000);

      return;
    }

    if (interaction.customId === 'reopen_ticket') {
      if (!isStaff(interaction.member)) {
        return interaction.reply({
          content: '❌ Nur Staff kann Tickets wieder öffnen.',
          ephemeral: true
        });
      }

      await interaction.reply({
        content: 'ℹ️ Ticket wird wieder geöffnet…',
        ephemeral: true
      });

      await reopenTicket(interaction.channel, interaction.user);
      return;
    }

    if (interaction.customId.startsWith('review_keep_open_')) {
      const buyerId = interaction.customId.replace('review_keep_open_', '');

      if (interaction.user.id !== buyerId) {
        return interaction.reply({
          content: '❌ Nur der Käufer kann das auswählen.',
          ephemeral: true
        });
      }

      const reviewDecisionId = `${interaction.channel.id}_${interaction.user.id}`;
      markReviewDecision(reviewDecisionId);

      return interaction.update({
        content: '',
        embeds: [notice('Das Ticket bleibt offen.', 'neutral')],
        components: []
      });
    }

    if (interaction.customId.startsWith('review_close_ticket_')) {
      const buyerId = interaction.customId.replace('review_close_ticket_', '');

      if (interaction.user.id !== buyerId) {
        return interaction.reply({
          content: '❌ Nur der Käufer kann das Ticket schließen.',
          ephemeral: true
        });
      }

      const reviewDecisionId = `${interaction.channel.id}_${interaction.user.id}`;
      markReviewDecision(reviewDecisionId);

      await interaction.update({
        content: '',
        embeds: [notice('Ticket wird geschlossen', 'neutral')],
        components: []
      });

      setTimeout(async () => {
        try {
          await closeTicket(interaction.channel, interaction.user, 'Nach Review geschlossen');
        } catch (e) {
          console.error('review close ticket error:', e.message);
        }
      }, 3000);

      return;
    }

    if (interaction.customId.startsWith('bewerten_')) {
      const parts = interaction.customId.split('_');
      const buyerId = parts[1];
      const orderId = parts[2] || 'Unbekannt';

      if (interaction.user.id !== buyerId) {
        return interaction.reply({
          content: '❌ Du darfst nur deine eigene Bestellung bewerten!',
          ephemeral: true
        });
      }

      if (hasReviewedOrder(orderId)) {
        return interaction.reply({
          content: '❌ Diese Bestellung wurde bereits bewertet!',
          ephemeral: true
        });
      }

      // Schritt 1: Sterne antippen (5 Buttons, nur für den Kunden sichtbar)
      const starRow = new ActionRowBuilder().addComponents(
        [1, 2, 3, 4, 5].map(n =>
          new ButtonBuilder()
            .setCustomId(`review_star_${buyerId}_${orderId}_${n}`)
            .setLabel('⭐'.repeat(n))
            .setStyle(n >= 4 ? ButtonStyle.Success : n === 3 ? ButtonStyle.Primary : ButtonStyle.Secondary)
        )
      );
      return interaction.reply({
        content: '**Wie viele Sterne gibst du?**\n-# Danach schreibst du noch kurz, wie es war.',
        components: [starRow],
        ephemeral: true
      });
    }

    // Team antwortet auf eine Bewertung
    if (interaction.customId.startsWith('review_reply_')) {
      if (!interaction.member || !isStaff(interaction.member)) {
        return interaction.reply({ content: '❌ Nur das Team kann auf Bewertungen antworten.', ephemeral: true });
      }
      const orderId = interaction.customId.slice('review_reply_'.length);
      const existing = [...(loadData().reviews || [])].reverse().find(r => String(r.orderId) === orderId);
      const input = new TextInputBuilder()
        .setCustomId('reply')
        .setLabel('Antwort an den Kunden')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('z. B. Danke dir, gerne wieder! 🙏')
        .setRequired(true)
        .setMaxLength(800);
      if (existing?.reply?.text) input.setValue(existing.reply.text);
      return interaction.showModal(
        new ModalBuilder()
          .setCustomId(`review_replymodal_${orderId}`)
          .setTitle('Auf Bewertung antworten')
          .addComponents(new ActionRowBuilder().addComponents(input))
      );
    }

    // Schritt 2: Sterne gewählt → kurzes Textfeld
    if (interaction.customId.startsWith('review_star_')) {
      const [, , buyerId, orderId, starsRaw] = interaction.customId.split('_');
      if (interaction.user.id !== buyerId) {
        return interaction.reply({ content: '❌ Du darfst nur deine eigene Bestellung bewerten!', ephemeral: true });
      }
      if (hasReviewedOrder(orderId)) {
        return interaction.reply({ content: '❌ Diese Bestellung wurde bereits bewertet!', ephemeral: true });
      }

      const stars = Math.max(1, Math.min(5, Number(starsRaw) || 5));
      const modal = new ModalBuilder()
        .setCustomId(`review_modal_${buyerId}_${orderId}_${stars}`)
        .setTitle(`Bewertung: ${'⭐'.repeat(stars)}`);

      const text = new TextInputBuilder()
        .setCustomId('text')
        .setLabel('Wie war deine Bestellung?')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('z. B. Schnell geliefert, alles korrekt!')
        .setRequired(true)
        .setMaxLength(1000);
      modal.addComponents(new ActionRowBuilder().addComponents(text));

      return interaction.showModal(modal);
    }
  }

  async function modal(interaction) {
    if (interaction.customId.startsWith('review_replymodal_')) {
      if (!interaction.member || !isStaff(interaction.member)) {
        return interaction.reply({ content: '❌ Nur das Team kann auf Bewertungen antworten.', ephemeral: true });
      }
      const orderId = interaction.customId.slice('review_replymodal_'.length);
      const review = reviewsService.setReviewReply(orderId, {
        text: interaction.fields.getTextInputValue('reply').trim(),
        by: getUserDisplayName(interaction.user, interaction.user.id),
        at: Date.now()
      });
      if (!review) {
        return interaction.reply({ content: '❌ Diese Bewertung wurde nicht gefunden.', ephemeral: true });
      }
      const payload = buildReviewCard({
        user: { id: review.userId, username: review.username, avatarUrl: review.avatarUrl },
        stars: review.stars,
        text: review.text,
        item: review.item,
        orderId: review.orderId,
        reply: review.reply
      });
      const message = interaction.message ||
        await client.channels.cache.get(review.channelId)?.messages.fetch(review.messageId).catch(() => null);
      if (!message) {
        return interaction.reply({ content: '❌ Die Bewertungs-Nachricht wurde nicht gefunden.', ephemeral: true });
      }
      await message.edit({ components: payload.components, allowedMentions: { parse: [] } });
      return interaction.reply({ content: '✅ Antwort steht jetzt unter der Bewertung.', ephemeral: true });
    }

    if (interaction.customId.startsWith('pre_order_modal_')) {
      const catKey = interaction.customId.replace('pre_order_modal_', '');
      const catMap = {
        'ticket_cat_items_geld': { label: 'Items & Geld', emoji: '💰' }
      };
      const cat = catMap[catKey];
      if (!cat) return;

      const item    = interaction.fields.getTextInputValue('item');
      const amount  = catKey === 'ticket_cat_items_geld' ? interaction.fields.getTextInputValue('amount') : null;
      const ingame  = interaction.fields.getTextInputValue('ingame');
      const payment = interaction.fields.getTextInputValue('payment');

      await interaction.deferReply({ ephemeral: true });

      const cleanName = cleanUsername(interaction.user.username);
      const ticketOrderId = getNextTicketOrderId();
      const ticketName = `order-${ticketOrderId}-${cleanName}`.slice(0, 100);

      try {
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

        // Ticket-Kopf als Karte: Zusammenfassung + Buttons fürs Team
        const facts = [];
        facts.push(['Item', item], ['Menge', amount]);
        facts.push(['Ingame-Name', ingame], ['Zahlung', payment]);

        await ticket.send(card({
          tone: 'primary',
          eyebrow: `Bestellung #${ticketOrderId}`,
          title: `${cat.emoji} ${cat.label}`,
          body:
            `Danke, <@${interaction.user.id}>! Das Team meldet sich gleich bei dir.\n` +
            '-# Weitere Infos kannst du einfach hier in den Chat schreiben.',
          thumbnail: interaction.user.displayAvatarURL({ size: 128 }),
          blocks: [facts.map(([name, value]) => `**${name}:** ${String(value || '—').slice(0, 300)}`).join('\n')],
          footer: `Bestellung #${ticketOrderId}`,
          rows: [buildOrderTicketButtons()],
          mention: `<@${interaction.user.id}> ${STAFF_ROLE_IDS.slice(0, 2).map(id => `<@&${id}>`).join(' ')}`,
          allowedMentions: { users: [interaction.user.id], roles: STAFF_ROLE_IDS.slice(0, 2) }
        }));

        markOrderFormSubmitted(ticket.id);

        const invoice = buildInvoiceFromOrderInput({
          orderId: ticketOrderId,
          ownerId: interaction.user.id,
          username: interaction.user.username,
          category: cat.label,
          item,
          amount,
          payment,
          ingame,
          note: 'Automatisch aus dem Bestellformular erstellt.'
        });
        updateDashboardOrderMeta(ticket.id, {
          status: 'offen',
          invoice,
          ingame,
          category: cat.label
        });
        await sendOrderInvoice(ticket, invoice, { automatic: true });

        return interaction.editReply({ content: `✅ Ticket erstellt: <#${ticket.id}>` });
      } catch (e) {
        console.error('pre_order_modal error:', e);
        return interaction.editReply({ content: '❌ Fehler beim Erstellen des Tickets. Prüfe die Bot-Rechte.' });
      }
    }

    if (interaction.customId === 'order_form_modal') {
      const ownerId = getTicketOwnerId(interaction.channel);

      if (ownerId && interaction.user.id !== ownerId) {
        return interaction.reply({
          content: '❌ Nur der Ticket-Ersteller kann das Bestellformular absenden.',
          ephemeral: true
        });
      }

      if (hasOrderFormSubmitted(interaction.channel.id)) {
        return interaction.reply({
          content: '❌ Das Bestellformular wurde in diesem Ticket bereits abgesendet.',
          ephemeral: true
        });
      }

      const item = interaction.fields.getTextInputValue('item');
      const amount = interaction.fields.getTextInputValue('amount');
      const ingame = interaction.fields.getTextInputValue('ingame');
      const payment = interaction.fields.getTextInputValue('payment');
      const orderId = getTicketOrderId(interaction.channel);

      markOrderFormSubmitted(interaction.channel.id);

      const embed = new BrandEmbed()
        .setTitle(`Neue Bestellung${orderId !== 'none' ? ` #${orderId}` : ''}`)
        .addFields(
          { name: 'Item', value: item, inline: true },
          { name: 'Menge', value: amount, inline: true },
          { name: 'Ingame-Name', value: ingame, inline: true },
          { name: 'Zahlungsmethode', value: payment, inline: true },
          { name: 'Käufer', value: `<@${interaction.user.id}>`, inline: true }
        )
        .setTimestamp();

      await interaction.channel.send({
        embeds: [embed]
      });

      const invoice = buildInvoiceFromOrderInput({
        orderId,
        ownerId: interaction.user.id,
        username: interaction.user.username,
        category: 'Bestellung',
        item,
        amount,
        payment,
        ingame,
        note: 'Automatisch aus dem Bestellformular erstellt.'
      });
      updateDashboardOrderMeta(interaction.channel.id, {
        status: 'offen',
        invoice,
        ingame,
        category: 'Bestellung'
      });
      await sendOrderInvoice(interaction.channel, invoice, { automatic: true });

      return interaction.reply({
        content: '✅ Bestellformular gesendet!',
        ephemeral: true
      });
    }

    if (interaction.customId.startsWith('review_modal_')) {
      const parts = interaction.customId.split('_');
      const buyerId = parts[2];
      const orderId = parts[3] || 'Unbekannt';

      // Neue Bewertungen: Sterne stecken in der ID; alte Formulare hatten ein Feld
      const field = id => { try { return interaction.fields.getTextInputValue(id); } catch { return null; } };
      const starsStr = parts[4] || field('stars');
      const purchasedItem = field('purchased_item') || orderItemsText(interaction.channel, orderId, buyerId) || '—';
      const text = field('text') || '';
      const stars = parseInt(starsStr);

      if (isNaN(stars) || stars < 1 || stars > 5) {
        return interaction.reply({
          content: '❌ Bitte eine Zahl zwischen **1** und **5** eingeben!',
          ephemeral: true
        });
      }

      if (hasReviewedOrder(orderId)) {
        return interaction.reply({
          content: '❌ Diese Bestellung wurde bereits bewertet!',
          ephemeral: true
        });
      }

      // Auch aus der Erinnerungs-DM heraus (dort gibt es keinen Server)
      const guild = interaction.guild || client.guilds.cache.get(GUILD_ID);
      const reviewChannel = guild?.channels.cache.get(REVIEWS_CHANNEL_ID);

      if (!reviewChannel) {
        return interaction.reply({
          content: '❌ Reviews-Channel nicht gefunden!',
          ephemeral: true
        });
      }

      const reviewer = interaction.user;

      const posted = await reviewChannel.send(buildReviewCard({
        user: reviewer,
        stars,
        text,
        item: purchasedItem,
        orderId
      }));

      addReview({
        orderId,
        userId: reviewer.id,
        username: reviewer.username,
        stars,
        item: purchasedItem,
        text
      });
      reviewsService.setReviewMessage(orderId, reviewChannel.id, posted.id, reviewer.displayAvatarURL({ size: 128 }));

      try {
        const member = await guild.members.fetch(reviewer.id);

        if (!member.roles.cache.has(KUNDEN_ROLE_ID)) {
          await member.roles.add(KUNDEN_ROLE_ID);
        }
      } catch (e) {
        console.error('Rolle konnte nicht vergeben werden:', e.message);
      }

      markReviewedOrder(orderId);

      // Aus der DM heraus gibt es kein Ticket zum Schließen
      if (!interaction.guild || getTicketType(interaction.channel) !== 'bestellung') {
        return interaction.reply({
          content: '✅ **Danke für deine Bewertung!** Du hast die **Kunden-Rolle** erhalten.',
          ephemeral: true
        });
      }

      const reviewDecisionId = `${interaction.channel.id}_${reviewer.id}`;

      const reviewCloseRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`review_keep_open_${reviewer.id}`)
          .setLabel('Offen lassen')
          .setEmoji('📌')
          .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
          .setCustomId(`review_close_ticket_${reviewer.id}`)
          .setLabel('Ticket schließen')
          .setEmoji('🔒')
          .setStyle(ButtonStyle.Danger)
      );

      await interaction.reply({
        content:
          '✅ **Danke für deine Bewertung!**\n' +
          'Du hast die **Kunden-Rolle** erhalten.\n\n' +
          'Möchtest du das Ticket schließen oder offen lassen?\n' +
          '⏳ Wenn du nichts auswählst, wird das Ticket in **5 Minuten** automatisch geschlossen.',
        components: [reviewCloseRow],
        ephemeral: true
      });

      setTimeout(async () => {
        try {
          if (hasReviewDecision(reviewDecisionId)) return;

          markReviewDecision(reviewDecisionId);

          await closeTicket(interaction.channel, reviewer, 'Auto-Close nach Review');
        } catch (e) {
          console.error('auto close after review error:', e.message);
        }
      }, 5 * 60 * 1000);

      return;
    }
  }

  return {
    name: 'tickets',
    commands: ["getorder","adduser","close","fertig","bewertungen","bestellung"],
    buttons: [/^create_support_ticket$/, /^ticket_cat_/, /^order_form$/, /^order_assign_self$/, /^close_ticket$/, /^ticket_close_yes_/, /^ticket_close_no_/, /^cancel_close_ticket$/, /^confirm_close_ticket$/, /^reopen_ticket$/, /^review_keep_open_/, /^review_close_ticket_/, /^bewerten_/, /^review_star_/, /^review_reply_/],
    modals: [/^pre_order_modal_/, /^order_form_modal$/, /^review_modal_/, /^review_replymodal_/],
    command,
    button,
    modal,
  };
};
