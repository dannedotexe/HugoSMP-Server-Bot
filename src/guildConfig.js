// ── Server-Einstellungen ──────────────────────────────────────────
// Einstellungen pro Server, getrennt von den übrigen Bot-Daten.
// Geschrieben wird atomar (temp-Datei + rename), damit ein Absturz
// mitten im Speichern keine halbe, kaputte Datei hinterlässt.

const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  autoRoleIds: [],
  modLogChannelId: null
};

let filePath = null;
let cache = null;

function init(file) {
  filePath = file;
  cache = null;
}

function readAll() {
  if (cache) return cache;
  try {
    cache = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : {};
  } catch (e) {
    console.error('guild config read error:', e.message);
    cache = {};
  }
  return cache;
}

function writeAll(all) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(all, null, 2));
  fs.renameSync(tmp, filePath);
  cache = all;
}

function get(guildId) {
  const stored = readAll()[guildId] || {};
  return { ...DEFAULTS, ...stored, autoRoleIds: [...(stored.autoRoleIds || [])] };
}

function update(guildId, patch) {
  const all = readAll();
  all[guildId] = { ...get(guildId), ...patch };
  writeAll(all);
  return all[guildId];
}

module.exports = { init, get, update };
