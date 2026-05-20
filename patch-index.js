const fs = require("fs");

const file = "index.js";
let code = fs.readFileSync(file, "utf8");

function insertBefore(marker, insert, check) {
  if (check && code.includes(check)) return;
  const i = code.indexOf(marker);
  if (i === -1) throw new Error("Marker nicht gefunden: " + marker);
  code = code.slice(0, i) + insert + "\n" + code.slice(i);
}

function insertAfter(marker, insert, check) {
  if (check && code.includes(check)) return;
  const i = code.indexOf(marker);
  if (i === -1) throw new Error("Marker nicht gefunden: " + marker);
  const end = i + marker.length;
  code = code.slice(0, end) + "\n" + insert + code.slice(end);
}

// Import erweitern
if (!code.includes("StringSelectMenuBuilder")) {
  code = code.replace(
    "AttachmentBuilder\n} = require('discord.js');",
    "AttachmentBuilder,\n  StringSelectMenuBuilder\n} = require('discord.js');"
  );
}

// Data erweitern
insertAfter(
  "data.orderFormsSubmitted = data.orderFormsSubmitted || {};",
  "\n      data.giveaways = data.giveaways || {};",
  "data.giveaways = data.giveaways || {};"
);

insertAfter(
  "orderFormsSubmitted: {},",
  "\n    giveaways: {},",
  "giveaways: {},"
);

// Giveaway Command
insertBefore(
  "new SlashCommandBuilder()\n  .setName('website')",
`new SlashCommandBuilder()
      .setName('giveaway')
      .setDescription('Giveaway verwalten')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addSubcommand(sub =>
        sub.setName('start')
          .setDescription('Giveaway starten')
          .addStringOption(opt => opt.setName('preis').setDescription('Preis').setRequired(true))
          .addIntegerOption(opt => opt.setName('gewinner').setDescription('Anzahl Gewinner').setRequired(true).setMinValue(1))
          .addIntegerOption(opt => opt.setName('min_invites').setDescription('Mindest-Invites').setRequired(false).setMinValue(0))
      )
      .addSubcommand(sub =>
        sub.setName('end')
          .setDescription('Giveaway beenden')
          .addStringOption(opt => opt.setName('message_id').setDescription('Giveaway Message ID').setRequired(true))
      )
      .addSubcommand(sub =>
        sub.setName('reroll')
          .setDescription('Gewinner neu ziehen')
          .addStringOption(opt => opt.setName('message_id').setDescription('Giveaway Message ID').setRequired(true))
      )
      .addSubcommand(sub =>
        sub.setName('manualwinner')
          .setDescription('Transparent manuellen Gewinner setzen')
          .addStringOption(opt => opt.setName('message_id').setDescription('Giveaway Message ID').setRequired(true))
          .addUserOption(opt => opt.setName('user').setDescription('Gewinner').setRequired(true))
      )
      .toJSON(),`,
  ".setName('giveaway')"
);

