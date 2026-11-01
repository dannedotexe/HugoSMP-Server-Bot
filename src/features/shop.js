'use strict';

// Shop: Stock, Restock, Stock-Panel
// Aus index.js ausgelagert; gemeinsame Hilfsfunktionen kommen über ctx.

module.exports = function createShop(ctx) {
  const {
    ActionRowBuilder,
    BrandEmbed,
    ModalBuilder,
    STOCK_ITEMS,
    TextInputBuilder,
    TextInputStyle,
    buildStockButtons,
    buildStockEmbed,
    isStaff,
    loadData,
    notifyRestock,
    saveData,
    sendRestockPreview,
    updateStockPanel,
  } = ctx;

  async function command(interaction) {
    if (interaction.commandName === 'setupstock') {
      await interaction.deferReply({ ephemeral: true });

      try {
        const msg = await interaction.channel.send({
          embeds: [buildStockEmbed()]
        });

        const data = loadData();
        data.publicStockMessageId = msg.id;
        data.publicStockChannelId = interaction.channel.id;
        saveData(data);

        return interaction.deleteReply();
      } catch (e) {
        console.error('setupstock error:', e);

        return interaction.editReply({
          content: '❌ Fehler beim Senden des Stock Panels.'
        });
      }
    }

    if (interaction.commandName === 'setupstockpanel') {
      await interaction.deferReply({ ephemeral: true });

      try {
        const rows = buildStockButtons();

        const msg = await interaction.channel.send({
          embeds: [buildStockEmbed()],
          components: rows.slice(0, 5)
        });

        let buttonsMsg = null;

        if (rows.length > 5) {
          buttonsMsg = await interaction.channel.send({
            content: '‎',
            components: rows.slice(5)
          });
        }

        const data = loadData();

        data.stockMessageId = msg.id;
        data.stockButtonsMessageId = buttonsMsg ? buttonsMsg.id : null;
        data.stockChannelId = interaction.channel.id;

        saveData(data);

        return interaction.deleteReply();
      } catch (e) {
        console.error('setupstockpanel error:', e);

        return interaction.editReply({
          content: '❌ Fehler beim Senden des Staff Stock Panels.'
        });
      }
    }

    // ── /preview ───────────────────────────────────────────────────────
    if (interaction.commandName === 'preview') {
      const sub = interaction.options.getSubcommand();
      if (sub === 'restock') return sendRestockPreview(interaction);
    }

    // ── /stock ─────────────────────────────────────────────────────────
    if (interaction.commandName === 'stock') {
      const sub = interaction.options.getSubcommand();
      const data = loadData();
      if (!data.stockItems) data.stockItems = JSON.parse(JSON.stringify(STOCK_ITEMS));

      if (sub === 'listitems') {
        if (data.stockItems.length === 0) {
          return interaction.reply({ content: '📭 Keine Items im Stock-Panel.', ephemeral: true });
        }
        const list = data.stockItems.map((item, i) =>
          `**${i + 1}.** ${item.emoji} **${item.name}** — ${item.price}\n└ ID: \`${item.id}\` | Lager: ${data.stock[item.id] ?? 0}`
        ).join('\n\n');

        return interaction.reply({
          embeds: [new BrandEmbed()
            .setColor('primary')
            .setTitle('Stock-Items')
            .setDescription(list)],
          ephemeral: true
        });
      }

      if (sub === 'additem') {
        const name   = interaction.options.getString('name');
        const preis  = interaction.options.getString('preis');
        const emoji  = interaction.options.getString('emoji');
        const menge  = interaction.options.getInteger('menge') ?? 0;

        // Generate ID from name
        const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').slice(0, 30);

        if (data.stockItems.find(i => i.id === id)) {
          return interaction.reply({ content: `❌ Ein Item mit der ID \`${id}\` existiert bereits! Nutze einen anderen Namen.`, ephemeral: true });
        }

        // Normalize emoji input — support <:Name:ID>, raw ID number, or standard emoji
        let finalEmoji = emoji.trim();
        let emojiId = null;

        const customMatch = finalEmoji.match(/<a?:([^:]+):(\d+)>/);
        const rawIdMatch  = finalEmoji.match(/^(\d{15,20})$/);
        const colonMatch  = finalEmoji.match(/:([^:]+):(\d+)/);

        if (customMatch) {
          emojiId = customMatch[2];
        } else if (rawIdMatch) {
          emojiId = rawIdMatch[1];
          finalEmoji = `<:item:${emojiId}>`;
        } else if (colonMatch) {
          emojiId = colonMatch[2];
          finalEmoji = `<:${colonMatch[1]}:${emojiId}>`;
        }

        const newItem = { id, name, emoji: finalEmoji, emojiId, price: preis };
        data.stockItems.push(newItem);
        data.stock[id] = menge;
        saveData(data);
        await updateStockPanel();
        await notifyRestock(newItem, 0, menge, interaction.channelId);

        return interaction.reply({
          embeds: [new BrandEmbed()
            .setColor('success')
            .setTone('success')
            .setTitle('Item hinzugefügt')
            .addFields(
              { name: 'Name', value: name, inline: true },
              { name: 'Preis', value: preis, inline: true },
              { name: 'Startmenge', value: `${menge}`, inline: true },
              { name: 'ID', value: `\`${id}\``, inline: true },
              { name: 'Emoji', value: emoji, inline: true }
            )],
          ephemeral: true
        });
      }

      if (sub === 'removeitem') {
        const id = interaction.options.getString('id');
        const idx = data.stockItems.findIndex(i => i.id === id);

        if (idx === -1) {
          return interaction.reply({ content: `❌ Kein Item mit ID \`${id}\` gefunden. Nutze \`/stock listitems\` für alle IDs.`, ephemeral: true });
        }

        const removed = data.stockItems.splice(idx, 1)[0];
        delete data.stock[id];
        saveData(data);
        await updateStockPanel();

        return interaction.reply({
          embeds: [new BrandEmbed()
            .setColor('danger')
            .setDescription(`✅ **${removed.name}** wurde aus dem Stock-Panel entfernt.`)],
          ephemeral: true
        });
      }

      if (sub === 'edititem') {
        const id    = interaction.options.getString('id');
        const name  = interaction.options.getString('name');
        const preis = interaction.options.getString('preis');
        const emoji = interaction.options.getString('emoji');

        const item = data.stockItems.find(i => i.id === id);
        if (!item) {
          return interaction.reply({ content: `❌ Kein Item mit ID \`${id}\` gefunden. Nutze \`/stock listitems\` für alle IDs.`, ephemeral: true });
        }

        if (name)  item.name  = name;
        if (preis) item.price = preis;
        if (emoji) {
          item.emoji = emoji;
          const editMatch = emoji.match(/<a?:([^:]+):(\d+)>/);
          const editRaw = emoji.match(/^(\d{15,20})$/);
          if (editMatch) {
            item.emojiId = editMatch[2];
          } else if (editRaw) {
            item.emojiId = editRaw[1];
            item.emoji = `<:item:${item.emojiId}>`;
          }
        }

        saveData(data);
        await updateStockPanel();

        return interaction.reply({
          embeds: [new BrandEmbed()
            .setTone('success')
            .setTitle('Item aktualisiert')
            .addFields(
              { name: 'Name', value: item.name, inline: true },
              { name: 'Preis', value: item.price, inline: true },
              { name: 'Emoji', value: item.emoji, inline: true },
              { name: 'ID', value: `\`${item.id}\``, inline: true }
            )],
          ephemeral: true
        });
      }
    }
  }

  async function button(interaction) {
    if (interaction.customId.startsWith('stock_')) {
      const isStaffMember = isStaff(interaction.member);

      if (!isStaffMember) {
        return interaction.reply({
          content: '❌ Nur Admins können den Bestand bearbeiten!',
          ephemeral: true
        });
      }

      const parts = interaction.customId.split('_');
      const action = parts[1];
      const itemId = parts.slice(2).join('_');

      if (action === 'set') {
        const item = (loadData().stockItems || STOCK_ITEMS).find(i => i.id === itemId);

        if (!item) {
          return interaction.reply({
            content: '❌ Item nicht gefunden.',
            ephemeral: true
          });
        }

        const modal = new ModalBuilder()
          .setCustomId(`stock_modal_${itemId}`)
          .setTitle(item.name + ' - Bestand setzen');

        const input = new TextInputBuilder()
          .setCustomId('amount')
          .setLabel('Neuer Bestand (Zahl eingeben)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('z.B. 50')
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));

        return interaction.showModal(modal);
      }

      await interaction.deferReply({ ephemeral: true });

      const data = loadData();
      const current = data.stock[itemId] ?? 0;

      let delta = 0;

      if (action === 'plus1') delta = 1;
      else if (action === 'plus10') delta = 10;
      else if (action === 'minus1') delta = -1;
      else if (action === 'minus10') delta = -10;

      data.stock[itemId] = Math.max(0, current + delta);

      saveData(data);
      await updateStockPanel();

      const item = (data.stockItems || STOCK_ITEMS).find(i => i.id === itemId);

      if (!item) {
        return interaction.editReply(`✅ Bestand aktualisiert: ${current} → **${data.stock[itemId]}**`);
      }

      await notifyRestock(item, current, data.stock[itemId], interaction.channelId);

      return interaction.editReply(
        `✅ **${item.name}**: ${current} → **${data.stock[itemId]}**`
      );
    }
  }

  async function modal(interaction) {
    if (interaction.customId.startsWith('stock_modal_')) {
      const itemId = interaction.customId.replace('stock_modal_', '');
      const amountStr = interaction.fields.getTextInputValue('amount');
      const amount = parseInt(amountStr);

      if (isNaN(amount) || amount < 0) {
        return interaction.reply({
          content: '❌ Bitte eine gültige Zahl (≥ 0) eingeben!',
          ephemeral: true
        });
      }

      const data = loadData();
      const old = data.stock[itemId] ?? 0;

      data.stock[itemId] = amount;

      saveData(data);
      await updateStockPanel();

      const item = (data.stockItems || STOCK_ITEMS).find(i => i.id === itemId);

      if (!item) {
        return interaction.reply({
          content: '❌ Item nicht gefunden.',
          ephemeral: true
        });
      }

      await notifyRestock(item, old, amount, interaction.channelId);

      return interaction.reply({
        content: `✅ **${item.name}**: ${old} → **${amount}**`,
        ephemeral: true
      });
    }
  }

  return {
    name: 'shop',
    commands: ["stock","preview","setupstock","setupstockpanel"],
    buttons: [/^stock_/],
    modals: [/^stock_modal_/],
    command,
    button,
    modal,
  };
};
