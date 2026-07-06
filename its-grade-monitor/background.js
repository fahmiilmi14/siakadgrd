/**
 * ITS Grade Monitor - Background Service Worker
 * Coordinates monitoring cycles, tab reloading, parsing message handling,
 * data storage, grade comparisons, and Telegram notifications.
 */

import { logger } from './utils/logger.js';
import { storage } from './services/storage.js';
import { telegram } from './services/telegram.js';
import { compare } from './services/compare.js';
import { tabManager } from './services/tabManager.js';

// Robust startup initialization helper
async function startup() {
  try {
    const enabled = await storage.getMonitoringEnabled();
    if (enabled) {
      logger.info('Monitoring is active. Ensuring monitoring tab exists...');
      try {
        await tabManager.getOrCreateTab();
      } catch (tabErr) {
        logger.warn('Failed to create/get tab during startup (non-fatal):', tabErr);
      }
    }
  } catch (err) {
    logger.error('Error during initial monitoring check:', err);
  }
  
  try {
    await updateAlarmSchedule();
  } catch (alarmErr) {
    logger.error('Error updating alarm schedule on startup:', alarmErr);
  }
}

// Initialize the extension when installed or updated
chrome.runtime.onInstalled.addListener(async () => {
  logger.info('ITS Grade Monitor service worker installed.');
  await storage.initializeDefaults();
  await startup();
});

// Listener for startup
chrome.runtime.onStartup.addListener(async () => {
  logger.info('Browser startup, running startup initialization...');
  await startup();
});

// Listener for tab removal to restore monitoring tab if closed
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  tabManager.handleTabRemoved(tabId).catch(err => {
    logger.error('Error handling tab removal:', err);
  });
});

// Listener for storage changes to reactively update alarms
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === 'local') {
    if (changes.monitoringEnabled || changes.monitorInterval) {
      logger.info('Storage settings changed, updating alarm schedule...');
      await updateAlarmSchedule();
    }
  }
});

// Initialize on service worker startup
startup();

// Listener for alarms (for interval checks)
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'grade-check-alarm') {
    logger.info('Alarm triggered, starting check process...');
    await performGradeCheck();
  }
});

// Listener for messages from popup, options, or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  logger.info(`Message received: ${message.action}`, message.data);
  
  handleMessage(message, sender, sendResponse);
  
  // Return true to indicate asynchronous response handler
  return true;
});

/**
 * Handle incoming messages from other components of the extension.
 * @param {Object} message The message payload
 * @param {chrome.runtime.MessageSender} sender Sender details
 * @param {Function} sendResponse Callback function to send response
 */
async function handleMessage(message, sender, sendResponse) {
  try {
    switch (message.action) {
      case 'CHECK_NOW':
        const result = await performGradeCheck(true);
        sendResponse({ success: true, data: result });
        break;
      case 'START_MONITORING':
        await storage.setMonitoringEnabled(true);
        await tabManager.getOrCreateTab();
        // Run initial check immediately in the background
        performGradeCheck(false).catch(err => {
          logger.error('Failed to run initial check on monitoring start:', err);
        });
        sendResponse({ success: true });
        break;
      case 'STOP_MONITORING':
        await storage.setMonitoringEnabled(false);
        sendResponse({ success: true });
        break;
      case 'OPEN_MONITOR_TAB':
        const monitorTabId = await tabManager.getOrCreateTab();
        await chrome.tabs.update(monitorTabId, { active: true });
        sendResponse({ success: true });
        break;
      default:
        sendResponse({ success: false, error: 'Unknown action: ' + message.action });
    }
  } catch (error) {
    logger.error('Error handling message: ' + message.action, error);
    sendResponse({ success: false, error: error.message });
  }
}



/**
 * Update the alarm schedule based on settings in storage.
 * @returns {Promise<void>}
 */
