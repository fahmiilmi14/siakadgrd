/**
 * Telegram Notification Service
 * Handles communication with Telegram Bot API, including sending messages,
 * escaping HTML characters, formatting messages, retries, and timeouts.
 */

export const telegram = {
  /**
   * Escape special HTML characters for Telegram HTML mode.
   * @param {string} text Raw text to escape
   * @returns {string} Escaped text safe for HTML parse mode
   */
  escapeHtml(text) {
    if (!text) return '';
    return text
      .toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  },

  /**
   * Send an HTML formatted message via Telegram.
   * @param {string} token Telegram Bot Token
   * @param {string} chatId Telegram Chat ID
   * @param {string} message HTML formatted message string
   * @returns {Promise<boolean>} True if successful
   */
  async sendMessage(token, chatId, message) {
    if (!token || !chatId) {
      throw new Error('Telegram Bot Token or Chat ID is missing.');
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const payload = {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    };

    const makeRequest = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds timeout

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Telegram API status ${response.status}: ${errText}`);
        }

        return true;
      } catch (err) {
        clearTimeout(timeoutId);
        throw err;
      }
    };

    try {
      // First attempt
      return await makeRequest();
    } catch (firstErr) {
      console.warn('Telegram send failed, retrying once in 1 second...', firstErr.message);
      // Wait 1 second before retry
      await new Promise(r => setTimeout(r, 1000));
      try {
        // Second attempt (retry once)
        return await makeRequest();
      } catch (secondErr) {
        console.error('Telegram retry failed:', secondErr.message);
        throw secondErr;
      }
    }
  },

  /**
   * Formats a grade change event into the target HTML format.
   * @param {string} type 'added' | 'updated' | 'removed'
   * @param {Object} item The grade object
   * @param {string|null} [oldGrade=null] Previous grade value (for update/removal)
   * @param {Date} [timestamp=new Date()] Event timestamp
   * @returns {string} HTML formatted message
   */
  formatMessage(type, item, oldGrade = null, timestamp = new Date()) {
    const esc = this.escapeHtml;
    
    let typeText = 'New grade detected';
    let gradeText = item.grade ? esc(item.grade) : '_';
    
    if (type === 'updated') {
      typeText = 'Grade updated';
      const oldStr = oldGrade ? esc(oldGrade) : '_';
      const newStr = item.grade ? esc(item.grade) : '_';
      gradeText = `${oldStr} ➔ ${newStr}`;
    } else if (type === 'removed') {
      typeText = 'Grade removed';
      gradeText = `<s>${oldGrade ? esc(oldGrade) : '_'}</s>`;
    }

    // Format local time: e.g. "2026-07-05 19:31 WIB"
    // Using Asia/Jakarta (WIB) timezone for ITS academic portal context
    const options = {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    };
    
    let formattedTime = '';
    try {
      const formatter = new Intl.DateTimeFormat('sv-SE', options); // YYYY-MM-DD HH:mm format
      const parts = formatter.formatToParts(timestamp);
      const partObj = {};
      parts.forEach(p => partObj[p.type] = p.value);
      formattedTime = `${partObj.year}-${partObj.month}-${partObj.day} ${partObj.hour}:${partObj.minute} WIB`;
    } catch (e) {
      // Fallback formatting
      formattedTime = timestamp.toISOString().replace('T', ' ').substring(0, 16) + ' UTC';
    }

    return [
      `🎓 <b>ITS Grade Monitor</b>`,
      ``,
      `<b>${typeText}</b>`,
      ``,
      `Semester:`,
      `${esc(item.semester)}`,
      ``,
      `Course:`,
      `${esc(item.code)}`,
      ``,
      `${esc(item.course)}`,
      ``,
      `Grade`,
      ``,
      `<b>${gradeText}</b>`,
      ``,
      `Time`,
      ``,
      `${formattedTime}`
    ].join('\n');
  },

  /**
   * Formats a collection of all parsed grades into a single HTML summary report.
   * Groups courses by their respective semesters.
   * @param {Object[]} grades Array of grade objects
   * @param {Date} [timestamp=new Date()] Execution timestamp
   * @returns {string} HTML formatted summary message
   */
  formatAllGradesSummary(grades, timestamp = new Date()) {
    const esc = this.escapeHtml;
    
    // Group grades by semester
    const semMap = {};
    for (const g of grades) {
      if (!semMap[g.semester]) {
        semMap[g.semester] = [];
      }
      semMap[g.semester].push(g);
    }

    const lines = [
      `🎓 <b>ITS Grade Monitor</b>`,
      ``,
      `<b>All Parsed Grades Summary</b>`,
      ``
    ];

    // Build lists for each semester
    for (const [semester, list] of Object.entries(semMap)) {
      lines.push(`<b>Semester: ${esc(semester)}</b>`);
      
      // Sort semester courses by code
      const sortedList = [...list].sort((a, b) => a.code.localeCompare(b.code));
      
      for (const g of sortedList) {
        const gradeText = g.grade ? `<b>${esc(g.grade)}</b>` : '<i>Pending (_)</i>';
        lines.push(`• <code>${esc(g.code)}</code> - ${esc(g.course)}: ${gradeText} (${esc(g.class)})`);
      }
      lines.push(``); // Blank line between semesters
    }

    // Format local time: e.g. "2026-07-05 19:31 WIB"
    const options = {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    };
    
    let formattedTime = '';
    try {
      const formatter = new Intl.DateTimeFormat('sv-SE', options);
      const parts = formatter.formatToParts(timestamp);
      const partObj = {};
      parts.forEach(p => partObj[p.type] = p.value);
      formattedTime = `${partObj.year}-${partObj.month}-${partObj.day} ${partObj.hour}:${partObj.minute} WIB`;
    } catch (e) {
      formattedTime = timestamp.toISOString().replace('T', ' ').substring(0, 16) + ' UTC';
    }

    lines.push(`Time`);
    lines.push(``);
    lines.push(`${formattedTime}`);

    return lines.join('\n');
  },

  /**
   * Formats a no changes notification.
   * @param {boolean} isManual Whether the check was triggered manually
   * @param {Date} [timestamp=new Date()] Event timestamp
   * @returns {string} HTML formatted message
   */
  formatNoChangesMessage(isManual, timestamp = new Date()) {
    const checkType = isManual ? 'manual' : 'otomatis';
    
    const options = {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    };
    
    let formattedTime = '';
    try {
      const formatter = new Intl.DateTimeFormat('sv-SE', options);
      const parts = formatter.formatToParts(timestamp);
      const partObj = {};
      parts.forEach(p => partObj[p.type] = p.value);
      formattedTime = `${partObj.year}-${partObj.month}-${partObj.day} ${partObj.hour}:${partObj.minute}:${partObj.second} WIB`;
    } catch (e) {
      formattedTime = timestamp.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
    }

    return [
      `🎓 <b>ITS Grade Monitor</b>`,
      ``,
      `Pengecekan ${checkType} tidak ada perubahan nilai.`,
      `Waktu: <code>${formattedTime}</code>`
    ].join('\n');
  }
};
