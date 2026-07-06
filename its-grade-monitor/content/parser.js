/**
 * ITS Grade Parser Module
 * Responsible for parsing courses, semester identifiers, and individual row strings.
 * This module runs in the content script context and does not access chrome APIs.
 */

window.ItsGradeParser = (() => {
  'use strict';

  // Regular expression to parse the first column: "Code - Course (Credits sks)"
  const COURSE_DETAILS_REGEX = /^([A-Z0-9]+)\s*-\s*(.+?)\s*\((\d+)\s*sks\)$/i;

  /**
   * Parse course detail string (e.g., "EF234101 - Kalkulus I (4 sks)")
   * @param {string} rawText The raw course text from the table cell
   * @returns {Object|null} Extracted code, course name, and credits, or null if match fails
   */
  function parseCourseDetails(rawText) {
    if (!rawText) return null;
    const cleanText = rawText.trim();
    const match = cleanText.match(COURSE_DETAILS_REGEX);
    if (!match) return null;

    return {
      code: match[1].trim(),
      course: match[2].trim(),
      credits: parseInt(match[3], 10)
    };
  }

  /**
   * Parse a specific grade table row.
   * Checks if the row is a valid grade data row, and extracts details.
   * @param {HTMLTableRowElement} row The table row element to parse
   * @param {string} semester Current semester scope
   * @returns {Object|null} The parsed grade object or null if invalid/header row
   */
  function parseRow(row, semester) {
    if (!row || !row.cells || row.cells.length < 3) {
      return null;
    }

    const col1 = row.cells[0].textContent;
    const col2 = row.cells[1].textContent;
    const col3 = row.cells[2].textContent;

    const courseDetails = parseCourseDetails(col1);
    if (!courseDetails) {
      return null; // Not a valid grade row (e.g., header, spacer, or GPA row)
    }

    const className = col2.trim();
    
    const rawGrade = col3.trim();
    const grade = (rawGrade === '_' || rawGrade === '') ? null : rawGrade;

    return {
      semester,
      code: courseDetails.code,
      course: courseDetails.course,
      credits: courseDetails.credits,
      class: className,
      grade
    };
  }

  return {
    parseCourseDetails,
    parseRow
  };
})();