async function updateAlarmSchedule() {
  try {
    const enabled = await storage.getMonitoringEnabled();
    const interval = await storage.getMonitorInterval();
    
    const existingAlarm = await chrome.alarms.get('grade-check-alarm');
    
    if (enabled) {
      if (!existingAlarm || existingAlarm.periodInMinutes !== interval) {
        logger.info(`Scheduling grade check alarm every ${interval} minutes (previous: ${existingAlarm ? existingAlarm.periodInMinutes + 'm' : 'none'}).`);
        if (existingAlarm) {
          await chrome.alarms.clear('grade-check-alarm');
        }
        chrome.alarms.create('grade-check-alarm', {
          periodInMinutes: interval
        });
      } else {
        logger.info(`Alarm 'grade-check-alarm' already scheduled with correct interval (${interval}m). Skipping recreate.`);
      }
    } else {
      if (existingAlarm) {
        logger.info('Monitoring disabled. Clearing alarm.');
        await chrome.alarms.clear('grade-check-alarm');
      }
    }
  } catch (err) {
    logger.error('Failed to update alarm schedule:', err);
  }
}

/**
 * Wait until a specific tab's status is 'complete'.
 * @param {number} tabId
 * @param {number} [timeoutMs=30000]
 * @returns {Promise<void>}
 */
