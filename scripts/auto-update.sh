#!/usr/bin/env bash
# Automatisches Update (wie beim HugoPredict-Bot). Per cron jede Minute gestartet,
# prüft innerhalb der Minute alle 15 Sekunden auf neue Commits in main.
# Bei Änderungen: Pull → Pakete → Tests → Neustart → Gesundheitscheck.
# Schlagen Tests oder der Start fehl, geht der Bot automatisch auf den
# vorherigen Stand zurück. Daten (~/hugosmp-data) werden nie angefasst.
#
# Einrichten (einmalig):
#   crontab -e  →  * * * * * $HOME/HugoSMP-Server-Bot/scripts/auto-update.sh >> $HOME/hugosmp-update.log 2>&1
set -uo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
NAME="${PM2_NAME:-hugosmp-bot}"
PORT="$(grep -E '^PORT=' "$DIR/.env" 2>/dev/null | cut -d= -f2 | tr -d '\r"' )"
PORT="${PORT:-3000}"
cd "$DIR" || exit 1
mkdir -p .deploy

exec 9>"$DIR/.deploy/update.lock"
flock -n 9 || exit 0

DEPLOYED_FILE="$DIR/.deploy/deployed"
[ -f "$DEPLOYED_FILE" ] || git rev-parse HEAD > "$DEPLOYED_FILE"
log() { echo "[$(date -Is)] $*"; }

install_and_test() {
  npm ci --omit=dev --no-audit --no-fund --loglevel=error || return 1
  # Tests starten kurz einen Test-Bot mit Testdaten in /tmp (kein Discord-Login)
  # Bei viel Last auf dem Server einmal wiederholen, bevor das Update verworfen wird
  DISCORD_TOKEN= npm test --silent >/tmp/hugosmp-update-test.log 2>&1 && return 0
  log "Tests beim ersten Versuch fehlgeschlagen – zweiter Versuch"
  DISCORD_TOKEN= npm test --silent >/tmp/hugosmp-update-test.log 2>&1 || { tail -20 /tmp/hugosmp-update-test.log; return 1; }
}

healthy() {
  for _ in $(seq 1 12); do
    sleep 5
    curl -fsS -o /dev/null "http://127.0.0.1:${PORT}/api/health" && return 0
  done
  return 1
}

rollback() {
  local previous="$1"
  log "Zurück auf ${previous:0:7}"
  git reset -q --hard "$previous"
  npm ci --omit=dev --no-audit --no-fund --loglevel=error
  pm2 restart "$NAME" 9>&- >/dev/null
}

update_once() {
  git fetch -q origin main || return 1
  local target previous
  target="$(git rev-parse origin/main)"
  previous="$(cat "$DEPLOYED_FILE")"
  [ "$target" = "$previous" ] && return 0

  log "Update ${previous:0:7} → ${target:0:7}"
  if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    git stash push -q -m "server-aenderungen-$(date +%Y%m%d-%H%M)" || return 1
    log "Lokale Änderungen gesichert (git stash list)"
  fi
  git checkout -q main 2>/dev/null
  git merge -q --ff-only "$target" || { log "Kein Fast-Forward möglich – übersprungen"; echo "$target" > "$DEPLOYED_FILE"; return 1; }

  if ! install_and_test; then
    log "Tests fehlgeschlagen – Update verworfen"
    rollback "$previous"
    echo "$target" > "$DEPLOYED_FILE" # diesen Stand nicht immer wieder versuchen
    return 1
  fi

  pm2 restart "$NAME" 9>&- >/dev/null || { rollback "$previous"; echo "$target" > "$DEPLOYED_FILE"; return 1; }
  if ! healthy; then
    log "Bot antwortet nach dem Neustart nicht – zurück"
    rollback "$previous"
    echo "$target" > "$DEPLOYED_FILE"
    return 1
  fi
  echo "$target" > "$DEPLOYED_FILE"
  log "Läuft auf ${target:0:7}"
}

for i in 1 2 3 4; do
  update_once || true
  [ "$i" -lt 4 ] && sleep 15
done
exit 0
