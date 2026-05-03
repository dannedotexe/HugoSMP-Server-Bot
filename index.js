function buildPanel() {
  const embed = new EmbedBuilder()
    .setTitle('🎁 Invite Rewards')
    .setColor(0x1e1f22)
    .setDescription(
      `Invite your friends to the server to earn rewards!\n\n` +
      `**Goal:** 8 Verified Invites\n` +
      `**Reward:** $1m on HugoSMP\n\n` +
      `Click the buttons below to generate your personal link or check your progress.`
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('gen_invite')
      .setLabel('Generate Invite')
      .setEmoji('🔗')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('check_inv')
      .setLabel('Check Invites')
      .setEmoji('📊')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('claim')
      .setLabel('Claim 1M')
      .setEmoji('💰')
      .setStyle(ButtonStyle.Success)
  );

  return { embeds: [embed], components: [row] };
}
