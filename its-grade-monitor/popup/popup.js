/**
 * ITS Grade Monitor - Popup Script
 * Manages dashboard display, manual triggers, and setting controls.
 * Communicates with the background service worker and reads configuration
 * through the storage service wrapper.
 */

import { storage } from '../services/storage.js';

// Timer tracking for countdown
let countdownTimerId = null;

// DOM Elements
const statusBadge = document.getElementById('status-badge');
const statusText = document.getElementById('status-text');
const lastCheckAutoEl = document.getElementById('last-check-auto');
const lastCheckManualEl = document.getElementById('last-check-manual');
const lastNotificationEl = document.getElementById('last-notification');
const nextCheckEl = document.getElementById('next-check');
const rowsParsedEl = document.getElementById('rows-parsed');
const intervalEl = document.getElementById('interval');

const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const btnCheckNow = document.getElementById('btn-check-now');
const btnOpenTab = document.getElementById('btn-open-tab');
const btnSettings = document.getElementById('btn-settings');

// Helper to format ISO Date strings nicely
function formatDateTime(isoString) {
  if (!isoString) return 'Never';
  
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'Never';
    
    // Format: YYYY-MM-DD HH:mm
    const pad = (num) => String(num).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  } catch (e) {
    return 'Never';
  }
}

// Update the entire dashboard UI from storage values
async function updateDashboard() {
  const enabled = await storage.getMonitoringEnabled();
  const lastCheckAuto = await storage.getLastCheckAuto();
  const lastCheckManual = await storage.getLastCheckManual();
  const lastNotification = await storage.getLastNotification();
  const lastGrades = await storage.getLastGrades();
  const interval = await storage.getMonitorInterval();

  // 1. Update Status Badge & Toggle Buttons
  if (enabled) {
    statusBadge.className = 'status-badge active';
    statusText.textContent = 'Active';
    btnStart.disabled = true;
    btnStop.disabled = false;
  } else {
    statusBadge.className = 'status-badge stopped';
    statusText.textContent = 'Stopped';
    btnStart.disabled = false;
    btnStop.disabled = true;
  }

  // 2. Update Metrics
  lastCheckAutoEl.textContent = formatDateTime(lastCheckAuto);
  lastCheckManualEl.textContent = formatDateTime(lastCheckManual);
  lastNotificationEl.textContent = formatDateTime(lastNotification);
  rowsParsedEl.textContent = lastGrades ? lastGrades.length : 0;
  intervalEl.textContent = `${interval}m`;

  // 3. Update Next Check Countdown Timer
  clearInterval(countdownTimerId);
  if (enabled) {
    try {
      const alarm = await chrome.alarms.get('grade-check-alarm');
      if (alarm) {
        const targetTime = alarm.scheduledTime;
        
        const updateCountdown = () => {
          const now = Date.now();
          const diff = targetTime - now;
          
          if (diff <= 0) {
            nextCheckEl.textContent = 'Checking...';
            clearInterval(countdownTimerId);
            setTimeout(updateDashboard, 2000);
            return;
          }
          
          const totalSecs = Math.floor(diff / 1000);
          const mins = Math.floor(totalSecs / 60);
          const secs = totalSecs % 60;
          
          const pad = (num) => String(num).padStart(2, '0');
          nextCheckEl.textContent = `${pad(mins)}:${pad(secs)}`;
        };
        
        updateCountdown();
        countdownTimerId = setInterval(updateCountdown, 1000);
      } else {
        nextCheckEl.textContent = '--:--';
      }
    } catch (err) {
      console.error('Error fetching alarm for countdown:', err);
      nextCheckEl.textContent = 'Error';
    }
  } else {
    nextCheckEl.textContent = 'Stopped';
  }
}

// Start monitoring action
async function startMonitoring() {
  btnStart.disabled = true;
  chrome.runtime.sendMessage({ action: 'START_MONITORING' }, (response) => {
    if (chrome.runtime.lastError || !response || !response.success) {
      console.error('Failed to start monitoring:', chrome.runtime.lastError);
      btnStart.disabled = false;
    } else {
      updateDashboard();
    }
  });
}

// Stop monitoring action
async function stopMonitoring() {
  btnStop.disabled = true;
  chrome.runtime.sendMessage({ action: 'STOP_MONITORING' }, (response) => {
    if (chrome.runtime.lastError || !response || !response.success) {
      console.error('Failed to stop monitoring:', chrome.runtime.lastError);
      btnStop.disabled = false;
    } else {
      updateDashboard();
    }
  });
}

// Trigger manual grade check
async function checkNow() {
  const spinnerIcon = btnCheckNow.querySelector('.spinner-icon');
  btnCheckNow.disabled = true;
  spinnerIcon.classList.add('spinning');
  
  chrome.runtime.sendMessage({ action: 'CHECK_NOW' }, (response) => {
    btnCheckNow.disabled = false;
    spinnerIcon.classList.remove('spinning');
    
    if (chrome.runtime.lastError) {
      console.error('Error during manual check:', chrome.runtime.lastError);
      alert('Check failed: ' + chrome.runtime.lastError.message);
    } else if (response && !response.success) {
      console.error('Manual check failed:', response.error);
      alert('Check failed: ' + response.error);
    } else {
      updateDashboard();
    }
  });
}

// Open / Focus monitoring tab
function openMonitoringTab() {
  btnOpenTab.disabled = true;
  chrome.runtime.sendMessage({ action: 'OPEN_MONITOR_TAB' }, () => {
    btnOpenTab.disabled = false;
    // Close the popup after focusing the tab so the user sees the tab
    window.close();
  });
}

// Initialize listeners
document.addEventListener('DOMContentLoaded', () => {
  updateDashboard();

  btnStart.addEventListener('click', startMonitoring);
  btnStop.addEventListener('click', stopMonitoring);
  btnCheckNow.addEventListener('click', checkNow);
  btnOpenTab.addEventListener('click', openMonitoringTab);
  btnSettings.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Listen to storage changes reactively to keep UI in sync
  storage.onChanged(() => {
    updateDashboard();
  });
});
