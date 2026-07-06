/**
 * ITS Grade Extractor Module
 * Responsible for finding target tables and coordinating row-by-row data extraction.
 * This module runs in the content script context and does not access chrome APIs.
 */

window.ItsGradeExtractor = (() => {
  'use strict';

  // Regular expression to extract semester identifier
  const SEMESTER_REGEX = /Perkuliahan pada:\s*(\d{4}\/[A-Z_]+)/i;

  /**
   * Find and select target tables that contain grades.
   * Target tables must contain headers: 'Mata Kuliah', 'Kelas', 'Nilai'.
   * @param {Document} doc Document to search (default is current window.document)
   * @returns {HTMLTableElement[]} Array of matching grade tables
   */
  function locateGradeTables(doc = document) {
    if (!doc) return [];
    
    const tables = Array.from(doc.getElementsByTagName('table'));
    return tables.filter(table => {
      const rows = Array.from(table.rows);
      // Check if any row contains cells for "Mata Kuliah", "Kelas", and "Nilai"
      return rows.some(row => {
        const cells = Array.from(row.cells);
        const cellTexts = cells.map(c => (c.textContent || '').trim());
        return cellTexts.some(txt => txt.includes('Mata Kuliah')) &&
               cellTexts.some(txt => txt.includes('Kelas')) &&
               cellTexts.some(txt => txt.includes('Nilai'));
      });
    });
  }

  /**
   * Find the semester context associated with a given table.
   * Scans rows within the table, preceding siblings, and the parent container.
   * @param {HTMLTableElement} table
   * @returns {string|null} The semester string (e.g. "2024/GENAP"), or null if not found
   */
  function findSemesterForTable(table) {
    // 1. Scan row text contents inside the table
    for (const row of Array.from(table.rows)) {
      const match = (row.textContent || '').match(SEMESTER_REGEX);
      if (match) {
        return match[1].trim();
      }
    }
    
    // 2. Scan preceding sibling elements
    let sibling = table.previousElementSibling;
    while (sibling) {
      const match = (sibling.textContent || '').match(SEMESTER_REGEX);
      if (match) {
        return match[1].trim();
      }
      if (sibling.tagName === 'TABLE') {
        break; // Stop at another table to avoid mismatch
      }
      sibling = sibling.previousElementSibling;
    }
    
    // 3. Scan the parent container text content
    if (table.parentElement) {
      const match = (table.parentElement.textContent || '').match(SEMESTER_REGEX);
      if (match) {
        return match[1].trim();
      }
    }
    
    return null;
  }

  /**
   * Extract all grade rows from the located tables.
   * @param {HTMLTableElement[]} tables Selected grade tables
   * @returns {Object[]} Collection of parsed grade objects
   */
  function extractRawData(tables) {
    const allGrades = [];
    
    for (const table of tables) {
      const semester = findSemesterForTable(table) || 'UNKNOWN';
      
      for (const row of Array.from(table.rows)) {
        if (window.ItsGradeParser) {
          const parsed = window.ItsGradeParser.parseRow(row, semester);
          if (parsed) {
            allGrades.push(parsed);
          }
        }
      }
    }
    
    return allGrades;
  }

  return {
    locateGradeTables,
    findSemesterForTable,
    extractRawData
  };
})();
