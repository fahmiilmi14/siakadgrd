# 🎓 ITS Grade Monitor

An elegant, production-grade Google Chrome Extension (Manifest V3) that monitors grades on the ITS Academic Portal (`https://akademik.its.ac.id`) and sends real-time Telegram notifications when changes are detected.

---

## 🚀 Key Features

*   **Dedicated Background Monitoring**: Keeps a single, dedicated background tab, refreshes it periodically, and never interferes with your active browsing tabs.
*   **Muted & Pinned Tab**: The monitoring tab is pinned and muted automatically to run silently in the background.
*   **Intelligent DOM Stability Verification**: Uses `MutationObserver` to ensure the grades page is fully rendered and stable before extraction.
*   **Canonical Comparison Engine**: Normalizes grade details, sorts them, and uses SHA-256 (via Web Crypto API) to determine changes before calculating semantic differences (added, updated, or removed grades).
*   **Reliable Telegram Dispatcher**: Sends detailed HTML notifications for grade updates with an automatic **retry once** mechanism and 10-second request timeout.
*   **Premium Dark Dashboard**: Stunning popup panel showing real-time monitoring status, intervals, counters, and quick actions ("Check Now", "Open Tab", etc.).
*   **Advanced Control Panel**: Options page featuring instant settings auto-save, Telegram connection testing, debug log telemetry, database resets, and full configuration export/import.

---

## 📁 Project Structure

```
its-grade-monitor/
├── manifest.json         # Extension Manifest V3 configuration
├── background.js        # Background service worker (event coordinator)
├── content/             # Scripts running in page context
│   ├── parser.js        # Parses course structures, SKS, and grade rows
│   ├── extractor.js     # Selects correct grade tables and matches semesters
│   └── monitor.js       # Listens to load, checks DOM stability, triggers parser
├── services/            # Extension API & state services
│   ├── storage.js       # Wrapper & ONLY access point to chrome.storage.local
│   ├── compare.js       # Normalized comparison & SHA-256 hashing engine
│   └── telegram.js      # Telegram Bot API client and message formatter
├── utils/               # Common helper scripts
│   ├── logger.js        # Standardized prefix logger with timestamps
│   └── wait.js          # Async wait / condition delay helpers
├── popup/               # Popup UI elements
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
└── options/             # Extension Options UI elements
    ├── options.html
    ├── options.css
    └── options.js
```

---

## 🛠️ Installation Guide

1.  Clone or download this repository to your local machine.
2.  Open **Google Chrome** and navigate to: `chrome://extensions/`
3.  Enable **Developer mode** (toggle switch in the top-right corner).
4.  Click the **Load unpacked** button in the top-left corner.
5.  Select the `its-grade-monitor` directory (the folder containing `manifest.json`).
6.  The extension is now installed and will appear in your Chrome toolbar!

---

## ⚙️ Configuration & Setup

### 1. Create a Telegram Bot
1.  Search for `@BotFather` on Telegram and start a chat.
2.  Send `/newbot` and follow the instructions to get your **Bot Token** (e.g., `123456789:ABCdefGh...`).
3.  Start your new bot by searching for its username and clicking **Start** (or sending `/start`).

### 2. Retrieve Your Chat ID
1.  Search for `@userinfobot` or `@raw_data_bot` on Telegram and send any message.
2.  Copy your numerical **ID** (e.g., `987654321` or a negative ID if using a group channel).

### 3. Save Settings in Extension
1.  Right-click the **ITS Grade Monitor** extension icon and choose **Options** (or click "Details" -> "Extension options").
2.  Enter your **Bot Token** and **Chat ID**.
3.  Click **Test Connection** to receive a verification message on your Telegram chat.
4.  Set your preferred **Check Interval** (e.g., 15 minutes). All changes are saved automatically.

---

## 🔍 Development Guidelines & Principles

*   **Independence**: The parser does not access Chrome extension APIs, ensuring it is 100% testable in local environments (e.g. Node.js).
*   **Encapsulation**: State storage is strictly restricted. Only `services/storage.js` communicates with `chrome.storage.local`.
*   **Non-Interfering Background**: Background scripts never touch the DOM; they only read/write states and schedule cycles. Content scripts handle DOM scraping and stability checks.
*   **Deterministic Scraping**: Zero fuzzy/statistical guessing. The parser works on exact matched patterns and layouts.

---

## 📄 License

This extension is built for personal use. All rights reserved.
