'use strict';

// Automatische Backups der Bot-Daten: einmal pro Tag eine Kopie in
// <Datenordner>/backups/data-JJJJ-MM-TT.json, die letzten 14 bleiben.

const fs = require('fs');
const path = require('path');
const { DATA_FILE } = require('../config');
const { loadData, saveData } = require('../store');

const KEEP = 14;
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(path.dirname(DATA_FILE), 'backups');

function today() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
}

function listBackups() {
  try {
    return fs.readdirSync(BACKUP_DIR)
      .filter(f => /^data-\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .sort()
      .map(name => {
        const stat = fs.statSync(path.join(BACKUP_DIR, name));
        return { name, size: stat.size, createdAt: stat.mtimeMs };
      });
  } catch {
    return [];
  }
}

function runBackup({ force = false } = {}) {
  try {
    if (!fs.existsSync(DATA_FILE)) return null;
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const name = `data-${today()}.json`;
    const target = path.join(BACKUP_DIR, name);
    if (!force && fs.existsSync(target)) return null;

    // Prüfen, dass die Datei lesbar ist – keine kaputte Datei sichern
    JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    fs.copyFileSync(DATA_FILE, target);

    const all = listBackups();
    all.slice(0, Math.max(0, all.length - KEEP)).forEach(old => {
      fs.rmSync(path.join(BACKUP_DIR, old.name), { force: true });
    });

    const data = loadData();
    data.lastBackupAt = Date.now();
    saveData(data);
    console.log(`💾 Backup erstellt: ${name}`);
    return name;
  } catch (e) {
    console.error('backup error:', e.message);
    return null;
  }
}

function startBackups() {
  runBackup();
  const timer = setInterval(() => runBackup(), 60 * 60 * 1000);
  timer.unref?.();
}

module.exports = { runBackup, startBackups, listBackups, BACKUP_DIR, KEEP };
