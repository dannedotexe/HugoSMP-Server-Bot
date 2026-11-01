'use strict';

// Aus index.js ausgelagert.

const path = require('path');
const fs = require('fs');
const { loadData } = require('../store');
const { ActivityType } = require('discord.js');
const { client } = require('../client');

const PRESENCE_CONFIG_FILE = process.env.PRESENCE_CONFIG_FILE || path.join(__dirname, '..', '..', 'bot-presence.json');

const DEFAULT_PRESENCE_CONFIG = {
  status: 'online',
  activityType: 'Watching',
  activityName: 'HugoSMP Market',
  activityUrl: null
};

function loadPresenceConfig() {
  let config = DEFAULT_PRESENCE_CONFIG;

  try {
    if (fs.existsSync(PRESENCE_CONFIG_FILE)) {
      config = {
        ...config,
        ...JSON.parse(fs.readFileSync(PRESENCE_CONFIG_FILE, 'utf8'))
      };
    }
  } catch (e) {
    console.error('bot-presence.json error:', e.message);
  }

  try {
    const data = loadData();
    if (data.presence && typeof data.presence === 'object') {
      config = {
        ...config,
        ...data.presence
      };
    }
  } catch (e) {
    console.error('presence data error:', e.message);
  }

  return config;
}

function normalizePresenceStatus(status) {
  const value = String(status || 'online').toLowerCase();

  const statuses = {
    online: 'online',
    idle: 'idle',
    abwesend: 'idle',
    dnd: 'dnd',
    busy: 'dnd',
    beschaeftigt: 'dnd',
    beschäftigt: 'dnd',
    offline: 'invisible',
    invisible: 'invisible',
    unsichtbar: 'invisible'
  };

  return statuses[value] || 'online';
}

function getActivityType(type) {
  const value = String(type || 'Watching').toLowerCase();

  const activityTypes = {
    playing: ActivityType.Playing,
    spielt: ActivityType.Playing,
    streaming: ActivityType.Streaming,
    listening: ActivityType.Listening,
    hoert: ActivityType.Listening,
    hört: ActivityType.Listening,
    watching: ActivityType.Watching,
    schaut: ActivityType.Watching,
    competing: ActivityType.Competing
  };

  return activityTypes[value] ?? ActivityType.Watching;
}

function applyConfiguredPresence() {
  const presence = loadPresenceConfig();
  const activities = [];

  if (presence.activityName) {
    const activity = {
      name: presence.activityName,
      type: getActivityType(presence.activityType)
    };

    if (activity.type === ActivityType.Streaming && presence.activityUrl) {
      activity.url = presence.activityUrl;
    }

    activities.push(activity);
  }

  client.user.setPresence({
    status: normalizePresenceStatus(presence.status),
    activities
  });
}

module.exports = {
  PRESENCE_CONFIG_FILE,
  DEFAULT_PRESENCE_CONFIG,
  loadPresenceConfig,
  normalizePresenceStatus,
  getActivityType,
  applyConfiguredPresence,
};
