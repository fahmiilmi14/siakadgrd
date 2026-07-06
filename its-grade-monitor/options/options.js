/**
 * ITS Grade Monitor - Options Script
 * Handles settings configuration, Telegram connection test, data backup/restore,
 * and system resets.
 */

import { storage } from '../services/storage.js';
import { telegram } from '../services/telegram.js';

// DOM Elements
const inputToken = document.getElementById('telegram-token');
const btnToggleToken = document.getElementById('btn-toggle-token');
const inputChatId = document.getElementById('telegram-chat-id');
const selectInterval = document.getElementById('monitor-interval');
const checkDebugMode = document.getElementById('debug-mode');

const btnTestTelegram = document.getElementById('btn-test-telegram');
const btnExport = document.getElementById('btn-export');
const inputFileImport = document.getElementById('import-file');
const btnReset = document.getElementById('btn-reset');
const saveStatus = document.getElementById('save-status');

let saveTimeout = null;

// Show temporary success save banner
function showSaveStatus() {
  saveStatus.classList.remove('hidden');
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveStatus.classList.add('hidden');
  }, 2500);
}

// Load current settings from storage and populate form
async function loadSettings() {
  const token = await storage.getTelegramToken();
  const chatId = await storage.getTelegramChatId();
  const interval = await storage.getMonitorInterval();
  const debug = await storage.getDebugMode();

  inputToken.value = token;
  inputChatId.value = chatId;
  selectInterval.value = interval;
  checkDebugMode.checked = debug;
}

// Save options inputs to storage
async function saveOption(key, value) {
  try {
    switch (key) {
      case 'telegramToken':
        await storage.setTelegramToken(value);
        break;
      case 'telegramChatId':
        await storage.setTelegramChatId(value);
        break;
      case 'monitorInterval':
        await storage.setMonitorInterval(parseInt(value, 10));
        break;
      case 'debugMode':
        await storage.setDebugMode(!!value);
        break;
    }
    showSaveStatus();
  } catch (err) {
    console.error('Failed to save setting:', key, err);
  }
}

// Test Telegram Connection
async function testTelegramConnection() {
  const token = inputToken.value.trim();
  const chatId = inputChatId.value.trim();

  if (!token || !chatId) {
    alert('Please enter both your Telegram Bot Token and Chat ID before testing.');
    return;
  }

  btnTestTelegram.disabled = true;
  const originalText = btnTestTelegram.innerHTML;
  btnTestTelegram.textContent = 'Sending test message...';

  const testMessage = [
    `🎓 <b>ITS Grade Monitor</b>`,
    ``,
    `<b>Telegram connection test successful!</b>`,
    ``,
    `Your bot is configured correctly and is ready to receive academic portal grade notifications.`,
    ``,
    `Time: <code>${new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC</code>`
  ].join('\n');

  try {
    await telegram.sendMessage(token, chatId, testMessage);
    alert('Test connection successful! Check your Telegram chat.');
  } catch (err) {
    console.error('Telegram test failed:', err);
    alert(`Connection test failed!\n\nError: ${err.message}\n\nPlease double check your token, chat ID, and verify the bot has been started (/start).`);
  } finally {
    btnTestTelegram.disabled = false;
    btnTestTelegram.innerHTML = originalText;
  }
}

// Toggle token visibility
function toggleTokenVisibility() {
  const type = inputToken.type === 'password' ? 'text' : 'password';
  inputToken.type = type;
  
  // Toggle icon shape or state
  btnToggleToken.style.color = type === 'text' ? 'var(--color-indigo)' : 'var(--text-secondary)';
}

// Export settings to JSON file
async function exportSettings() {
  try {
    const data = await storage.get(null); // Gets everything in local storage
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `its_grade_monitor_settings_${new Date().toISOString().substring(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Failed to export settings:', err);
    alert('Export failed: ' + err.message);
  }
}

// Import settings from JSON file
function importSettings(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const data = JSON.parse(event.target.result);
      
      // Basic validation
      const keys = Object.keys(data);
      if (!keys.includes('telegramToken') && !keys.includes('telegramChatId')) {
        throw new Error('Invalid settings backup file format.');
      }

      // Save to storage using wrapper set method
      await storage.set(data);
      await loadSettings();
      showSaveStatus();
      alert('Settings successfully imported and applied!');
    } catch (err) {
      console.error('Import failed:', err);
      alert('Import failed: ' + err.message);
    } finally {
      // Clear input value to allow importing same file again
      inputFileImport.value = '';
    }
  };
  reader.readAsText(file);
}

// Reset settings to defaults
async function resetSettings() {
  const confirmed = confirm(
    'Are you sure you want to reset all settings to defaults?\n\n' +
    'This will erase your Bot Token, Chat ID, and all stored grade histories. This action cannot be undone.'
  );

  if (confirmed) {
    try {
      await storage.clear(); // Resets and applies defaults
      await loadSettings();
      showSaveStatus();
      alert('All settings and database records have been reset.');
    } catch (err) {
      console.error('Reset failed:', err);
      alert('Reset failed: ' + err.message);
    }
  }
}

// Setup Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();

  // Handle inputs save
  inputToken.addEventListener('blur', (e) => saveOption('telegramToken', e.target.value.trim()));
  inputChatId.addEventListener('blur', (e) => saveOption('telegramChatId', e.target.value.trim()));
  selectInterval.addEventListener('change', (e) => saveOption('monitorInterval', e.target.value));
  checkDebugMode.addEventListener('change', (e) => saveOption('debugMode', e.target.checked));

  // Toggles and Actions
  btnToggleToken.addEventListener('click', toggleTokenVisibility);
  btnTestTelegram.addEventListener('click', testTelegramConnection);
  btnExport.addEventListener('click', exportSettings);
  inputFileImport.addEventListener('change', importSettings);
  btnReset.addEventListener('click', resetSettings);
});
