/**
 * Storage Service
 * Interface for chrome.storage.local. Manages monitoring settings,
 * tokens, check status, hashes, and grade lists.
 * This is the ONLY module allowed to access chrome.storage.
 */

const DEFAULT_SETTINGS = {
  monitoringEnabled: false,
  monitorTabId: null,
  lastCheck: null,
  lastCheckManual: null,
  lastCheckAuto: null,
  lastHash: null,
  lastGrades: [],
  telegramToken: '',
  telegramChatId: '',
  monitorInterval: 15, // Default to 15 minutes
  lastNotification: null,
  debugMode: false,
  tablesFound: 0,
  selectedTable: 0,
  headers: [],
  rowsParsed: 0,
  rowsIgnored: 0,
  semesterDetected: '',
  parserTime: 0
};

export const storage = {
  /**
   * Initialize default values in storage if they do not exist.
   * @returns {Promise<void>}
   */
  async initializeDefaults() {
    const current = await this.get(Object.keys(DEFAULT_SETTINGS));
    const toUpdate = {};
    
    for (const [key, defaultValue] of Object.entries(DEFAULT_SETTINGS)) {
      if (current[key] === undefined) {
        toUpdate[key] = defaultValue;
      }
    }

    if (Object.keys(toUpdate).length > 0) {
      await this.set(toUpdate);
    }
  },

  /**
   * Get specific keys from storage.
   * @param {string|string[]|null} keys Keys to retrieve, or null for all
   * @returns {Promise<Object>} Stored key-value pairs
   */
  async get(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, resolve);
    });
  },

  /**
   * Set key-value pairs in storage.
   * @param {Object} items Key-value pairs to store
   * @returns {Promise<void>}
   */
  async set(items) {
    return new Promise((resolve) => {
      chrome.storage.local.set(items, resolve);
    });
  },

  /**
   * Clear all stored data and reset to defaults.
   * @returns {Promise<void>}
   */
  async clear() {
    return new Promise((resolve) => {
      chrome.storage.local.clear(async () => {
        await this.initializeDefaults();
        resolve();
      });
    });
  },

  /**
   * Get whether monitoring is enabled.
   * @returns {Promise<boolean>}
   */
  async getMonitoringEnabled() {
    const res = await this.get('monitoringEnabled');
    return res.monitoringEnabled ?? DEFAULT_SETTINGS.monitoringEnabled;
  },

  /**
   * Set whether monitoring is enabled.
   * @param {boolean} enabled
   * @returns {Promise<void>}
   */
  async setMonitoringEnabled(enabled) {
    await this.set({ monitoringEnabled: !!enabled });
  },

  /**
   * Get the ID of the monitoring tab.
   * @returns {Promise<number|null>}
   */
  async getMonitorTabId() {
    const res = await this.get('monitorTabId');
    return res.monitorTabId ?? DEFAULT_SETTINGS.monitorTabId;
  },

  /**
   * Set the ID of the monitoring tab.
   * @param {number|null} tabId
   * @returns {Promise<void>}
   */
  async setMonitorTabId(tabId) {
    await this.set({ monitorTabId: tabId });
  },

  /**
   * Get the timestamp of the last check.
   * @returns {Promise<string|null>} ISO string or null
   */
  async getLastCheck() {
    const res = await this.get('lastCheck');
    return res.lastCheck ?? DEFAULT_SETTINGS.lastCheck;
  },

  /**
   * Set the timestamp of the last check.
   * @param {string|null} lastCheck ISO timestamp string
   * @returns {Promise<void>}
   */
  async setLastCheck(lastCheck) {
    await this.set({ lastCheck });
  },

  /**
   * Get the timestamp of the last manual check.
   * @returns {Promise<string|null>} ISO string or null
   */
  async getLastCheckManual() {
    const res = await this.get('lastCheckManual');
    return res.lastCheckManual ?? DEFAULT_SETTINGS.lastCheckManual;
  },

  /**
   * Set the timestamp of the last manual check.
   * @param {string|null} lastCheckManual ISO timestamp string
   * @returns {Promise<void>}
   */
  async setLastCheckManual(lastCheckManual) {
    await this.set({ lastCheckManual });
  },

  /**
   * Get the timestamp of the last automatic check.
   * @returns {Promise<string|null>} ISO string or null
   */
  async getLastCheckAuto() {
    const res = await this.get('lastCheckAuto');
    return res.lastCheckAuto ?? DEFAULT_SETTINGS.lastCheckAuto;
  },

  /**
   * Set the timestamp of the last automatic check.
   * @param {string|null} lastCheckAuto ISO timestamp string
   * @returns {Promise<void>}
   */
  async setLastCheckAuto(lastCheckAuto) {
    await this.set({ lastCheckAuto });
  },

  /**
   * Get the SHA-256 hash of the last parsed grades.
   * @returns {Promise<string|null>}
   */
  async getLastHash() {
    const res = await this.get('lastHash');
    return res.lastHash ?? DEFAULT_SETTINGS.lastHash;
  },

  /**
   * Set the SHA-256 hash of the last parsed grades.
   * @param {string|null} lastHash
   * @returns {Promise<void>}
   */
  async setLastHash(lastHash) {
    await this.set({ lastHash });
  },

  /**
   * Get the list of last parsed grades.
   * @returns {Promise<Object[]>}
   */
  async getLastGrades() {
    const res = await this.get('lastGrades');
    return res.lastGrades ?? DEFAULT_SETTINGS.lastGrades;
  },

  /**
   * Set the list of last parsed grades.
   * @param {Object[]} lastGrades
   * @returns {Promise<void>}
   */
  async setLastGrades(lastGrades) {
    await this.set({ lastGrades });
  },

  /**
   * Get the Telegram Bot Token.
   * @returns {Promise<string>}
   */
  async getTelegramToken() {
    const res = await this.get('telegramToken');
    return res.telegramToken ?? DEFAULT_SETTINGS.telegramToken;
  },

  /**
   * Set the Telegram Bot Token.
   * @param {string} telegramToken
   * @returns {Promise<void>}
   */
  async setTelegramToken(telegramToken) {
    await this.set({ telegramToken });
  },

  /**
   * Get the Telegram Chat ID.
   * @returns {Promise<string>}
   */
  async getTelegramChatId() {
    const res = await this.get('telegramChatId');
    return res.telegramChatId ?? DEFAULT_SETTINGS.telegramChatId;
  },

  /**
   * Set the Telegram Chat ID.
   * @param {string} telegramChatId
   * @returns {Promise<void>}
   */
  async setTelegramChatId(telegramChatId) {
    await this.set({ telegramChatId });
  },

  /**
   * Get the monitoring check interval in minutes.
   * @returns {Promise<number>}
   */
  async getMonitorInterval() {
    const res = await this.get('monitorInterval');
    return res.monitorInterval ?? DEFAULT_SETTINGS.monitorInterval;
  },

  /**
   * Set the monitoring check interval in minutes.
   * @param {number} monitorInterval
   * @returns {Promise<void>}
   */
  async setMonitorInterval(monitorInterval) {
    await this.set({ monitorInterval });
  },

  /**
   * Get whether debug mode is enabled.
   * @returns {Promise<boolean>}
   */
  async getDebugMode() {
    const res = await this.get('debugMode');
    return res.debugMode ?? DEFAULT_SETTINGS.debugMode;
  },

  /**
   * Set whether debug mode is enabled.
   * @param {boolean} debugMode
   * @returns {Promise<void>}
   */
  async setDebugMode(debugMode) {
    await this.set({ debugMode: !!debugMode });
  },

  /**
   * Store debug parsing metrics.
   * @param {Object} debugInfo
   * @returns {Promise<void>}
   */
  async setDebugInfo(debugInfo) {
    await this.set({
      tablesFound: debugInfo.tablesFound,
      selectedTable: debugInfo.selectedTable,
      headers: debugInfo.headers,
      rowsParsed: debugInfo.rowsParsed,
      rowsIgnored: debugInfo.rowsIgnored,
      semesterDetected: debugInfo.semesterDetected,
      parserTime: debugInfo.parserTime
    });
  },

  /**
   * Get the timestamp of the last notification.
   * @returns {Promise<string|null>} ISO string or null
   */
  async getLastNotification() {
    const res = await this.get('lastNotification');
    return res.lastNotification ?? DEFAULT_SETTINGS.lastNotification;
  },

  /**
   * Set the timestamp of the last notification.
   * @param {string|null} lastNotification ISO timestamp string
   * @returns {Promise<void>}
   */
  async setLastNotification(lastNotification) {
    await this.set({ lastNotification });
  },

  /**
   * Register a callback to listen to storage changes.
   * @param {Function} callback Callback receiving the changes object
   */
  onChanged(callback) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local') {
        callback(changes);
      }
    });
  }
};
