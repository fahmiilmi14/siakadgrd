/**
 * Grade Comparison Service
 * Compares old and new grade records to identify added, updated, or removed items,
 * and handles data normalization and hashing.
 */

/**
 * Normalize a single grade object for canonical comparison.
 * Trims whitespace, casts types, and enforces uppercase casing for code/class/semester.
 * @param {Object} g Grade object
 * @returns {Object} Normalized grade object
 */
function normalizeGrade(g) {
  if (!g) return null;
  return {
    semester: (g.semester || '').trim().toUpperCase(),
    code: (g.code || '').trim().toUpperCase(),
    course: (g.course || '').trim(),
    credits: parseInt(g.credits, 10) || 0,
    class: (g.class || '').trim().toUpperCase(),
    grade: g.grade ? g.grade.trim().toUpperCase() : null
  };
}

/**
 * Sort grades array by semester, course code, and class.
 * Ensures consistent footprint generation.
 * @param {Object[]} grades Array of normalized grade objects
 * @returns {Object[]} Sorted array
 */
function sortGrades(grades) {
  return [...grades].sort((a, b) => {
    const semCompare = a.semester.localeCompare(b.semester);
    if (semCompare !== 0) return semCompare;
    
    const codeCompare = a.code.localeCompare(b.code);
    if (codeCompare !== 0) return codeCompare;
    
    return a.class.localeCompare(b.class);
  });
}

/**
 * Helper to compute SHA-256 hash of a string using Web Crypto API.
 * @param {string} text Input string
 * @returns {Promise<string>} Hex representation of hash
 */
async function sha256(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export const compare = {
  /**
   * Normalize, sort, and hash the grades array to generate a unique footprint.
   * @param {Object[]} grades Array of grade objects
   * @returns {Promise<string>} SHA-256 hash of normalized grades
   */
  async generateHash(grades) {
    if (!grades || grades.length === 0) return '';
    
    const normalized = grades.map(normalizeGrade).filter(Boolean);
    const sorted = sortGrades(normalized);
    const serialized = JSON.stringify(sorted);
    
    return await sha256(serialized);
  },

  /**
   * Compare two lists of grades and find added, updated, and removed entries.
   * Unique identifier key is composed of: semester | code | class.
   * @param {Object[]} oldGrades Previous grades array
   * @param {Object[]} newGrades Current grades array
   * @returns {Object} { added: Object[], updated: Object[], removed: Object[] }
   */
  compareGrades(oldGrades, newGrades) {
    const normOld = (oldGrades || []).map(normalizeGrade).filter(Boolean);
    const normNew = (newGrades || []).map(normalizeGrade).filter(Boolean);

    // Map grades by composite key "semester|code|class"
    const createKey = (g) => `${g.semester}|${g.code}|${g.class}`;
    
    const oldMap = new Map(normOld.map(g => [createKey(g), g]));
    const newMap = new Map(normNew.map(g => [createKey(g), g]));

    const added = [];
    const updated = [];
    const removed = [];

    // Find added and updated
    for (const [key, newGrade] of newMap.entries()) {
      const oldGrade = oldMap.get(key);
      if (!oldGrade) {
        added.push(newGrade);
      } else if (oldGrade.grade !== newGrade.grade) {
        updated.push({
          old: oldGrade,
          new: newGrade
        });
      }
    }

    // Find removed
    for (const [key, oldGrade] of oldMap.entries()) {
      if (!newMap.has(key)) {
        removed.push(oldGrade);
      }
    }

    return {
      added,
      updated,
      removed
    };
  }
};