// Giveaway Handler
insertBefore(
  "if (interaction.commandName === 'website')",
`if (interaction.commandName === 'giveaway') {
      const sub = interaction.options.getSubcommand();

      if (sub === 'start') {
        const prize = interaction.options.getString('preis');
        const winnersCount = interaction.options.getInteger('gewinner');
        const minInvites = interaction.options.getInteger('min_invites') || 0;

        const embed = new EmbedBuilder()
          .setColor('#9B30FF')
          .setTitle('🎉 Giveaway')
          .setDescription(
            \`**Preis:** \${prize}\\n\` +
            \`**Gewinner:** \${winnersCount}\\n\` +
            \`**Mindest-Invites:** \${minInvites}\\n\\n\` +
            'Klicke unten auf **Teilnehmen**, um mitzumachen.'
          )
          .setFooter({ text: 'Fairer Zufallsgenerator • HugoSMP Market' })
          .setTimestamp();

        const tempRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('giveaway_join_temp')
            .setLabel('Teilnehmen')
            .setEmoji('🎉')
            .setStyle(ButtonStyle.Success)
        );

        const msg = await interaction.channel.send({ embeds: [embed], components: [tempRow] });

        const data = loadData();
        data.giveaways[msg.id] = {
          prize,
          winnersCount,
          minInvites,
          participants: [],
          ended: false,
          createdBy: interaction.user.id,
          channelId: interaction.channel.id
        };
        saveData(data);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(\`giveaway_join_\${msg.id}\`)
            .setLabel('Teilnehmen')
            .setEmoji('🎉')
            .setStyle(ButtonStyle.Success)
        );

        await msg.edit({ components: [row] });

        return interaction.reply({
          content: \`✅ Giveaway erstellt! Message ID: \\\`\${msg.id}\\\`\`,
          ephemeral: true
        });
      }

      if (sub === 'end' || sub === 'reroll') {
        const messageId = interaction.options.getString('message_id');
        const data = loadData();
        const giveaway = data.giveaways[messageId];

        if (!giveaway) return interaction.reply({ content: '❌ Giveaway nicht gefunden.', ephemeral: true });
        if (!Array.isArray(giveaway.participants) || giveaway.participants.length === 0) {
          return interaction.reply({ content: '❌ Keine Teilnehmer.', ephemeral: true });
        }

        const shuffled = [...giveaway.participants].sort(() => Math.random() - 0.5);
        const winners = shuffled.slice(0, giveaway.winnersCount);

        giveaway.ended = true;
        giveaway.lastWinners = winners;
        data.giveaways[messageId] = giveaway;
        saveData(data);

        return interaction.reply({
          content:
            \`🎉 **Giveaway \${sub === 'reroll' ? 'Reroll' : 'beendet'}!**\\n\` +
            \`**Preis:** \${giveaway.prize}\\n\` +
            \`**Gewinner:** \${winners.map(id => \`<@\${id}>\`).join(', ')}\`
        });
      }

      if (sub === 'manualwinner') {
        const messageId = interaction.options.getString('message_id');
        const user = interaction.options.getUser('user');
        const data = loadData();
        const giveaway = data.giveaways[messageId];

        if (!giveaway) return interaction.reply({ content: '❌ Giveaway nicht gefunden.', ephemeral: true });

        giveaway.ended = true;
        giveaway.lastWinners = [user.id];
        giveaway.manualWinner = true;
        data.giveaways[messageId] = giveaway;
        saveData(data);

        return interaction.reply({
          content:
            '🏆 **Giveaway Gewinner wurde manuell durch Admin ausgewählt**\\n' +
            \`**Preis:** \${giveaway.prize}\\n\` +
            \`**Gewinner:** <@\${user.id}>\`
        });
      }
    }`,
  "interaction.commandName === 'giveaway'"
);

// Giveaway Button
insertAfter(
  "if (interaction.isButton()) {",
`
    if (interaction.customId.startsWith('giveaway_join_')) {
      const messageId = interaction.customId.replace('giveaway_join_', '');
      const data = loadData();
      const giveaway = data.giveaways[messageId];

      if (!giveaway) {
        return interaction.reply({ content: '❌ Giveaway nicht gefunden.', ephemeral: true });
      }

      if (giveaway.ended) {
        return interaction.reply({ content: '❌ Dieses Giveaway ist bereits beendet.', ephemeral: true });
      }

      if ((giveaway.minInvites || 0) > getInvites(interaction.user.id)) {
        return interaction.reply({
          content: \`❌ Du brauchst mindestens **\${giveaway.minInvites} Invites**, um teilzunehmen.\`,
          ephemeral: true
        });
      }

      if (giveaway.participants.includes(interaction.user.id)) {
        return interaction.reply({ content: '❌ Du nimmst bereits teil.', ephemeral: true });
      }

      giveaway.participants.push(interaction.user.id);
      data.giveaways[messageId] = giveaway;
      saveData(data);

      return interaction.reply({
        content: \`✅ Du nimmst am Giveaway teil! Teilnehmer: **\${giveaway.participants.length}**\`,
        ephemeral: true
      });
    }
`,
  "giveaway_join_"
);

// Ticket Auswahl im Setup ersetzen
const oldTicketRow = `const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('create_order_ticket')
          .setLabel('Bestellung')
          .setEmoji('🛒')
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId('create_support_ticket')
          .setLabel('Support')
          .setEmoji('🎫')
          .setStyle(ButtonStyle.Primary)
      );`;

const newTicketRow = `const orderCategoryRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('order_category_select')
          .setPlaceholder('Wähle aus, was du kaufen möchtest')
          .addOptions(
            {
              label: 'Items und Geld',
              description: 'HugoSMP Geld, Items, Spawner usw.',
              value: 'items_geld',
              emoji: '💰'
            },
            {
              label: 'Schematics',
              description: 'Farmen, Basen und andere Schematics',
              value: 'schematics',
              emoji: '🏗️'
            },
            {
              label: 'Resource Pack',
              description: 'Resource Pack Käufe oder Support',
              value: 'resource_pack',
              emoji: '🎨'
            }
          )
      );

      const supportRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('create_support_ticket')
          .setLabel('Support')
          .setEmoji('🎫')
          .setStyle(ButtonStyle.Primary)
      );`;

