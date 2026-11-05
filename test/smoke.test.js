'use strict';

// Startet den kompletten Bot (ohne gültiges Discord-Token) und prüft, dass
// Website-API und Dashboard-Login funktionieren. Fängt Fehler beim Laden ab.
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

test('Bot startet, Dashboard-Login und öffentliche API funktionieren', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hsb-smoke-'));
  const port = 39000 + Math.floor(Math.random() * 500);
  const child = spawn(process.execPath, ['index.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, DISCORD_TOKEN: 'ungueltig', DASHBOARD_PASSWORD: 'testpasswort', PORT: String(port), HOST: '127.0.0.1', DATA_FILE: path.join(dir, 'data.json'), HSB_SELFTEST: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => child.kill());
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { out += d; });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 300 && !out.includes('Website API läuft'); i++) await new Promise((r) => setTimeout(r, 100));
  assert.match(out, /Website API läuft/, out);

  const post = (p, body, headers = {}) => fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  assert.equal((await fetch(`${base}/api/health`)).status, 200);
  const page = await fetch(`${base}/dashboard`);
  assert.equal(page.status, 200, 'Dashboard-Seite wird ausgeliefert');
  const html = await page.text();
  assert.match(html, /<html/i);
  const version = html.match(/dashboard\.js\?v=([0-9a-f]{10})/);
  assert.ok(version, 'Dashboard-Skript mit Version eingebunden');
  assert.equal((await fetch(`${base}/assets/dashboard.js?v=${version[1]}`)).status, 200);
  assert.equal((await fetch(`${base}/assets/dashboard.css?v=${version[1]}`)).status, 200);
  assert.equal((await fetch(`${base}/assets/dashboard-icon.jpg`)).status, 200, 'Bilder werden ausgeliefert');
  assert.equal((await fetch(`${base}/api/stock`)).status, 200);
  assert.equal((await post('/api/dashboard/login', { password: 'falsch' })).status, 401);
  const { token } = await (await post('/api/dashboard/login', { password: 'testpasswort' })).json();
  assert.match(token, /^\d{13}\./);
  assert.equal((await fetch(`${base}/api/dashboard/stock`, { headers: { authorization: `Bearer ${token}` } })).status, 200);
  assert.equal((await fetch(`${base}/api/dashboard/stock`, { headers: { authorization: 'Bearer testpasswort' } })).status, 401);
  assert.match(out, /SELFTEST features=10 missing=-/, out);
  assert.doesNotMatch(out, /TypeError|ReferenceError|SyntaxError/, out);
});