function waitForTabComplete(tabId, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    let timeoutId;
    
    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        cleanup();
        resolve();
      }
    };
    
    const cleanup = () => {
      chrome.tabs.onUpdated.removeListener(listener);
      clearTimeout(timeoutId);
    };
    
    chrome.tabs.onUpdated.addListener(listener);
    
    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout waiting for tab ${tabId} to load`));
    }, timeoutMs);
  });
}

/**
 * Send a message to a tab content script with a timeout.
 * @param {number} tabId
 * @param {Object} message
 * @param {number} [timeoutMs=15000]
 * @returns {Promise<any>} Response from content script
 */
function sendTabMessageWithTimeout(tabId, message, timeoutMs = 15000) {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      resolve({ success: false, error: 'Content script response timeout' });
    }, timeoutMs);
    
    chrome.tabs.sendMessage(tabId, message, (response) => {
      clearTimeout(timeoutId);
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: chrome.runtime.lastError.message });
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Execute the core monitoring flow: open/refresh tab, wait, parse, compare, notify.
 * @returns {Promise<Object>} Summary of check results
 */
async function performGradeCheck(isManual = false) {
  logger.info('Starting grade check cycle...');
  
  try {
    // 1. Get or create the monitoring tab
    const tabId = await tabManager.getOrCreateTab();
    
    // 2. Reload the tab to target URL
    logger.info('Reloading tab...');
    await chrome.tabs.update(tabId, { url: 'https://akademik.its.ac.id/data_nilaimhs.php' });
    
    // 3. Wait until page finishes loading
    logger.info(`Waiting for tab ${tabId} to complete load...`);
    await waitForTabComplete(tabId);
    logger.info(`Tab ${tabId} loaded. Sending parser trigger...`);
    
    // 4. Trigger the content script parser
    const response = await sendTabMessageWithTimeout(tabId, { action: 'TRIGGER_PARSER' });
    if (!response || !response.success) {
      throw new Error(response ? response.error : 'No response from monitoring content script.');
    }
    
    const { grades, debugInfo } = response.data;
    logger.info(`Rows parsed: ${grades.length}`);
    
    // Store debug stats if debugMode is enabled
    const debugMode = await storage.getDebugMode();
    if (debugMode && debugInfo) {
      logger.info('Saving parser debug info to storage:', debugInfo);
      await storage.setDebugInfo(debugInfo);
    }
    
    // 5. Hash and Compare Grades
    const lastGrades = await storage.getLastGrades();
    const lastHash = await storage.getLastHash();
    const newHash = await compare.generateHash(grades);
    
    let changesDetected = false;
    let diff = null;

    if (newHash !== lastHash) {
      logger.info('Hash changed...');
      diff = compare.compareGrades(lastGrades, grades);
      
      // Check if there are actual additions, updates, or removals
      const hasChanges = diff.added.length > 0 || diff.updated.length > 0 || diff.removed.length > 0;
      if (hasChanges) {
        changesDetected = true;
        logger.info(`Differences detected: Added: ${diff.added.length}, Updated: ${diff.updated.length}, Removed: ${diff.removed.length}`);
        
        // Save new state
        await storage.setLastGrades(grades);
        await storage.setLastHash(newHash);

        // Fetch Telegram credentials and dispatch notifications
        const token = await storage.getTelegramToken();
        const chatId = await storage.getTelegramChatId();
        
        if (token && chatId) {
          logger.info('Sending Telegram...');
          let sentAny = false;
          
          // Notify additions
          for (const item of diff.added) {
            const message = telegram.formatMessage('added', item, null, new Date());
            await telegram.sendMessage(token, chatId, message);
            logger.info(`Telegram notification sent for added course ${item.code}`);
            sentAny = true;
          }
          
          // Notify updates
          for (const item of diff.updated) {
            const message = telegram.formatMessage('updated', item.new, item.old.grade, new Date());
            await telegram.sendMessage(token, chatId, message);
            logger.info(`Telegram notification sent for updated course ${item.new.code}`);
            sentAny = true;
          }

          // Notify removals
          for (const item of diff.removed) {
            const message = telegram.formatMessage('removed', item, item.grade, new Date());
            await telegram.sendMessage(token, chatId, message);
            logger.info(`Telegram notification sent for removed course ${item.code}`);
            sentAny = true;
          }

          // Also send the full summary report
          logger.info('Sending compiled grades summary...');
          const summaryMessage = telegram.formatAllGradesSummary(grades, new Date());
          await telegram.sendMessage(token, chatId, summaryMessage);
          logger.info('Telegram summary report sent.');
          sentAny = true;

          if (sentAny) {
            await storage.setLastNotification(new Date().toISOString());
            logger.info('Telegram success.');
          }
        } else {
          logger.warn('Telegram token or chat ID is not configured. Notifications skipped.');
        }
      } else {
        logger.info('Hash changed, but no semantic changes found (e.g. whitespace only). Updating hash.');
        await storage.setLastHash(newHash);
        
        await sendNoChangesNotification(isManual);
        // If manual check, send full report anyway for validation
        if (isManual) {
          await sendManualSummaryReport(grades);
        }
      }
    } else {
      logger.info('Grades hash is identical. No changes.');
      
      await sendNoChangesNotification(isManual);
      // If manual check, send full report anyway for validation
      if (isManual) {
        await sendManualSummaryReport(grades);
      }
    }

    // 6. Update last check timestamp
    const now = new Date().toISOString();
    await storage.setLastCheck(now);
    if (isManual) {
      await storage.setLastCheckManual(now);
    } else {
      await storage.setLastCheckAuto(now);
    }
    
    // Return result summary
    return { 
      success: true, 
      count: grades.length, 
      timestamp: now,
      changesDetected,
      diff
    };
  } catch (error) {
    logger.error('Grade check cycle failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Sends a manual compiled grades summary report to Telegram.
 * @param {Object[]} grades Array of grade objects
 * @returns {Promise<void>}
 */
async function sendManualSummaryReport(grades) {
  if (!grades || grades.length === 0) return;
  const token = await storage.getTelegramToken();
  const chatId = await storage.getTelegramChatId();
  
  if (token && chatId) {
    logger.info('Sending manual grades summary to Telegram...');
    const summaryMessage = telegram.formatAllGradesSummary(grades, new Date());
    await telegram.sendMessage(token, chatId, summaryMessage);
    await storage.setLastNotification(new Date().toISOString());
    logger.info('Telegram success.');
  } else {
    logger.warn('Telegram credentials not configured for manual summary report.');
  }
}

/**
 * Sends a notification indicating no grade changes to Telegram.
 * @param {boolean} isManual Whether the check was triggered manually
 * @returns {Promise<void>}
 */
async function sendNoChangesNotification(isManual) {
  try {
    const token = await storage.getTelegramToken();
    const chatId = await storage.getTelegramChatId();
    if (token && chatId) {
      const message = telegram.formatNoChangesMessage(isManual, new Date());
      await telegram.sendMessage(token, chatId, message);
      await storage.setLastNotification(new Date().toISOString());
      logger.info('Telegram no-changes notification sent.');
    } else {
      logger.warn('Telegram credentials not configured for no-changes notification.');
    }
  } catch (err) {
    logger.error('Failed to send Telegram no-changes notification:', err);
  }
}