if (code.includes(oldTicketRow) && !code.includes("order_category_select")) {
  code = code.replace(oldTicketRow, newTicketRow);
  code = code.replace("components: [row]\n      });\n\n      return interaction.reply({\n        content: '✅ Ticket Panel gesendet!',",
                      "components: [orderCategoryRow, supportRow]\n      });\n\n      return interaction.reply({\n        content: '✅ Ticket Panel gesendet!',");
}

// Select Menu Handler
insertBefore(
  "if (interaction.isButton()) {",
`if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'order_category_select') {
      const selected = interaction.values[0];

      const categoryNames = {
        items_geld: 'Items und Geld',
        schematics: 'Schematics',
        resource_pack: 'Resource Pack'
      };

      const categorySlugs = {
        items_geld: 'items',
        schematics: 'schematics',
        resource_pack: 'resourcepack'
      };

      const displayName = categoryNames[selected] || 'Bestellung';
      const slug = categorySlugs[selected] || 'order';

      const cleanName = cleanUsername(interaction.user.username);
      const ticketOrderId = getNextTicketOrderId();
      const ticketName = \`\${slug}-\${ticketOrderId}-\${cleanName}\`.slice(0, 100);

      try {
        const ticket = await interaction.guild.channels.create({
          name: ticketName,
          type: ChannelType.GuildText,
          parent: TICKET_CATEGORY_ID,
          topic: \`owner:\${interaction.user.id};type:bestellung;order:\${ticketOrderId};category:\${selected}\`,
          permissionOverwrites: [
            { id: interaction.guild.id, deny: ['ViewChannel'] },
            { id: interaction.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
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

        const ticketEmbed = new EmbedBuilder()
          .setColor('#b10de7')
          .setTitle(\`🛒 Bestellung #\${ticketOrderId} — \${displayName}\`)
          .setDescription(
            'Willkommen! Bitte klicke unten auf **Bestellformular ausfüllen**.\\n\\n' +
            \`**Kategorie:** \${displayName}\\n\` +
            'Du kannst danach noch weitere Infos in den Chat schreiben.'
          )
          .setTimestamp();

        const ticketButtons = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('order_form')
            .setLabel('Bestellformular ausfüllen')
            .setEmoji('📝')
            .setStyle(ButtonStyle.Primary),

          new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('Ticket schließen')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Danger)
        );

        await ticket.send({
          content: \`<@\${interaction.user.id}> <@&\${STAFF_ROLE_IDS[0]}> <@&\${STAFF_ROLE_IDS[1]}>\`,
          embeds: [ticketEmbed],
          components: [ticketButtons]
        });

        return interaction.reply({
          content: \`✅ \${displayName}-Ticket erstellt: <#\${ticket.id}>\`,
          ephemeral: true
        });
      } catch (e) {
        console.error('create category ticket error:', e);

        return interaction.reply({
          content: '❌ Fehler beim Erstellen des Tickets. Prüfe die Bot-Rechte.',
          ephemeral: true
        });
      }
    }
  }

  `,
  "interaction.isStringSelectMenu()"
);

// Bewertung gekauftes Produkt
if (!code.includes(".setCustomId('bought')")) {
  const boughtBlock = `const bought = new TextInputBuilder()
        .setCustomId('bought')
        .setLabel('Was hast du gekauft?')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('z.B. 10M Money, Elytra, Schematic...')
        .setRequired(true);

      `;
  code = code.replace("const text = new TextInputBuilder()", boughtBlock + "const text = new TextInputBuilder()", 1);

  code = code.replace(
    "modal.addComponents(\n        new ActionRowBuilder().addComponents(stars),\n        new ActionRowBuilder().addComponents(text)\n      );",
    "modal.addComponents(\n        new ActionRowBuilder().addComponents(stars),\n        new ActionRowBuilder().addComponents(bought),\n        new ActionRowBuilder().addComponents(text)\n      );"
  );

  code = code.replace(
    "const text = interaction.fields.getTextInputValue('text');",
    "const bought = interaction.fields.getTextInputValue('bought');\n      const text = interaction.fields.getTextInputValue('text');",
    1
  );

  code = code.replace(
    "`**Bewertet von:** **<@${reviewer.id}>**\\n\\n` +\n          `${starsEmoji} **(${stars}/5)**\\n\\n${text}`",
    "`**Bewertet von:** **<@${reviewer.id}>**\\n` +\n          `**Gekauft:** ${bought}\\n\\n` +\n          `${starsEmoji} **(${stars}/5)**\\n\\n${text}`"
  );
}

fs.writeFileSync(file, code, "utf8");
console.log("✅ Fertig. index.js wurde sicher gepatcht. Nichts wurde gelöscht.");
