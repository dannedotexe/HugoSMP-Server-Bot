'use strict';

// Rollen-Panel und Verifizierung (Buttons)
// Aus index.js ausgelagert; gemeinsame Hilfsfunktionen kommen über ctx.

module.exports = function createRoles(ctx) {
  const {
    PING_ROLES,
    VERIFY_ROLE_ID,
  } = ctx;

  async function button(interaction) {
    if (interaction.customId.startsWith('role_')) {
      const roleKey = interaction.customId.replace('role_', '');
      const roleId = PING_ROLES[roleKey];

      if (!roleId) {
        return interaction.reply({
          content: '❌ Rolle nicht gefunden.',
          ephemeral: true
        });
      }

      const member = interaction.member;
      const hasRole = member.roles.cache.has(roleId);

      try {
        if (hasRole) {
          await member.roles.remove(roleId);

          return interaction.reply({
            content: `ℹ️ Rolle entfernt: <@&${roleId}>`,
            ephemeral: true
          });
        }

        await member.roles.add(roleId);

        return interaction.reply({
          content: `✅ Rolle erhalten: <@&${roleId}>`,
          ephemeral: true
        });
      } catch (e) {
        console.error('role button error:', e);

        return interaction.reply({
          content: '❌ Ich konnte die Rolle nicht ändern. Prüfe meine Rollen-Rechte.',
          ephemeral: true
        });
      }
    }

    if (interaction.customId === 'verify_member') {
      try {
        if (interaction.member.roles.cache.has(VERIFY_ROLE_ID)) {
          return interaction.reply({
            content: '✅ Du bist bereits verifiziert.',
            ephemeral: true
          });
        }

        await interaction.member.roles.add(VERIFY_ROLE_ID);

        return interaction.reply({
          content: '✅ Du wurdest erfolgreich verifiziert!',
          ephemeral: true
        });
      } catch (e) {
        console.error('verify_member error:', e);

        return interaction.reply({
          content: '❌ Ich konnte dir die Rolle nicht geben. Prüfe meine Rechte.',
          ephemeral: true
        });
      }
    }
  }

  return {
    name: 'roles',
    buttons: [/^role_/, /^verify_member$/],
    button,
  };
};
