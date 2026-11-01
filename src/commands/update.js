// ── /aktualisieren: Bot aus Discord heraus updaten ────────────────
// Holt den neuesten Stand von GitHub (main), installiert bei Bedarf die
// Pakete neu und beendet den Prozess – pm2 startet den Bot dann neu.

const { execFile } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { BrandEmbed, notice } = require('../theme');

const run = promisify(execFile);
const REPO_DIR = path.join(__dirname, '..', '..');
const BRANCH = 'main';

// pm2/systemd starten den Bot teils mit sehr knappem PATH.
const ENV = {
  ...process.env,
  PATH: [process.env.PATH, '/usr/local/bin', '/usr/bin', '/bin'].filter(Boolean).join(':'),
  GIT_TERMINAL_PROMPT: '0'
};

let running = false;

function definitions() {
  return [
    new SlashCommandBuilder()
      .setName('aktualisieren')
      .setDescription('Holt das neueste Update von GitHub und startet den Bot neu.')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON()
  ];
}

async function sh(cmd, args, timeout = 60_000) {
  const { stdout } = await run(cmd, args, { cwd: REPO_DIR, env: ENV, timeout, maxBuffer: 4 * 1024 * 1024 });
  return stdout.trim();
}

function shortError(e) {
  const text = String(e.stderr || e.message || e).trim().split('\n').filter(Boolean).slice(-3).join('\n');
  return text.slice(0, 900) || 'Unbekannter Fehler';
}

async function handleUpdate(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ embeds: [notice('Dafür brauchst du Administrator-Rechte.', 'danger')], ephemeral: true });
  }
  if (running) {
    return interaction.reply({ embeds: [notice('Ein Update läuft bereits.', 'warning')], ephemeral: true });
  }

  running = true;
  await interaction.deferReply({ ephemeral: true });

  try {
    await sh('git', ['fetch', '--quiet', 'origin', BRANCH]);
    const current = await sh('git', ['rev-parse', '--short', 'HEAD']);
    const latest = await sh('git', ['rev-parse', '--short', `origin/${BRANCH}`]);

    if (current === latest) {
      running = false;
      return interaction.editReply({ embeds: [notice(`Der Bot ist bereits aktuell (\`${current}\`).`, 'success')] });
    }

    const log = await sh('git', ['log', '--format=%s', '--no-merges', '-n', '8', `HEAD..origin/${BRANCH}`]);
    const changedFiles = await sh('git', ['diff', '--name-only', 'HEAD', `origin/${BRANCH}`]);
    const depsChanged = /^package(-lock)?\.json$/m.test(changedFiles);

    await sh('git', ['reset', '--hard', '--quiet', `origin/${BRANCH}`]);
    if (depsChanged) await sh('npm', ['ci', '--omit=dev'], 5 * 60_000);

    const changes = log ? log.split('\n').map(line => `• ${line}`).join('\n') : '—';
    const embed = new BrandEmbed()
      .setTone('success')
      .setTitle('Update installiert')
      .addFields(
        { name: 'Version', value: `\`${current}\` → \`${latest}\``, inline: true },
        { name: 'Pakete', value: depsChanged ? 'neu installiert' : 'unverändert', inline: true },
        { name: 'Änderungen', value: changes.slice(0, 1000) }
      )
      .setFooter({ text: 'Bot startet in wenigen Sekunden neu' });

    await interaction.editReply({ embeds: [embed] });

    console.log(`🔄 Update ${current} → ${latest} über /aktualisieren von ${interaction.user.tag}, Neustart…`);
    setTimeout(() => process.exit(0), 2000);
  } catch (e) {
    running = false;
    console.error('aktualisieren error:', e);
    return interaction.editReply({
      embeds: [notice(`Update fehlgeschlagen:\n\`\`\`\n${shortError(e)}\n\`\`\``, 'danger')]
    });
  }
}

async function handleCommand(interaction) {
  if (interaction.commandName !== 'aktualisieren') return false;
  await handleUpdate(interaction);
  return true;
}

module.exports = { definitions, handleCommand };
