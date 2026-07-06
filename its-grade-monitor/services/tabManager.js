/**
 * Tab Manager Service
 * Manages the dedicated monitoring tab, ensuring it is pinned, muted,
 * restored if closed, and does not interfere with the user's active tabs.
 */

import { logger } from '../utils/logger.js';
import { storage } from './storage.js';

const TARGET_URL = 'https://akademik.its.ac.id/data_nilaimhs.php';

export const tabManager = {
  /**
   * Helper to check if a tab exists and is accessible.
   * @param {number} tabId
   * @returns {Promise<boolean>}
   */
  async tabExists(tabId) {
    try {
      const tab = await chrome.tabs.get(tabId);
      return !!tab;
    } catch (e) {
      // chrome.tabs.get throws an error if tab doesn't exist
      return false;
    }
  },

  /**
   * Find an existing tab that matches the target URL.
   * @returns {Promise<chrome.tabs.Tab|null>}
   */
  async findExistingTab() {
    try {
      const tabs = await chrome.tabs.query({ url: TARGET_URL + '*' });
      return tabs.length > 0 ? tabs[0] : null;
    } catch (e) {
      logger.error('Error querying tabs:', e);
      return null;
    }
  },

  /**
   * Configure a tab to be pinned and muted.
   * @param {number} tabId
   * @returns {Promise<void>}
   */
  async configureTab(tabId) {
    try {
      await chrome.tabs.update(tabId, {
        pinned: true,
        muted: true
      });
      logger.info(`Tab ${tabId} successfully pinned and muted.`);
    } catch (e) {
      logger.error(`Failed to configure tab ${tabId}:`, e);
    }
  },

  /**
   * Get the current monitoring tab or create a new one if it doesn't exist.
   * Ensures the tab is pinned, muted, and points to the target URL.
   * @returns {Promise<number>} The ID of the active monitoring tab
   */
  async getOrCreateTab() {
    logger.info('Opening monitoring tab...');
    const storedTabId = await storage.getMonitorTabId();
    
    // 1. Check if the stored tab ID is still valid
    if (storedTabId !== null) {
      const exists = await this.tabExists(storedTabId);
      if (exists) {
        logger.info(`Using existing monitoring tab: ${storedTabId}`);
        await this.configureTab(storedTabId);
        return storedTabId;
      }
    }

    // 2. If not, try to find any open tab with the target URL
    const existingTab = await this.findExistingTab();
    if (existingTab) {
      logger.info(`Found open grade page in tab: ${existingTab.id}. Reusing it.`);
      await storage.setMonitorTabId(existingTab.id);
      await this.configureTab(existingTab.id);
      return existingTab.id;
    }

    // 3. Create a new tab
    try {
      logger.info(`Creating new monitoring tab at ${TARGET_URL}...`);
      const newTab = await chrome.tabs.create({
        url: TARGET_URL,
        pinned: true,
        active: false // Do not steal focus from user
      });
      
      await storage.setMonitorTabId(newTab.id);
      
      // Wait a brief moment or try to update muted state
      await this.configureTab(newTab.id);
      return newTab.id;
    } catch (e) {
      logger.error('Failed to create new monitoring tab:', e);
      throw e;
    }
  },

  /**
   * Handle the event when a tab is removed.
   * If the monitoring tab is closed, and monitoring is enabled, restore it.
   * @param {number} removedTabId
   * @returns {Promise<void>}
   */
  async handleTabRemoved(removedTabId) {
    const monitoringEnabled = await storage.getMonitoringEnabled();
    if (!monitoringEnabled) return;

    const storedTabId = await storage.getMonitorTabId();
    if (removedTabId === storedTabId) {
      logger.warn('Monitoring tab was closed by user or system. Restoring...');
      await storage.setMonitorTabId(null); // Reset
      // Re-create the tab
      await this.getOrCreateTab();
    }
  }
};
