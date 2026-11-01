'use strict';

// Aus index.js ausgelagert.

const { noticeFromText } = require('./theme');

// Kurze, private Statusmeldungen ("✅ …", "❌ …") automatisch im
// einheitlichen Embed-Stil senden statt als nackten Text.
function styleNotice(options, ephemeral) {
  if (!ephemeral) return options;
  if (typeof options === 'string') {
    const embed = noticeFromText(options);
    return embed ? { content: '', embeds: [embed] } : options;
  }
  if (!options || typeof options !== 'object' || options.embeds?.length) return options;
  const embed = noticeFromText(options.content);
  return embed ? { ...options, content: '', embeds: [embed] } : options;
}

// Discord gibt nur 3 Sekunden für die erste Antwort. Antwortet ein
// Handler nicht rechtzeitig (langsamer Server, viel Arbeit vorab), wird
// die Interaktion nach AUTO_DEFER_MS automatisch bestätigt und spätere
// reply()/update()-Aufrufe werden passend umgeleitet – so erscheint nie
// mehr "Die Anwendung reagiert nicht".
const AUTO_DEFER_MS = 2000;

function decorateInteraction(interaction) {
  if (!interaction.isRepliable()) return;

  const isEphemeral = options =>
    Boolean(options?.ephemeral) || (Number(options?.flags) & 64) === 64;

  const original = {
    reply: interaction.reply.bind(interaction),
    editReply: interaction.editReply.bind(interaction),
    followUp: interaction.followUp.bind(interaction),
    deferReply: interaction.deferReply.bind(interaction),
    deleteReply: interaction.deleteReply.bind(interaction),
    update: interaction.update?.bind(interaction),
    deferUpdate: interaction.deferUpdate?.bind(interaction),
    showModal: interaction.showModal?.bind(interaction)
  };

  let autoDeferred = null;
  const timer = setTimeout(() => {
    if (interaction.replied || interaction.deferred) return;
    // Immer als private "denkt nach"-Antwort – so kann ein späteres
    // editReply nie versehentlich ein Panel überschreiben.
    autoDeferred = original.deferReply({ ephemeral: true })
      .catch(e => console.error('auto defer error:', e.message));
  }, AUTO_DEFER_MS);
  const settle = () => clearTimeout(timer);

  interaction.reply = async options => {
    settle();
    if (!autoDeferred) return original.reply(styleNotice(options, isEphemeral(options)));

    await autoDeferred;
    const styled = styleNotice(options, isEphemeral(options));
    if (isEphemeral(options)) return original.editReply(styled);
    // Platzhalter war privat, Antwort soll öffentlich sein.
    const message = await original.followUp(styled);
    await original.deleteReply().catch(() => {});
    return message;
  };

  interaction.deferReply = async options => {
    settle();
    if (autoDeferred) return autoDeferred;
    return original.deferReply(options);
  };

  interaction.editReply = async options => {
    settle();
    if (autoDeferred) await autoDeferred;
    return original.editReply(styleNotice(options, interaction.ephemeral));
  };

  interaction.followUp = async options => {
    settle();
    if (autoDeferred) await autoDeferred;
    return original.followUp(styleNotice(options, isEphemeral(options)));
  };

  if (original.update) {
    interaction.update = async options => {
      settle();
      if (!autoDeferred) return original.update(options);
      await autoDeferred;
      // Ursprüngliche Nachricht bearbeiten, Platzhalter entfernen.
      try {
        const message = await interaction.message.edit(options);
        await original.deleteReply().catch(() => {});
        return message;
      } catch {
        return original.editReply(options);
      }
    };
  }

  if (original.deferUpdate) {
    interaction.deferUpdate = async options => {
      settle();
      if (autoDeferred) return autoDeferred;
      return original.deferUpdate(options);
    };
  }

  if (original.showModal) {
    interaction.showModal = async (...args) => {
      settle();
      return original.showModal(...args);
    };
  }
}

async function replyWithError(interaction, error) {
  console.error(`interaction error (${interaction.commandName || interaction.customId || interaction.type}):`, error);
  if (!interaction.isRepliable()) return;

  const payload = {
    content: '❌ Da ist etwas schiefgelaufen. Bitte versuche es gleich noch einmal.',
    ephemeral: true
  };

  try {
    if (interaction.deferred && !interaction.replied) await interaction.editReply(payload);
    else if (interaction.replied) await interaction.followUp(payload);
    else await interaction.reply(payload);
  } catch {}
}

module.exports = {
  styleNotice,
  AUTO_DEFER_MS,
  decorateInteraction,
  replyWithError,
};
