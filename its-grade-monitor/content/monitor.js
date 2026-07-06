/**
 * ITS Grade Content Monitor
 * Injected into the target page. Coordinates parser/extractor modules,
 * monitors DOM stability, and communicates findings back to the background script.
 */

(() => {
  'use strict';

  /**
   * Check if the DOM is stable and fully loaded.
   * Resolves when no mutations have occurred for a specified interval.
   * @param {number} [stabilityInterval=500] Time in ms to wait for no mutations
   * @param {number} [timeout=5000] Maximum wait time in ms
   * @returns {Promise<boolean>} Resolves to true when stable, false if timeout reached
   */
  async function checkDomStability(stabilityInterval = 500, timeout = 5000) {
    console.log('Waiting DOM...');
    return new Promise((resolve) => {
      let timeoutId;
      let globalTimeoutId;
      
      const observer = new MutationObserver(() => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(onStable, stabilityInterval);
      });
      
      const onStable = () => {
        observer.disconnect();
        clearTimeout(globalTimeoutId);
        console.log('Content Monitor: DOM is stable.');
        resolve(true);
      };
      
      // Start observing mutations in the body
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true
      });
      
      // Set initial timer
      timeoutId = setTimeout(onStable, stabilityInterval);
      
      // Absolute safety timeout
      globalTimeoutId = setTimeout(() => {
        observer.disconnect();
        console.warn('Content Monitor: DOM stability check timed out.');
        resolve(false);
      }, timeout);
    });
  }

  /**
   * Run the parsing process on the page.
   * @returns {Promise<Object>} Object containing parsed grades and debug metrics
   */
  async function runParser() {
    console.log('Parser started...');
    const startTime = Date.now();
    
    // 1. Wait until DOM is stable
    await checkDomStability();

    let tablesFoundCount = 0;
    let selectedTableCount = 0;
    let headersList = [];
    let rowsParsedCount = 0;
    let rowsIgnoredCount = 0;
    const semestersDetected = new Set();
    const grades = [];

    if (window.ItsGradeExtractor && window.ItsGradeParser) {
      const doc = document;
      tablesFoundCount = doc.getElementsByTagName('table').length;
      
      const tables = window.ItsGradeExtractor.locateGradeTables(doc);
      selectedTableCount = tables.length;

      // Locate headers from selected tables
      for (const table of tables) {
        for (const row of Array.from(table.rows)) {
          const cells = Array.from(row.cells);
          const cellTexts = cells.map(c => (c.textContent || '').trim());
          if (cellTexts.some(txt => txt.includes('Mata Kuliah')) &&
              cellTexts.some(txt => txt.includes('Kelas')) &&
              cellTexts.some(txt => txt.includes('Nilai'))) {
            headersList = cellTexts;
            break;
          }
        }
      }

      // Extract and parse each table
      for (const table of tables) {
        const semester = window.ItsGradeExtractor.findSemesterForTable(table) || 'UNKNOWN';
        console.log('Semester detected...');
        semestersDetected.add(semester);
        
        for (const row of Array.from(table.rows)) {
          const parsed = window.ItsGradeParser.parseRow(row, semester);
          if (parsed) {
            grades.push(parsed);
            rowsParsedCount++;
          } else {
            rowsIgnoredCount++;
          }
        }
      }
    }
    
    const parserTime = Date.now() - startTime;

    return {
      grades,
      debugInfo: {
        tablesFound: tablesFoundCount,
        selectedTable: selectedTableCount,
        headers: headersList,
        rowsParsed: rowsParsedCount,
        rowsIgnored: rowsIgnoredCount,
        semesterDetected: Array.from(semestersDetected).join(', '),
        parserTime
      }
    };
  }

  // Listen for manual trigger messages from background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'TRIGGER_PARSER') {
      runParser()
        .then(result => sendResponse({ success: true, data: result }))
        .catch(err => {
          console.error('Content Monitor: Parsing failed:', err);
          sendResponse({ success: false, error: err.message });
        });
      return true; // Keep message channel open for async response
    }
  });

  console.log('Content Monitor: Initialized and listening.');
})();
